import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")
DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in environment variables.")
    # RealDictCursor fetches rows as dictionaries for easy FastAPI serialization
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    return conn