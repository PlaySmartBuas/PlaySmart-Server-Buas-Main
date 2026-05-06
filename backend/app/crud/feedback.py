"""
CRUD operations for feedback entries.
"""

from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.database_models import Feedback
from app.models.feedback import FeedbackCreate


def create_feedback(db: Session, feedback: FeedbackCreate) -> Feedback:
    """
    Create a new feedback entry in the database.

    Args:
        db (Session): SQLAlchemy database session.
        feedback (FeedbackCreate): Feedback data to be stored.

    Returns:
        Feedback: The newly created feedback entry.
    """
    db_feedback = Feedback(
        riot_id=feedback.riot_id,
        coach_username=feedback.coach_username,
        match_id=feedback.match_id,
        timestamp=feedback.timestamp,
        category=feedback.category,
        error_code=feedback.error_code,
        feedback_text=feedback.feedback_text,
        game=feedback.game,
    )

    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)

    return db_feedback


def get_feedback_by_riot_id(
    db: Session, riot_id: str, game: str, match_id: Optional[str] = None
) -> List[Feedback]:
    """
    Retrieve all feedback for a specific riot_id and game, optionally filtered by match_id.

    Args:
        db (Session): SQLAlchemy database session.
        riot_id (str): Riot ID of the player.
        game (str): Name of the game.
        match_id (Optional[str]): Optional match ID to filter by.

    Returns:
        List[Feedback]: List of feedback entries ordered by timestamp ascending.
    """
    query = db.query(Feedback).filter(Feedback.riot_id == riot_id, Feedback.game == game)

    if match_id:
        query = query.filter(Feedback.match_id == match_id)

    return query.order_by(Feedback.timestamp.asc()).all()


def delete_feedback(db: Session, feedback_id: int) -> bool:
    """
    Delete a feedback entry by its ID.

    Args:
        db (Session): SQLAlchemy database session.
        feedback_id (int): ID of the feedback to delete.

    Returns:
        bool: True if the feedback was deleted, False if it was not found.
    """
    feedback = db.query(Feedback).filter(Feedback.id == feedback_id).first()

    if feedback:
        db.delete(feedback)
        db.commit()
        return True

    return False


def get_feedback_by_id(db: Session, feedback_id: int) -> Optional[Feedback]:
    """
    Retrieve a single feedback entry by its ID.

    Args:
        db (Session): SQLAlchemy database session.
        feedback_id (int): ID of the feedback to retrieve.

    Returns:
        Feedback | None: The feedback entry if found, otherwise None.
    """
    return db.query(Feedback).filter(Feedback.id == feedback_id).first()