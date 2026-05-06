from fastapi import APIRouter, HTTPException, Path, Request
from fastapi.responses import FileResponse, StreamingResponse, Response
from urllib.parse import unquote
import os
from pathlib import Path as FilePath
from typing import Generator, Optional

router = APIRouter()


def _normalize_video_filename(filename: str) -> str:
    """
    Normalize video filename by removing CSV-related suffixes and ensuring .mp4 extension.
    
    Handles the following transformations:
    - filename_merged.csv -> filename.mp4
    - filename_merged.mp4 -> filename.mp4
    - filename.csv -> filename.mp4
    - filename -> filename.mp4
    
    Args:
        filename: Original filename from request
        
    Returns:
        Normalized filename with .mp4 extension
    """
    if filename.endswith("_merged.csv"):
        return filename.replace("_merged.csv", ".mp4")
    elif filename.endswith("_merged.mp4"):
        return filename.replace("_merged.mp4", ".mp4")
    elif filename.endswith(".csv"):
        return filename.replace(".csv", ".mp4")
    elif not filename.endswith(".mp4"):
        return filename + ".mp4"
    return filename


def _resolve_video_directory(data_directory: Optional[str]) -> str:
    """
    Resolve the base directory for video files with fallback logic.
    
    Priority order:
    1. data_directory query parameter (from frontend localStorage)
    2. VIDEO_BASE_DIR environment variable
    3. Default to backend/data/video
    
    If data_directory points to a parent 'data' folder, checks for 'video' subdirectory.
    
    Args:
        data_directory: Optional directory path from query parameter
        
    Returns:
        Resolved absolute path to video directory
    """
    if data_directory:
        # Decode URL-encoded path
        candidate = unquote(data_directory)
        candidate_path = FilePath(candidate)
        
        # Check if user passed parent 'data' folder - videos are in 'data/video'
        video_subdir = candidate_path / "video"
        if video_subdir.exists() and video_subdir.is_dir():
            return str(video_subdir)
        
        # Check if provided path already points to 'video' folder
        if candidate_path.name.lower() == "video" and candidate_path.exists():
            return str(candidate_path)
        
        # Use provided path as-is (may fail later if invalid)
        return candidate
    
    # Fallback to environment variable or default path
    return os.getenv(
        "VIDEO_BASE_DIR",
        str(FilePath(__file__).resolve().parents[2] / "data" / "video"),
    )


def _find_video_file(video_dir: FilePath, safe_filename: str) -> FilePath:
    """
    Find video file using exact match first, then case-insensitive fallback.
    
    Args:
        video_dir: Directory to search in
        safe_filename: Sanitized filename to find
        
    Returns:
        Path to the found video file
        
    Raises:
        HTTPException: If file is not found (404) or invalid path (400)
    """
    # Try exact match first
    file_path = video_dir / safe_filename
    
    if file_path.exists():
        return file_path
    
    # Fallback to case-insensitive search
    try:
        all_mp4_files = list(video_dir.glob("*.mp4"))
        normalized_request = safe_filename.lower()
        
        for mp4_file in all_mp4_files:
            if mp4_file.name.lower() == normalized_request:
                return mp4_file
    except Exception:
        pass
    
    # File not found
    raise HTTPException(
        status_code=404,
        detail=f"Video file '{safe_filename}' not found in {video_dir}",
    )


def _stream_file_range(path: str, start: int, end: int) -> Generator[bytes, None, None]:
    """
    Stream a byte range from a file in chunks.
    
    Used for HTTP range requests to support video seeking and partial content delivery.
    
    Args:
        path: Full path to the file
        start: Starting byte position (inclusive)
        end: Ending byte position (inclusive)
        
    Yields:
        Chunks of file data (1MB max per chunk)
    """
    chunk_size = 1024 * 1024  # 1MB chunks
    with open(path, "rb") as f:
        f.seek(start)
        remaining = end - start + 1
        
        while remaining > 0:
            read_size = min(chunk_size, remaining)
            data = f.read(read_size)
            if not data:
                break
            remaining -= len(data)
            yield data


@router.get("/videos/{filename}")
async def get_video(
    request: Request,
    filename: str = Path(..., description="Video filename"),
    data_directory: Optional[str] = None,
):
    """
    Serve video files with support for HTTP range requests (video seeking).
    
    Supports both full file delivery and partial content (206) responses for efficient
    video streaming. Handles filename normalization from CSV references to actual .mp4 files.
    
    Expected filename formats:
    - From CSV: 1st_game_P037_league of legends_03-11-2025_14-49-24_merged.csv
    - Actual file: 1st_game_P037_league of legends_03-11-2025_14-49-24.mp4
    
    Args:
        request: FastAPI request object (for Range header parsing)
        filename: Video filename (can include _merged.csv suffix)
        data_directory: Optional override for video directory location
        
    Returns:
        FileResponse: Full video file (no Range header)
        StreamingResponse: Partial content (with Range header, status 206)
        
    Raises:
        HTTPException 404: Video directory or file not found
        HTTPException 400: Invalid file path
        HTTPException 416: Invalid range request
    """
    # Resolve video directory with fallback logic
    base_directory = _resolve_video_directory(data_directory)
    video_dir = FilePath(base_directory)
    
    # Validate directory exists
    if not video_dir.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Video directory not found: {base_directory}"
        )
    
    # Security: Prevent directory traversal attacks
    safe_filename = os.path.basename(filename)
    
    # Normalize filename (remove CSV suffixes, ensure .mp4 extension)
    safe_filename = _normalize_video_filename(safe_filename)
    
    # Find video file (exact or case-insensitive match)
    file_path = _find_video_file(video_dir, safe_filename)
    
    # Validate it's a file, not a directory
    if not file_path.is_file():
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    # Get file size for range calculations
    file_size = file_path.stat().st_size
    
    # Check if client requested a byte range (for video seeking)
    range_header = request.headers.get("range")
    
    if not range_header:
        # No range request - return full file
        return FileResponse(
            path=str(file_path),
            media_type="video/mp4",
            filename=safe_filename,
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "no-cache"
            },
        )
    
    # Parse Range header: "bytes=start-end"
    try:
        unit, _, range_part = range_header.partition("=")
        if unit != "bytes":
            raise ValueError("Only 'bytes' range unit is supported")
        
        start_str, sep, end_str = range_part.partition("-")
        start = int(start_str) if start_str else 0
        end = int(end_str) if end_str else file_size - 1
        
        # Validate range bounds
        if end >= file_size:
            end = file_size - 1
        if start > end:
            raise ValueError("Invalid range: start > end")
            
    except Exception:
        # Invalid range format - return 416 Range Not Satisfiable
        return Response(status_code=416)
    
    # Calculate content length for this range
    content_length = end - start + 1
    
    # Build response headers for partial content
    headers = {
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Cache-Control": "no-cache",
        "Content-Type": "video/mp4",
    }
    
    # Return partial content (206 status)
    return StreamingResponse(
        _stream_file_range(str(file_path), start, end),
        status_code=206,
        headers=headers
    )