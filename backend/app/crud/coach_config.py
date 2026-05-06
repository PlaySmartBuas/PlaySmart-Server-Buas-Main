"""
CRUD operations for coach configuration.
"""

from sqlalchemy.orm import Session

from app.models.coach_config import CoachConfigDB, CoachConfigUpdate


def get_coach_config_by_user(db: Session, user_id: int):
    """
    Retrieve a coach configuration for a given user.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.

    Returns:
        CoachConfigDB | None: The coach configuration if found, otherwise None.
    """
    return (
        db.query(CoachConfigDB)
        .filter(CoachConfigDB.user_id == user_id)
        .first()
    )


def create_coach_config(db: Session, user_id: int, config: CoachConfigUpdate):
    """
    Create and persist a new coach configuration for a user.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.
        config (CoachConfigUpdate): Incoming configuration data.

    Returns:
        CoachConfigDB: The newly created coach configuration.
    """
    db_config = CoachConfigDB(
        user_id=user_id,
        data_directory=config.data_directory,
    )

    db.add(db_config)
    db.commit()
    db.refresh(db_config)

    return db_config


def update_coach_config(db: Session, user_id: int, config: CoachConfigUpdate):
    """
    Update an existing coach configuration or create one if it does not exist.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.
        config (CoachConfigUpdate): Updated configuration data.

    Returns:
        CoachConfigDB: The updated or newly created coach configuration.
    """
    db_config = get_coach_config_by_user(db, user_id)

    if db_config:
        # Update existing configuration
        if config.data_directory is not None:
            db_config.data_directory = config.data_directory #type:ignore

        db.commit()
        db.refresh(db_config)
        return db_config

    # Create new configuration if it does not exist
    return create_coach_config(db, user_id, config)


def delete_coach_config(db: Session, user_id: int):
    """
    Delete a coach configuration for a given user.

    Args:
        db (Session): SQLAlchemy database session.
        user_id (int): ID of the user.

    Returns:
        bool: True if a configuration was deleted, otherwise False.
    """
    db_config = get_coach_config_by_user(db, user_id)

    if db_config:
        db.delete(db_config)
        db.commit()
        return True

    return False