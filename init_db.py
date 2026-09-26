import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")
DATABASE_URL = os.getenv("DATABASE_URL")

def init_database():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        print("Initializing database extensions...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb;")

        print("Creating tables...")
        # 1. Users Table (Synced from Auth0)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, 
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # 2. Organizations Table (With email and verification support)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                category TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # 3. Organization Priorities Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organization_priorities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT NOT NULL
            );
        """)

        # 4. Master Topics Table (768 dimensions for Gemini text-embedding-004)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                summary_embedding vector(768),
                alignment_score FLOAT DEFAULT 0.0,
                alignment_rationale TEXT,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        # HNSW Index for vector search performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS topics_embedding_hnsw_idx 
            ON topics USING hnsw (summary_embedding vector_cosine_ops);
        """)

        # 5. Complaints Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                embedding vector(768),
                status TEXT DEFAULT 'pending_review',
                created_at TIMESTAMPTZ DEFAULT now(),
                CONSTRAINT unique_user_topic_complaint UNIQUE (user_id, topic_id)
            );
        """)

        # 6. Complaint Likes Table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_likes (
                complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT now(),
                PRIMARY KEY (complaint_id, user_id)
            );
        """)

        # 7. Complaint Events Table (TimescaleDB Hypertable)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_events (
                time TIMESTAMPTZ NOT NULL,
                complaint_id UUID NOT NULL,
                action_type TEXT NOT NULL
            );
        """)
        
        cursor.execute("""
            SELECT create_hypertable('complaint_events', 'time', if_not_exists => TRUE);
        """)

        print("Database schema successfully initialized!")

    except Exception as e:
        print(f"Error initializing database: {e}")
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_database()