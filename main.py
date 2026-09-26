import os
import requests
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
from jose import jwt
from dotenv import load_dotenv
from database import get_db_connection
from services import process_and_match_complaint, sync_or_create_user

load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")

app = FastAPI(title="Grievance & Accountability API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
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
    force_submit: bool = False

def get_verified_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    Decodes and validates Auth0 RS256 JWT using Auth0 Domain & Audience API variables,
    then confirms user verification status in Tiger Data.
    """
    token = credentials.credentials
    try:
        jwks_url = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
        jwks = requests.get(jwks_url).json()
        
        unverified_header = jwt.get_unverified_header(token)
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key.get("kid") == unverified_header.get("kid"):
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
        
        if not rsa_key:
            raise HTTPException(status_code=401, detail="Invalid token public key ID (kid).")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=AUTH0_API_AUDIENCE,
            issuer=f"https://{AUTH0_DOMAIN}/"
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Token missing subject (sub) claim.")

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT is_verified FROM users WHERE id = %s;", (user_id,))
            row = cursor.fetchone()
            if not row:
                # Auto-sync user if they exist in Auth0 token but not yet registered in DB
                email = payload.get("email", "")
                name = payload.get("name", email.split("@")[0] if email else "User")
                is_verified = payload.get("email_verified", False)
                sync_or_create_user(user_id, name, email, is_verified)
                return user_id

            if not row['is_verified']:
                raise HTTPException(status_code=403, detail="Email verification required to perform this action.")
            
            return user_id
        finally:
            cursor.close()
            conn.close()

    except jwt.JWTError as e:
        raise HTTPException(status_code=401, detail=f"JWT validation error: {str(e)}")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/users/register")
def register_user(user: UserRegisterModel):
    """Registers or syncs an Auth0 user into Tiger Data with their email verification status."""
    try:
        result = sync_or_create_user(user.id, user.name, user.email, user.email_verified)
        return {"status": "success", "user_id": result['id'], "is_verified": result['is_verified']}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/complaints")
def submit_or_edit_complaint(payload: ComplaintSubmitModel, user_id: str = Depends(get_verified_user)):
    """Submits or updates a complaint using AI matchmaking backend services."""
    try:
        result = process_and_match_complaint(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
            force_submit=payload.force_submit
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=403, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/complaints/{complaint_id}/like")
def like_complaint(complaint_id: str, user_id: str = Depends(get_verified_user)):
    """Allows a verified user to upvote a complaint and logs it to TimescaleDB."""
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO complaint_likes (complaint_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT (complaint_id, user_id) DO NOTHING;
        """, (complaint_id, user_id))
        
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
    """Fetches trending topics using TimescaleDB hypertable event metrics."""
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