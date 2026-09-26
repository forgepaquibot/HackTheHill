import os
from dotenv import load_dotenv
import psycopg2

# 1. Load variables from environment file
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
        print("Creating core application tables...")
        
        # Organizations Table (Companies, Government agencies, Politicians)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                category TEXT NOT NULL, -- e.g., 'government', 'campaign', 'corporation'
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # Users Table (People submitting complaints and voting)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # Topics Table (Contains topics created by AI or organizations + Vector Embedding)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL, -- e.g., 'government', 'corporation'
                summary_embedding vector(1536), -- Enables AI matchmaking directly against topics
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # HNSW Index for fast AI topic matching
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS topics_embedding_hnsw_idx 
            ON topics USING hnsw (summary_embedding vector_cosine_ops);
        """)

        # Complaints Table (Relational + JSONB + Vector)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                embedding vector(1536), -- Vector embedding for AI similarity matching
                status TEXT DEFAULT 'pending_review',
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # HNSW Index for fast complaint similarity searches
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS complaints_embedding_hnsw_idx 
            ON complaints USING hnsw (embedding vector_cosine_ops);
        """)

        # 4. Social Interactions & Executive Tools
        print("Creating voting and response tables...")

        # Complaint Votes Table (1 Upvote per User per Complaint)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_votes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT now(),
                UNIQUE(complaint_id, user_id)
            );
        """)

        # Official Executive Responses Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS official_responses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
                org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                responder_id UUID REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # 5. TimescaleDB Event Stream (Trending Metrics)
        print("Creating complaint events hypertable...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_events (
                time TIMESTAMPTZ NOT NULL,
                complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL -- e.g., 'created', 'upvoted', 'viewed'
            );
        """)

        # Convert to Timescale Hypertable
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