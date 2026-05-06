"""
CRUD operations for toolkit configuration.
"""

from typing import Optional
from sqlalchemy.orm import Session

from app.models.database_models import ToolkitConfig
from app.models.toolkit import ToolkitConfigCreate, ToolkitConfigUpdate


def get_toolkit_config_by_user(db: Session, user_id: int) -> Optional[ToolkitConfig]:
    """
    Retrieve the toolkit configuration for a specific user.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.

    Returns:
        Optional[ToolkitConfig]: The user's toolkit configuration if it exists, otherwise None.
    """
    return db.query(ToolkitConfig).filter(ToolkitConfig.user_id == user_id).first()


def create_toolkit_config(
    db: Session, user_id: int, config: ToolkitConfigCreate
) -> ToolkitConfig:
    """
    Create a new toolkit configuration for a user.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.
        config (ToolkitConfigCreate): Configuration data to create.

    Returns:
        ToolkitConfig: The newly created toolkit configuration.
    """
    db_config = ToolkitConfig(
        user_id=user_id,
        toolkit_path=config.toolkit_path,
        obs_path=config.obs_path,
        tobii_path=config.tobii_path,
        data_directory=config.data_directory,
    )

    db.add(db_config)
    db.commit()
    db.refresh(db_config)

    return db_config


def update_toolkit_config(
    db: Session, user_id: int, config: ToolkitConfigUpdate
) -> Optional[ToolkitConfig]:
    """
    Update an existing toolkit configuration for a user, or create one if it does not exist.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.
        config (ToolkitConfigUpdate): Configuration data to update.

    Returns:
        Optional[ToolkitConfig]: The updated or newly created toolkit configuration.
    """
    db_config = get_toolkit_config_by_user(db, user_id)

    if not db_config:
        # Create new configuration if none exists
        return create_toolkit_config(db, user_id, ToolkitConfigCreate(**config.dict()))

    # Update only provided fields
    update_data = config.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_config, field, value)

    db.commit()
    db.refresh(db_config)

    return db_config