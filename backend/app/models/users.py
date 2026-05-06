"""
Pydantic schemas for user management and authentication.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, EmailStr


# -------------------------------
# User Roles
# -------------------------------
class UserRole(str, Enum):
    """
    Enumeration of possible user roles.
    """
    PLAYER = "player"
    COACH = "coach"


# -------------------------------
# Base User Schema
# -------------------------------
class UserBase(BaseModel):
    """
    Base schema for user information.

    Attributes:
        username (str): Username of the user.
        email (EmailStr): User's email address.
        role (UserRole): Role of the user (player or coach).
        team (str): Team the user belongs to.
    """
    username: str
    email: EmailStr
    role: UserRole
    team: str


# -------------------------------
# Create User Schema
# -------------------------------
class UserCreate(UserBase):
    """
    Schema for creating a new user.

    Attributes:
        password (str): Plain-text password for the user.
    """
    password: str


# -------------------------------
# Response User Schema
# -------------------------------
class User(UserBase):
    """
    Schema for returning user information in API responses.

    Attributes:
        id (int): Unique user ID.
        created_at (Optional[datetime]): Account creation timestamp.
    """
    id: int
    created_at: Optional[datetime] = None

    class Config:
        orm_mode = True


# -------------------------------
# User Login Schema
# -------------------------------
class UserLogin(BaseModel):
    """
    Schema for user login.

    Attributes:
        username (str): Username of the user.
        password (str): Plain-text password.
    """
    username: str
    password: str


# -------------------------------
# Token Schema
# -------------------------------
class Token(BaseModel):
    """
    Schema for access token responses.

    Attributes:
        access_token (str): JWT or access token string.
        token_type (str): Type of token (e.g., "bearer").
        user (User): User information associated with the token.
    """
    access_token: str
    token_type: str
    user: User