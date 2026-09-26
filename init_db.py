import os
from dotenv import load_dotenv
import psycopg2

# 1. Load variables from environment file
# If your env file has a specific name like 'tiger-cloud-ripple-credentials.env', pass it to load_dotenv()
load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env") 

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment variables!")

def init_db():
    print("Connecting to Tiger Cloud...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True  # Required for CREATE EXTENSION
    cursor = conn.cursor()

    try:
        # 2. Enable Required Extensions
        print("Enabling extensions (TimescaleDB & pgvector)...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        # 3. Create Core Relational Tables
        print("Creating organizations and complaints tables...")
        
        # Organizations (Companies, Government agencies, Politicians)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                category TEXT NOT NULL, -- e.g., 'government', 'corporation'
                is_verified BOOLEAN DEFAULT false
            );
        """)

        # Complaints Table (Relational + JSONB + Vector)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                org_id UUID REFERENCES organizations(id),
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                embedding vector(1536), -- Vector embedding for AI similarity matching
                status TEXT DEFAULT 'pending_review',
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # HNSW Index for fast AI similarity searches
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS complaints_embedding_hnsw_idx 
            ON complaints USING hnsw (embedding vector_cosine_ops);
        """)

        # 4. Create Event Stream Table for Trending Analytics
        print("Creating complaint events hypertable...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_events (
                time TIMESTAMPTZ NOT NULL,
                complaint_id UUID REFERENCES complaints(id),
                action_type TEXT NOT NULL -- e.g., 'created', 'upvoted', 'viewed'
            );
        """)

        # Convert to Timescale Hypertable if not already converted
        cursor.execute("""
            SELECT create_hypertable('complaint_events', 'time', if_not_exists => TRUE);
        """)

        print("Database initialized successfully!")

    except Exception as e:
        print(f"Error initializing database: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_db()