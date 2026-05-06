"""
FastAPI routes for managing coach configuration, including
selecting data directory and CRUD operations.
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.crud import coach_config as coach_crud
from app.database import get_db
from app.models.coach_config import CoachConfig, CoachConfigUpdate
from app.utils.auth import get_current_user_id

router = APIRouter()

# -------------------------------
# Select Data Directory
# -------------------------------
@router.get("/select-data-directory")
async def select_data_directory():
    """
    Directory picker is not supported in server deployments.
    Use the save config endpoint with a manual path instead.
    """
    raise HTTPException(
        status_code=501,
        detail="Directory picker is not available in server mode. Please provide the path manually via the config endpoint."
    )

# -------------------------------
# Get Coach Configuration
# -------------------------------
@router.get("/config", response_model=CoachConfig)
async def get_coach_config(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    config = coach_crud.get_coach_config_by_user(db, user_id)
    if not config:
        raise HTTPException(status_code=404, detail="Coach configuration not found")
    return config

# -------------------------------
# Save or Update Coach Configuration
# -------------------------------
@router.post("/config", response_model=CoachConfig)
async def save_coach_config(
    config: CoachConfigUpdate,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    updated_config = coach_crud.update_coach_config(db, user_id, config)
    return updated_config

# -------------------------------
# Delete Coach Configuration
# -------------------------------
@router.delete("/config")
async def delete_coach_config(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    deleted = coach_crud.delete_coach_config(db, user_id)
    if deleted:
        return {"success": True, "message": "Coach configuration deleted"}
    raise HTTPException(status_code=404, detail="Coach configuration not found")