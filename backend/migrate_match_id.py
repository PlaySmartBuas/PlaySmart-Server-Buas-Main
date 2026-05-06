"""
Migration script to add match_id column to feedback table.
Run this script if you have an existing database with feedback data.
For new databases, the column will be created automatically.
"""

import sqlite3
import os

# Path to the database
db_path = os.path.join(os.path.dirname(__file__), "bget.db")


def migrate():
    """Add match_id column to feedback table if it doesn't exist"""

    if not os.path.exists(db_path):
        print(
            "Database doesn't exist yet. Column will be created automatically on first run."
        )
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if column already exists
        cursor.execute("PRAGMA table_info(feedback)")
        columns = [column[1] for column in cursor.fetchall()]

        # Add match_id column if it doesn't exist
        if "match_id" not in columns:
            print("Adding 'match_id' column to feedback table...")
            cursor.execute("ALTER TABLE feedback ADD COLUMN match_id TEXT")
            print("✓ Added 'match_id' column")

            # Create index for better query performance
            print("Creating index on match_id column...")
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_feedback_match_id ON feedback(match_id)"
            )
            print("✓ Created index on match_id")
        else:
            print("'match_id' column already exists")

        conn.commit()
        print("\n✅ Migration completed successfully!")

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
    finally:
        conn.close()


if __name__ == "__main__":
    print("🔄 Starting database migration...\n")
    migrate()
