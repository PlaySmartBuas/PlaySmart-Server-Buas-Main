"""
FastAPI routes for listing match files, reading CSVs, 
and providing summaries of match data.
"""

import os
import csv
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


# -------------------------------
# Pydantic Model
# -------------------------------
class MatchFile(BaseModel):
    filename: str
    display_name: str
    game_type: str
    date: str
    has_video: bool
    has_merged_data: bool
    video_path: Optional[str] = None
    merged_data_path: Optional[str] = None


# -------------------------------
# Helper Functions
# -------------------------------
def normalize_filename(filename: str) -> str:
    """Normalize filename for comparison by removing underscores, spaces, and hyphens, and lowercasing."""
    return filename.lower().replace("_", "").replace(" ", "").replace("-", "")


# -------------------------------
# List Matches Endpoint
# -------------------------------
@router.get("/list-matches")
async def list_matches(
    game_type: Optional[str] = None,
    data_directory: str = Query(..., description="Path to data directory"),
):
    """
    List all available matches from the data directory.
    Optionally filters by game_type ('valorant' or 'league of legends').

    Args:
        game_type (Optional[str]): Filter matches by game type.
        data_directory (str): Base path to the data directory.

    Returns:
        dict: {
            "success": bool,
            "matches": List[MatchFile],
            "count": int,
            "game_type_filter": str,
            "data_directory": str
        }
    """
    try:
        merged_dir = os.path.join(data_directory, "merged")
        video_dir = os.path.join(data_directory, "video")

        if not os.path.exists(merged_dir):
            raise HTTPException(
                status_code=404, detail=f"Merged data directory not found: {merged_dir}"
            )

        matches: List[MatchFile] = []

        # CSV files in merged directory
        merged_files = [f for f in os.listdir(merged_dir) if f.endswith(".csv")]

        # Map video files using normalized filenames
        video_files_map = {}
        if os.path.exists(video_dir):
            video_files = [f for f in os.listdir(video_dir) if f.endswith(".mp4")]
            for vf in video_files:
                normalized = normalize_filename(vf.replace(".mp4", ""))
                video_files_map[normalized] = vf

        # Process each merged file
        for merged_file in merged_files:
            filename_lower = merged_file.lower()

            # Detect game type
            if "valorant" in filename_lower:
                detected_game = "valorant"
            elif "league of legends" in filename_lower:
                detected_game = "league of legends"
            else:
                continue  # Skip unknown game

            # Apply game type filter
            if game_type and detected_game != game_type.lower():
                continue

            # Extract date from filename
            formatted_date = "Unknown date"
            try:
                for part in merged_file.split("_"):
                    if "-" in part and len(part) >= 10:
                        date_candidate = part[:10]
                        if date_candidate.count("-") == 2:
                            date_obj = datetime.strptime(date_candidate, "%d-%m-%Y")
                            formatted_date = date_obj.strftime("%B %d, %Y")
                            break
            except Exception:
                pass

            # Match video file
            base_name = merged_file.replace("_merged.csv", "")
            normalized_base = normalize_filename(base_name)
            video_file = video_files_map.get(normalized_base)
            has_video = bool(video_file)
            video_path = f"/videos/{video_file}" if has_video else None

            # Prepare display name
            display_name = base_name.replace("_", " ").title()

            matches.append(
                MatchFile(
                    filename=base_name,
                    display_name=display_name,
                    game_type=detected_game,
                    date=formatted_date,
                    has_video=has_video,
                    has_merged_data=True,
                    video_path=video_path,
                    merged_data_path=f"/merged/{merged_file}",
                )
            )

        # Sort matches by filename descending (most recent first)
        matches.sort(key=lambda x: x.filename, reverse=True)

        return {
            "success": True,
            "matches": matches,
            "count": len(matches),
            "game_type_filter": game_type,
            "data_directory": data_directory,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing matches: {str(e)}")


# -------------------------------
# Get Match Details
# -------------------------------
@router.get("/match-details/{filename}")
async def get_match_details(
    filename: str,
    data_directory: str = Query(..., description="Path to data directory"),
):
    """
    Get detailed information about a specific match.

    Args:
        filename (str): Base filename without '_merged.csv'.
        data_directory (str): Base data directory path.

    Returns:
        dict: Match details including paths, video availability, and file size.
    """
    try:
        merged_file = f"{filename}_merged.csv"
        merged_path = os.path.join(data_directory, "merged", merged_file)

        if not os.path.exists(merged_path):
            raise HTTPException(
                status_code=404, detail=f"Match data not found: {filename}"
            )

        file_stats = os.stat(merged_path)
        file_size = file_stats.st_size

        # Check for video file using normalized matching
        video_dir = os.path.join(data_directory, "video")
        video_file = None
        has_video = False
        normalized_filename = normalize_filename(filename)

        if os.path.exists(video_dir):
            for vf in os.listdir(video_dir):
                if vf.endswith(".mp4") and normalize_filename(vf.replace(".mp4", "")) == normalized_filename:
                    video_file = vf
                    has_video = True
                    break

        if not has_video:
            exact_video = f"{filename}.mp4"
            video_file = exact_video if os.path.exists(os.path.join(video_dir, exact_video)) else None
            has_video = bool(video_file)

        return {
            "success": True,
            "filename": filename,
            "has_video": has_video,
            "has_merged_data": True,
            "file_size": file_size,
            "video_path": f"/videos/{video_file}" if has_video else None,
            "merged_data_path": f"/merged/{merged_file}",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting match details: {str(e)}")


# -------------------------------
# CSV Summary Endpoint
# -------------------------------
@router.get("/csv-summary")
async def get_csv_summary(file_path: str = Query(..., description="Path to CSV file")):
    """
    Get a quick summary of a CSV file without reading all data.

    Args:
        file_path (str): Path to the CSV file.

    Returns:
        dict: Summary including file size, column names, sample rows, and row count.
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

        file_size = os.path.getsize(file_path)
        sample_rows = []
        row_count = 0

        with open(file_path, "r", encoding="utf-8") as f:
            csv_reader = csv.DictReader(f)
            headers = csv_reader.fieldnames

            for i, row in enumerate(csv_reader):
                if i < 5:
                    sample_rows.append(row)
                row_count += 1

        return {
            "success": True,
            "file_size_bytes": file_size,
            "file_size_mb": round(file_size / (1024 * 1024), 2),
            "total_rows": row_count,
            "columns": headers,
            "column_count": len(headers), #type:ignore
            "sample_rows": sample_rows,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


# -------------------------------
# Read CSV Endpoint
# -------------------------------
@router.get("/read-csv")
async def read_csv(
    file_path: str = Query(..., description="Path to CSV file"),
    max_rows: int = Query(100, description="Maximum number of rows to return"),
    skip_rows: int = Query(0, description="Number of rows to skip"),
):
    """
    Read a CSV file and return limited rows for performance.

    Args:
        file_path (str): Path to CSV file.
        max_rows (int): Maximum rows to return.
        skip_rows (int): Number of rows to skip.

    Returns:
        dict: Headers, returned rows, total rows, and skipped rows.
    """
    try:
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
        if not file_path.endswith(".csv"):
            raise HTTPException(status_code=400, detail="Only CSV files are supported")

        rows_read = []
        total_rows = 0
        headers = []

        with open(file_path, "r", encoding="utf-8") as f:
            csv_reader = csv.DictReader(f)
            headers = csv_reader.fieldnames

            # Skip rows
            for _ in range(skip_rows):
                try:
                    next(csv_reader)
                    total_rows += 1
                except StopIteration:
                    break

            # Read requested rows
            for i, row in enumerate(csv_reader):
                if i >= max_rows:
                    # Continue counting remaining rows
                    for _ in csv_reader:
                        total_rows += 1
                    total_rows += max_rows + skip_rows
                    break
                rows_read.append(row)
                total_rows += 1
            else:
                total_rows += skip_rows

        return {
            "success": True,
            "headers": headers,
            "data": rows_read,
            "rows_returned": len(rows_read),
            "total_rows": total_rows,
            "skip_rows": skip_rows,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")