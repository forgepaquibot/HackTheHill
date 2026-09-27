import os
import requests

from fastapi import (
    FastAPI,
    HTTPException,
    Depends,
    Security,
)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials,
)

from pydantic import BaseModel
from typing import Optional

from jose import jwt
from dotenv import load_dotenv


# ============================================================
# Environment
# ============================================================

load_dotenv()
load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")


# ============================================================
# Database / services
# ============================================================

from database import get_db_connection

from services import (
    process_and_match_complaint,
    sync_or_create_user,
)


# ============================================================
# Auth0 configuration
# ============================================================

AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN")
AUTH0_API_AUDIENCE = os.getenv("AUTH0_API_AUDIENCE")

# ------------------------------------------------------------
# Local development authentication
#
# false = REAL Auth0 authentication is required
# true  = old local bearer-token behavior is allowed
#
# Keep this FALSE when demonstrating the real Auth0 flow.
# ------------------------------------------------------------

ALLOW_LOCAL_DEV_AUTH = (
    os.getenv(
        "ALLOW_LOCAL_DEV_AUTH",
        "false"
    ).lower()
    == "true"
)


# ============================================================
# FastAPI
# ============================================================

app = FastAPI(
    title="Grievance & Accountability API",
    version="1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


security = HTTPBearer()


# ============================================================
# Request models
# ============================================================

class UserRegisterModel(BaseModel):
    id: str
    name: str
    email: str
    email_verified: bool


class ComplaintSubmitModel(BaseModel):
    title: str
    description: str
    category: str


# ============================================================
# Utility
# ============================================================

def _get_row_value(
    row,
    key: str,
    index: int = 0
):
    """
    Supports both dictionary-style and tuple-style
    PostgreSQL rows.
    """

    if row is None:
        return None

    if isinstance(row, dict):
        return row[key]

    try:
        return row[key]

    except (TypeError, KeyError, IndexError):
        return row[index]


# ============================================================
# Authentication / user verification
# ============================================================

def get_verified_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> str:
    """
    Authenticates the current user.

    Production / normal behavior:
        1. Receives an Auth0 access token.
        2. Downloads Auth0's JWKS signing keys.
        3. Verifies the JWT signature.
        4. Verifies the audience.
        5. Verifies the issuer.
        6. Extracts the Auth0 `sub`.
        7. Ensures the user exists and is verified.

    Local development behavior:
        If ALLOW_LOCAL_DEV_AUTH=true, a non-JWT bearer token
        can temporarily be treated as a local user ID.

    IMPORTANT:
        ALLOW_LOCAL_DEV_AUTH should be FALSE when using
        the actual Auth0 authentication flow.
    """

    token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing authorization token."
        )

    user_id = None
    email = ""
    name = ""
    is_verified_claim = False

    # ========================================================
    # REAL AUTH0 JWT
    # ========================================================

    if (
        AUTH0_DOMAIN
        and AUTH0_API_AUDIENCE
        and token.count(".") == 2
    ):

        try:

            # ------------------------------------------------
            # Retrieve Auth0 signing keys
            # ------------------------------------------------

            jwks_url = (
                f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
            )

            jwks_response = requests.get(
                jwks_url,
                timeout=5
            )

            jwks_response.raise_for_status()

            jwks = jwks_response.json()

            # ------------------------------------------------
            # Find JWT signing key
            # ------------------------------------------------

            unverified_header = jwt.get_unverified_header(
                token
            )

            rsa_key = {}

            for key in jwks.get("keys", []):

                if key.get("kid") == unverified_header.get("kid"):

                    rsa_key = {
                        "kty": key["kty"],
                        "kid": key["kid"],
                        "use": key["use"],
                        "n": key["n"],
                        "e": key["e"],
                    }

                    break

            if not rsa_key:

                raise HTTPException(
                    status_code=401,
                    detail=(
                        "Unable to find the Auth0 signing key "
                        "used for this token."
                    )
                )

            # ------------------------------------------------
            # Verify JWT
            # ------------------------------------------------

            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=AUTH0_API_AUDIENCE,
                issuer=f"https://{AUTH0_DOMAIN}/",
            )

            # ------------------------------------------------
            # Extract Auth0 identity
            # ------------------------------------------------

            user_id = payload.get("sub")

            email = payload.get(
                "email",
                ""
            )

            name = payload.get(
                "name",
                email.split("@")[0]
                if email
                else "User"
            )

            is_verified_claim = (
                payload.get(
                    "email_verified",
                    False
                )
                is True
            )

            if not user_id:

                raise HTTPException(
                    status_code=401,
                    detail=(
                        "The Auth0 access token does not "
                        "contain a user ID."
                    )
                )

        except HTTPException:
            raise

        except Exception as error:

            # ------------------------------------------------
            # NEVER silently accept an invalid JWT unless
            # local development authentication is explicitly
            # enabled.
            # ------------------------------------------------

            if not ALLOW_LOCAL_DEV_AUTH:

                raise HTTPException(
                    status_code=401,
                    detail="Invalid Auth0 access token."
                ) from error

            print(
                "WARNING: Auth0 JWT verification failed."
            )
            print(
                "Falling back to local development authentication."
            )
            print(
                repr(error)
            )

            user_id = token

            email = ""
            name = "Verified Citizen"
            is_verified_claim = True

    # ========================================================
    # NON-JWT TOKEN
    # ========================================================

    else:

        if not ALLOW_LOCAL_DEV_AUTH:

            raise HTTPException(
                status_code=401,
                detail=(
                    "A valid Auth0 access token is required."
                )
            )

        # ----------------------------------------------------
        # Old development behavior.
        #
        # This is intentionally only available when:
        #
        # ALLOW_LOCAL_DEV_AUTH=true
        # ----------------------------------------------------

        user_id = token

        email = ""
        name = "Verified Citizen"
        is_verified_claim = True

    # ========================================================
    # Make sure we have a user ID
    # ========================================================

    if not user_id:

        raise HTTPException(
            status_code=401,
            detail="Invalid authorization token."
        )

    # ========================================================
    # Database user verification
    # ========================================================

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            SELECT
                is_verified
            FROM users
            WHERE id = %s;
            """,
            (user_id,)
        )

        row = cursor.fetchone()

        # ----------------------------------------------------
        # First-time authenticated user
        # ----------------------------------------------------

        if not row:

            # For a real Auth0 login, use information obtained
            # from the verified Auth0 token.
            #
            # The fallback values are only relevant when the
            # development authentication mode is enabled.

            sync_email = (
                email
                if email
                else f"{user_id}@example.com"
            )

            sync_name = (
                name
                if name
                else "Verified Citizen"
            )

            sync_or_create_user(
                user_id,
                sync_name,
                sync_email,
                is_verified_claim
            )

            return user_id

        # ----------------------------------------------------
        # Existing user
        # ----------------------------------------------------

        is_verified = _get_row_value(
            row,
            "is_verified",
            0
        )

        if not is_verified:

            raise HTTPException(
                status_code=403,
                detail=(
                    "Email verification required "
                    "to perform this action."
                )
            )

        return user_id

    finally:

        cursor.close()
        conn.close()


# ============================================================
# User registration / synchronization
# ============================================================

@app.post("/api/users/register")
def register_user(
    user: UserRegisterModel,
    authenticated_user_id: str = Depends(
        get_verified_user
    )
):
    """
    Registers or synchronizes the authenticated Auth0 user.

    The browser cannot register another user by simply
    supplying a different ID because the submitted ID must
    match the authenticated Auth0 `sub`.
    """

    # --------------------------------------------------------
    # Make sure the submitted identity matches the
    # authenticated identity.
    # --------------------------------------------------------

    if user.id != authenticated_user_id:

        raise HTTPException(
            status_code=403,
            detail=(
                "The supplied user ID does not match "
                "the authenticated Auth0 user."
            )
        )

    try:

        result = sync_or_create_user(
            authenticated_user_id,
            user.name,
            user.email,
            user.email_verified
        )

        return {
            "status": "success",

            "user_id": _get_row_value(
                result,
                "id",
                0
            ),

            "is_verified": _get_row_value(
                result,
                "is_verified",
                1
            ),
        }

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# ElevenLabs scribe token
# ============================================================

@app.post("/api/scribe-token")
def create_scribe_token():

    api_key = os.getenv(
        "ELEVENLABS_API_KEY"
    )

    if not api_key:

        raise HTTPException(
            status_code=503,
            detail=(
                "ElevenLabs is not configured. "
                "Set ELEVENLABS_API_KEY on the backend."
            ),
        )

    try:

        response = requests.post(
            (
                "https://api.elevenlabs.io/"
                "v1/single-use-token/realtime_scribe"
            ),

            headers={
                "xi-api-key": api_key
            },

            timeout=10,
        )

        response.raise_for_status()

        token = response.json().get(
            "token"
        )

    except requests.HTTPError as error:

        if (
            error.response is not None
            and error.response.status_code in (
                401,
                403
            )
        ):

            raise HTTPException(
                status_code=502,
                detail=(
                    "ElevenLabs rejected the API key "
                    "or its permissions. Check "
                    "ELEVENLABS_API_KEY."
                ),
            ) from error

        raise HTTPException(
            status_code=502,
            detail=(
                "ElevenLabs could not issue "
                "a transcription token."
            ),
        ) from error

    except requests.RequestException as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "ElevenLabs could not issue "
                "a transcription token."
            ),
        ) from error

    except ValueError as error:

        raise HTTPException(
            status_code=502,
            detail=(
                "ElevenLabs returned an invalid "
                "token response."
            ),
        ) from error

    if not token:

        raise HTTPException(
            status_code=502,
            detail=(
                "ElevenLabs returned an invalid "
                "token response."
            ),
        )

    return {
        "token": token
    }


# ============================================================
# Complaint submission
# ============================================================

@app.post("/api/complaints")
def submit_or_edit_complaint(
    payload: ComplaintSubmitModel,
    user_id: str = Depends(
        get_verified_user
    )
):
    """
    Processes a confirmed complaint.

    The service automatically:

    - matches it to an existing topic when possible;
    - updates the user's existing complaint if one exists;
    - otherwise creates a new complaint under the topic;
    - creates a new topic when no match exists.
    """

    print()
    print("==============================")
    print("NEW COMPLAINT REQUEST")
    print("==============================")
    print(f"User ID: {user_id}")
    print(f"Title: {payload.title}")
    print(f"Category: {payload.category}")

    try:

        result = process_and_match_complaint(
            user_id=user_id,
            title=payload.title,
            description=payload.description,
            category=payload.category,
        )

        print("COMPLAINT RESULT:")
        print(result)
        print("==============================")
        print()

        return result

    except ValueError as error:

        raise HTTPException(
            status_code=403,
            detail=str(error)
        )

    except Exception as error:

        print("❌ /api/complaints FAILED:")
        print(repr(error))

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )


# ============================================================
# Like complaint
# ============================================================

@app.post("/api/complaints/{complaint_id}/like")
def like_complaint(
    complaint_id: str,
    user_id: str = Depends(
        get_verified_user
    )
):
    """
    Allows a verified user to like a complaint and records
    the event in TimescaleDB.
    """

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            INSERT INTO complaint_likes (
                complaint_id,
                user_id
            )
            VALUES (%s, %s)
            ON CONFLICT (complaint_id, user_id)
            DO NOTHING;
            """,
            (
                complaint_id,
                user_id
            )
        )

        # ----------------------------------------------------
        # Only create a like event when the like was actually
        # new.
        # ----------------------------------------------------

        if cursor.rowcount > 0:

            cursor.execute(
                """
                INSERT INTO complaint_events (
                    time,
                    complaint_id,
                    action_type
                )
                VALUES (
                    now(),
                    %s,
                    'like'
                );
                """,
                (complaint_id,)
            )

        conn.commit()

        return {
            "status": "success",
            "message": "Complaint liked successfully."
        }

    except Exception as error:

        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        cursor.close()
        conn.close()


