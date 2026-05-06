"""
CRUD operations and authentication for users.
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.models.database_models import UsersDB
from app.models.users import UserCreate
from app.utils.auth import get_password_hash, verify_password


def get_user_by_username(db: Session, username: str) -> Optional[UsersDB]:
    """
    Retrieve a user by their username.

    Args:
        db (Session): SQLAlchemy database session.
        username (str): Username to look up.

    Returns:
        Optional[UsersDB]: User object if found, else None.
    """
    return db.query(UsersDB).filter(UsersDB.username == username).first()


def get_user_by_email(db: Session, email: str) -> Optional[UsersDB]:
    """
    Retrieve a user by their email.

    Args:
        db (Session): SQLAlchemy database session.
        email (str): Email to look up.

    Returns:
        Optional[UsersDB]: User object if found, else None.
    """
    return db.query(UsersDB).filter(UsersDB.email == email).first()


def create_user(db: Session, user: UserCreate) -> UsersDB:
    """
    Create a new user with hashed password and store in the database.

    Args:
        db (Session): SQLAlchemy database session.
        user (UserCreate): Incoming user data.

    Returns:
        UsersDB: The newly created user object.
    """
    hashed_password = get_password_hash(user.password)
    db_user = UsersDB(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role,
        team=user.team,
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user


def authenticate_user(db: Session, username: str, password: str) -> Optional[UsersDB]:
    """
    Authenticate a user with username and password.

    Args:
        db (Session): SQLAlchemy database session.
        username (str): Username of the user.
        password (str): Plain-text password to verify.

    Returns:
        Optional[UsersDB]: User object if authentication succeeds, else None.
    """
    user = get_user_by_username(db, username)
    if not user:
        return None

    if not verify_password(password, str(user.hashed_password)):
        return None

    return user