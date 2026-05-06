"""
Pydantic schemas for feedback API.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# -------------------------------
# Base Schema
# -------------------------------
class FeedbackBase(BaseModel):
    """
    Base schema for feedback entries.

    Attributes:
        riot_id (str): Riot player ID.
        coach_username (str): Coach's username.
        match_id (Optional[str]): Optional match/video identifier.
        timestamp (float): Video timestamp in seconds.
        category (Optional[str]): Error category (Vision, Behavioral, etc.).
        error_code (Optional[str]): Specific error code.
        feedback_text (str): Feedback content.
        game (str): Game name ('valorant' or 'lol').
    """
    riot_id: str
    coach_username: str
    match_id: Optional[str] = None
    timestamp: float
    category: Optional[str] = None
    error_code: Optional[str] = None
    feedback_text: str
    game: str


# -------------------------------
# Create Schema
# -------------------------------
class FeedbackCreate(FeedbackBase):
    """
    Schema for creating a new feedback entry.
    """
    pass


# -------------------------------
# Response Schema
# -------------------------------
class FeedbackResponse(FeedbackBase):
    """
    Schema for returning feedback in API responses.

    Attributes:
        id (int): Unique identifier of the feedback.
        created_at (datetime): Timestamp of creation.
    """
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True  # For Pydantic v2 compatibility