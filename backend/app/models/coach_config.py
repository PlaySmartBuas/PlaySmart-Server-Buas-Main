"""
Database model and Pydantic schemas for coach configuration.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func

from app.database import Base


# -------------------------------
# SQLAlchemy Database Model
# -------------------------------
class CoachConfigDB(Base):
    """
    SQLAlchemy model representing a user's coach configuration.

    Attributes:
        id (int): Primary key.
        user_id (int): Foreign key referencing the user.
        data_directory (str, optional): Path to the data directory.
        created_at (datetime): Timestamp when the record was created.
        updated_at (datetime, optional): Timestamp when the record was last updated.
    """
    __tablename__ = "coach_configs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    data_directory = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# -------------------------------
# Pydantic Schemas
# -------------------------------
class CoachConfigBase(BaseModel):
    """
    Base schema for coach configuration.
    """
    data_directory: Optional[str] = None


class CoachConfigCreate(CoachConfigBase):
    """
    Schema for creating a new coach configuration.
    """
    pass


class CoachConfigUpdate(CoachConfigBase):
    """
    Schema for updating an existing coach configuration.
    """
    pass


class CoachConfig(CoachConfigBase):
    """
    Pydantic schema for API responses representing a coach configuration.

    Attributes:
        id (int): Record ID.
        user_id (int): User ID associated with this configuration.
        created_at (datetime): Timestamp of creation.
        updated_at (datetime, optional): Timestamp of last update.
    """
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        orm_mode = True