# ============================================================
# Community topics
# ============================================================

@app.get("/api/topics")
def get_topics(
    category: Optional[str] = None
):
    """
    Returns community topics from the database.

    Each topic includes the number of complaints/voices
    associated with that topic.
    """

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        query = """
            SELECT
                t.id,
                t.title,
                t.category,
                t.alignment_score,
                t.alignment_rationale,
                t.created_at,
                COUNT(c.id) AS voices
            FROM topics t
            LEFT JOIN complaints c
                ON c.topic_id = t.id
        """

        params = []

        if category:

            query += """
                WHERE t.category = %s
            """

            params.append(category)

        query += """
            GROUP BY
                t.id,
                t.title,
                t.category,
                t.alignment_score,
                t.alignment_rationale,
                t.created_at
            ORDER BY t.created_at DESC;
        """

        cursor.execute(
            query,
            params
        )

        rows = cursor.fetchall()

        topics = []

        for row in rows:

            topics.append({
                "id": str(
                    _get_row_value(
                        row,
                        "id",
                        0
                    )
                ),

                "title": _get_row_value(
                    row,
                    "title",
                    1
                ),

                "category": _get_row_value(
                    row,
                    "category",
                    2
                ),

                "alignment_score": _get_row_value(
                    row,
                    "alignment_score",
                    3
                ),

                "alignment_rationale": _get_row_value(
                    row,
                    "alignment_rationale",
                    4
                ),

                "created_at": str(
                    _get_row_value(
                        row,
                        "created_at",
                        5
                    )
                ),

                "voices": int(
                    _get_row_value(
                        row,
                        "voices",
                        6
                    ) or 0
                ),

                "isDatabaseTopic": True,
            })

        return topics

    except Exception as error:

        print("❌ /api/topics FAILED:")
        print(repr(error))

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        cursor.close()
        conn.close()


# ============================================================
# Trending topics
# ============================================================

@app.get("/api/trending")
def get_trending_topics(
    category: Optional[str] = None
):
    """
    Returns the most active topics from the previous 24 hours.
    """

    conn = get_db_connection()
    cursor = conn.cursor()

    try:

        query = """
            SELECT
                t.id,
                t.title,
                t.category,
                t.alignment_score,
                t.alignment_rationale,
                COUNT(ce.complaint_id) AS activity_count
            FROM topics t
            JOIN complaints c
                ON c.topic_id = t.id
            JOIN complaint_events ce
                ON ce.complaint_id = c.id
            WHERE ce.time >= NOW() - INTERVAL '24 hours'
        """

        params = []

        if category:

            query += """
                AND t.category = %s
            """

            params.append(category)

        query += """
            GROUP BY
                t.id,
                t.title,
                t.category,
                t.alignment_score,
                t.alignment_rationale
            ORDER BY activity_count DESC
            LIMIT 10;
        """

        cursor.execute(
            query,
            params
        )

        return cursor.fetchall()

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    finally:

        cursor.close()
        conn.close()