from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from database import get_db_connection
from services import process_complaint_service

app = FastAPI(title="Grievance & Accountability API", version="1.0")

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust to your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

class UserRegisterModel(BaseModel):
    id: str  
    name: str
    email: str
    email_verified: bool

class ComplaintSubmitModel(BaseModel):
    title: str
    description: str
    category: str

def get_verified_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """Extracts bearer token (Auth0 ID) and strictly verifies that the user's email is verified in Tiger Data."""
    user_id = credentials.credentials
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT is_verified FROM users WHERE id = %s;", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="User not registered in database.")
        if not row['is_verified']:
            raise HTTPException(status_code=403, detail="Email verification required to perform this action.")
        return user_id
    finally:
        cursor.close()
        conn.close()

@app.post("/api/users/register")
def register_user(user: UserRegisterModel):
    """Registers or syncs an Auth0 user into Tiger Data with their email verification status."""
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO users (id, name, email, is_verified)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE 
            SET name = EXCLUDED.name, 
                email = EXCLUDED.email,
                is_verified = EXCLUDED.is_verified
            RETURNING id, is_verified;
        """, (user.id, user.name, user.email, user.email_verified))
        
        row = cursor.fetchone()
        return {"status": "success", "user_id": row['id'], "is_verified": row['is_verified']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.post("/api/complaints")
def submit_or_edit_complaint(payload: ComplaintSubmitModel, user_id: str = Depends(get_verified_user)):
    """Submits or updates a complaint. Requires a verified user session."""
    try:
        result = process_complaint_service(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            category=payload.category
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=403, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/complaints/{complaint_id}/like")
def like_complaint(complaint_id: str, user_id: str = Depends(get_verified_user)):
    """Allows a verified user to like/upvote a complaint."""
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO complaint_likes (complaint_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT (complaint_id, user_id) DO NOTHING;
        """, (complaint_id, user_id))
        
        # Log event in hypertable for trending analysis
        cursor.execute("""
            INSERT INTO complaint_events (time, complaint_id, action_type)
            VALUES (now(), %s, 'like');
        """, (complaint_id,))
        
        return {"status": "success", "message": "Complaint liked successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/trending")
def get_trending_topics(category: Optional[str] = None):
    """Fetches trending topics using TimescaleDB event metrics (publicly viewable)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = """
            SELECT t.id, t.title, t.category, t.alignment_score, t.alignment_rationale, COUNT(ce.complaint_id) as activity_count
            FROM topics t
            JOIN complaints c ON c.topic_id = t.id
            JOIN complaint_events ce ON ce.complaint_id = c.id
            WHERE ce.time >= NOW() - INTERVAL '24 hours'
        """
        params = []
        if category:
            query += " AND t.category = %s"
            params.append(category)
        
        query += " GROUP BY t.id ORDER BY activity_count DESC LIMIT 10;"
        
        cursor.execute(query, params)
        return cursor.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()