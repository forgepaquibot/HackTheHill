import os
from dotenv import load_dotenv
import psycopg2
from database import get_db_connection

load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env") 
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL not found in environment variables!")

def init_db():
    print("Connecting to Tiger Cloud...")
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        print("Enabling extensions (TimescaleDB & pgvector)...")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;")
        cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")

        print("Creating core application tables...")
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organizations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                category TEXT NOT NULL,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS organization_priorities (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                is_verified BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS topics (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                summary_embedding vector(768), 
                alignment_score FLOAT DEFAULT NULL,
                alignment_rationale TEXT DEFAULT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS topics_embedding_hnsw_idx 
            ON topics USING hnsw (summary_embedding vector_cosine_ops);
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaints (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                org_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
                topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                details JSONB DEFAULT '{}'::jsonb,
                embedding vector(768), 
                status TEXT DEFAULT 'pending_review',
                created_at TIMESTAMPTZ DEFAULT now(),
                UNIQUE(user_id, topic_id) 
            );
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_likes (
                complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
                user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT now(),
                PRIMARY KEY (complaint_id, user_id)
            );
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS complaints_embedding_hnsw_idx 
            ON complaints USING hnsw (embedding vector_cosine_ops);
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS official_responses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                complaint_id UUID NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
                org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
                responder_id TEXT REFERENCES users(id) ON DELETE SET NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT now()
            );
        """)

        print("Creating complaint events hypertable...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS complaint_events (
                time TIMESTAMPTZ NOT NULL,
                complaint_id UUID REFERENCES complaints(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL 
            );
        """)

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