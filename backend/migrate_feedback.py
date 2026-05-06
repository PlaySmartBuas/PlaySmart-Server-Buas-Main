"""
Migration script to add category and error_code columns to feedback table.
Run this script if you have an existing database with feedback data.
For new databases, the columns will be created automatically.
"""

import sqlite3
import os

# Path to the database
db_path = os.path.join(os.path.dirname(__file__), "bget.db")


def migrate():
    """Add category and error_code columns to feedback table if they don't exist"""

    if not os.path.exists(db_path):
        print(
            "Database doesn't exist yet. Columns will be created automatically on first run."
        )
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(feedback)")
        columns = [column[1] for column in cursor.fetchall()]

        # Add category column if it doesn't exist
        if "category" not in columns:
            print("Adding 'category' column to feedback table...")
            cursor.execute("ALTER TABLE feedback ADD COLUMN category TEXT")
            print("✓ Added 'category' column")
        else:
            print("'category' column already exists")

        # Add error_code column if it doesn't exist
        if "error_code" not in columns:
            print("Adding 'error_code' column to feedback table...")
            cursor.execute("ALTER TABLE feedback ADD COLUMN error_code TEXT")
            print("✓ Added 'error_code' column")
        else:
            print("'error_code' column already exists")

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
