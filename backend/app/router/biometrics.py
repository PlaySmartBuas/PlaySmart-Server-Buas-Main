"""
FastAPI routes for biometric analysis of match files.
"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.services.biometric_processor import get_complete_analysis

router = APIRouter()


# -------------------------------
# Get Match Biometrics
# -------------------------------
@router.get("/match/{filename}")
async def get_match_biometrics(
    filename: str,
    data_directory: Optional[str] = Query(
        None, description="Base data directory path"
    ),
):
    """
    Get biometric analysis for a specific match CSV file.

    Args:
        filename (str): Name of the CSV file, e.g.,
            "2nd_game_P035_league of legends_03-11-2025_15-41-49_merged.csv"
        data_directory (Optional[str]): Base data directory path from toolkit configuration.

    Raises:
        HTTPException: If the CSV file cannot be processed or not found.

    Returns:
        dict: Analysis results for the match.
    """
    result = get_complete_analysis(filename, data_directory)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


# -------------------------------
# Test Endpoint
# -------------------------------
@router.get("/test")
async def test_biometrics():
    """
    Test endpoint to verify CSV loading works.

    Returns:
        dict: Either a message if no CSV files are found or the analysis result of the first CSV.
    """
    import os

    csv_dir = "data/csvs"
    csv_files = [f for f in os.listdir(csv_dir) if f.endswith(".csv")]

    if not csv_files:
        return {"message": f"No CSV files found in {csv_dir}/"}

    result = get_complete_analysis(csv_files[0])
    return result