"""
SQLAlchemy database models for users, feedback, and toolkit configuration.
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


# -------------------------------
# Users Table
# -------------------------------
class UsersDB(Base):
    """
    SQLAlchemy model representing a user.

    Attributes:
        id (int): Primary key.
        username (str): Unique username.
        email (str): Unique email address.
        hashed_password (str): Hashed password.
        role (str): User role.
        team (str): User's team name.
        created_at (datetime): Record creation timestamp.
        updated_at (datetime, optional): Record update timestamp.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=False)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False)
    team = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# -------------------------------
# Feedback Table
# -------------------------------
class Feedback(Base):
    """
    SQLAlchemy model representing feedback submitted by users.

    Attributes:
        id (int): Primary key.
        riot_id (str): Riot player ID.
        coach_username (str): Coach's username.
        match_id (str, optional): Match/video identifier.
        timestamp (float): Video timestamp in seconds.
        category (str, optional): Error category (Vision, Behavioral, etc.).
        error_code (str, optional): Specific error code.
        feedback_text (str): Feedback content.
        game (str): Game name ('valorant' or 'lol').
        created_at (datetime): Record creation timestamp.
    """
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    riot_id = Column(String, nullable=False, index=True)
    coach_username = Column(String, nullable=False)
    match_id = Column(String, nullable=True, index=True)
    timestamp = Column(Float, nullable=False)
    category = Column(String, nullable=True)
    error_code = Column(String, nullable=True)
    feedback_text = Column(Text, nullable=False)
    game = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# -------------------------------
# Toolkit Configuration Table
# -------------------------------
class ToolkitConfig(Base):
    """
    SQLAlchemy model representing a user's toolkit configuration.

    Attributes:
        id (int): Primary key.
        user_id (int): ID of the user (Foreign key to Users table).
        toolkit_path (str, optional): Path to main.bat.
        obs_path (str, optional): Path to OBS executable.
        tobii_path (str, optional): Path to Tobii executable.
        data_directory (str, optional): Path to data directory.
        created_at (datetime): Record creation timestamp.
        updated_at (datetime, optional): Record update timestamp.
    """
    __tablename__ = "toolkit_config"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    toolkit_path = Column(String, nullable=True)
    obs_path = Column(String, nullable=True)
    tobii_path = Column(String, nullable=True)
    data_directory = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())