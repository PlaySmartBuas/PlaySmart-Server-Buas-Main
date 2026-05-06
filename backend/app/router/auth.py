"""
FastAPI routes for user signup and login.
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.crud import users as user_crud
from app.database import get_db
from app.models.users import UserLogin, Token, User, UserCreate
from app.utils.auth import create_access_token

router = APIRouter()


# -------------------------------
# Signup Endpoint
# -------------------------------
@router.post("/signup", response_model=User, status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, db: Session = Depends(get_db)):
    """
    Register a new user.

    Args:
        user (UserCreate): User registration data.
        db (Session, optional): Database session dependency.

    Raises:
        HTTPException: If username or email is already registered.

    Returns:
        User: Newly created user object.
    """
    # Check if username is already taken
    db_user = user_crud.get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email is already registered
    db_user = user_crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Create new user
    new_user = user_crud.create_user(db=db, user=user)
    return User.from_orm(new_user)


# -------------------------------
# Login Endpoint
# -------------------------------
@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate a user and generate an access token.

    Args:
        credentials (UserLogin): Username and password for login.
        db (Session, optional): Database session dependency.

    Raises:
        HTTPException: If authentication fails.

    Returns:
        Token: Access token and user information.
    """
    user = user_crud.authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token = create_access_token(
        data={
            "sub": user.username,
            "role": user.role,
            "user_id": user.id
        }
    )

    user_data = User.from_orm(user)

    return Token(
        access_token=access_token,
        token_type="bearer",
        user=user_data
    )