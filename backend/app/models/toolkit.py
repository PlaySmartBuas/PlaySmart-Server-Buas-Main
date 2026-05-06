"""
Pydantic schemas for toolkit configuration API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# -------------------------------
# Base Schema
# -------------------------------
class ToolkitConfigBase(BaseModel):
    """
    Base schema for toolkit configuration.

    Attributes:
        toolkit_path (Optional[str]): Path to main.bat executable.
        obs_path (Optional[str]): Path to OBS executable.
        tobii_path (Optional[str]): Path to Tobii executable.
        data_directory (Optional[str]): Path to data directory.
    """
    toolkit_path: Optional[str] = None
    obs_path: Optional[str] = None
    tobii_path: Optional[str] = None
    data_directory: Optional[str] = None


# -------------------------------
# Create Schema
# -------------------------------
class ToolkitConfigCreate(ToolkitConfigBase):
    """
    Schema for creating a new toolkit configuration.
    """
    pass


# -------------------------------
# Update Schema
# -------------------------------
class ToolkitConfigUpdate(ToolkitConfigBase):
    """
    Schema for updating an existing toolkit configuration.
    """
    pass


# -------------------------------
# Response Schema
# -------------------------------
class ToolkitConfig(ToolkitConfigBase):
    """
    Schema for returning toolkit configuration in API responses.

    Attributes:
        id (int): Unique identifier of the configuration.
        user_id (int): User ID associated with this configuration.
        created_at (datetime): Timestamp of creation.
        updated_at (Optional[datetime]): Timestamp of last update.
    """
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True