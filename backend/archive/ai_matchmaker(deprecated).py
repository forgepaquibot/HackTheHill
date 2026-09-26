import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load Environment Variables
load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")

DATABASE_URL = os.getenv("DATABASE_URL")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not DATABASE_URL or not GEMINI_API_KEY:
    raise ValueError("Missing DATABASE_URL or GEMINI_API_KEY in environment!")

# Initialize Gemini Client
client = genai.Client(api_key=GEMINI_API_KEY)

SIMILARITY_THRESHOLD = 0.75  # Cosine similarity threshold (0.0 to 1.0)


def get_gemini_embedding(text: str) -> list[float]:
    """Generates a 768-dimensional vector embedding using Google Gemini."""
    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return response.embeddings[0].values


def get_or_create_user(cursor, auth0_id: str, email: str, name: str, email_verified: bool = False) -> str:
    """
    Syncs an Auth0 user with the Tiger Data database, updating verification status if needed.
    """
    cursor.execute("SELECT id, is_verified FROM users WHERE auth0_id = %s;", (auth0_id,))
    row = cursor.fetchone()

    if row:
        if row['is_verified'] != email_verified:
            cursor.execute("UPDATE users SET is_verified = %s WHERE auth0_id = %s;", (email_verified, auth0_id))
        return str(row['id'])

    cursor.execute("""
        INSERT INTO users (auth0_id, email, name, is_verified)
        VALUES (%s, %s, %s, %s)
        RETURNING id;
    """, (auth0_id, email, name, email_verified))
    
    new_user = cursor.fetchone()
    return str(new_user['id'])


def evaluate_topic_alignment(cursor, topic_id: str, org_id: str, topic_title: str):
    """
    Evaluates how much a topic aligns with an organization's stated priorities using Gemini 2.5 Flash.
    """
    cursor.execute("""
        SELECT title, description FROM organization_priorities 
        WHERE org_id = %s;
    """, (org_id,))
    priorities = cursor.fetchall()

    if not priorities:
        print("No stated priorities found for this organization. Skipping alignment.")
        return

    priorities_text = "\n".join([f"- {p['title']}: {p['description']}" for p in priorities])

    prompt = f"""
    You are an objective policy and corporate accountability analyst.
    
    Target Organization's Stated Priorities / Targets:
    {priorities_text}
    
    Master Public Complaint Topic:
    "{topic_title}"
    
    Task:
    Evaluate how strongly this complaint topic contradicts or targets the organization's stated priorities.
    Provide:
    1. A score from 0.0 to 1.0 (where 1.0 means complete direct failure/contradiction of their stated goals, and 0.0 means completely unrelated).
    2. A brief 1-sentence rationale explaining the alignment score.

    Return ONLY a valid JSON object with keys:
    - "alignment_score": float
    - "alignment_rationale": string
    """

    gemini_response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        )
    )

    result = json.loads(gemini_response.text)
    score = result.get("alignment_score", 0.0)
    rationale = result.get("alignment_rationale", "")

    cursor.execute("""
        UPDATE topics 
        SET alignment_score = %s, alignment_rationale = %s
        WHERE id = %s;
    """, (score, rationale, topic_id))

    print(f"Evaluated Alignment for Topic {topic_id}: {score:.2%} - {rationale}")


def process_and_match_complaint(
    auth0_id: str,
    email: str,
    name: str,
    email_verified: bool,
    title: str, 
    description: str, 
    category: str, 
    force_submit: bool = False
):
    """
    1. Syncs Auth0 user to Tiger Data and checks email verification.
    2. Embeds the complaint with Gemini text-embedding-004.
    3. Runs pgvector similarity search against existing topics in Tiger Data.
    4. If similarity >= 0.75 and force_submit is False, halts and returns match info.
    5. Saves complaint and logs event to Timescale Hypertable.
    """
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Step 0: Resolve Auth0 user and check verification status
        user_id = get_or_create_user(cursor, auth0_id, email, name, email_verified)

        if not email_verified:
            print(f"Submission blocked: User {auth0_id} has an unverified email.")
            return {
                "status": "forbidden",
                "message": "You must verify your email address before submitting a complaint."
            }

        full_text = f"{title}\n{description}"
        print(f"\nProcessing complaint for verified user {auth0_id}: '{title}' (force_submit={force_submit})...")

        # Step 1: Get Embedding
        embedding = get_gemini_embedding(full_text)
        embedding_str = str(embedding)

        # Step 2: Search existing topics using Cosine Distance (<=> operator)
        cursor.execute("""
            SELECT id, title, (1 - (summary_embedding <=> %s::vector)) AS similarity
            FROM topics
            WHERE category = %s AND (1 - (summary_embedding <=> %s::vector)) >= %s
            ORDER BY summary_embedding <=> %s::vector ASC
            LIMIT 1;
        """, (embedding_str, category, embedding_str, SIMILARITY_THRESHOLD, embedding_str))

        matched_topic = cursor.fetchone()

        # Step 3: Handle Matched Topic Scenario
        if matched_topic:
            topic_id = matched_topic['id']
            similarity_pct = float(matched_topic['similarity'])
            print(f"Matched to Existing Topic: '{matched_topic['title']}' (Similarity: {similarity_pct:.2%})")

            cursor.execute("""
                SELECT COUNT(id) AS complaint_count 
                FROM complaints 
                WHERE topic_id = %s;
            """, (topic_id,))
            stats = cursor.fetchone()
            complaint_count = stats['complaint_count'] if stats else 0

            if not force_submit:
                print("Similarity threshold met. Returning 'similar_found' for user choice...")
                return {
                    "status": "similar_found",
                    "message": "A matching topic already exists.",
                    "topic_id": topic_id,
                    "topic_title": matched_topic['title'],
                    "similarity": round(similarity_pct, 4),
                    "existing_complaints_count": complaint_count
                }

            cursor.execute("""
                SELECT id FROM complaints 
                WHERE user_id = %s AND topic_id = %s;
            """, (user_id, topic_id))
            
            existing_complaint = cursor.fetchone()
            if existing_complaint:
                print("User already submitted a complaint for this topic. Halting...")
                return {
                    "status": "exists", 
                    "complaint_id": existing_complaint['id'], 
                    "topic_id": topic_id,
                    "message": "You already have an active complaint under this master topic."
                }

        else:
            # Step 4: No match found -> Generate a concise master topic using Gemini 2.5 Flash
            print("No matching topic found. Generating new topic with Gemini...")
            prompt = f"""
            A user submitted the following grievance:
            Title: {title}
            Description: {description}
            
            Generate a concise, objective Master Topic Title (under 8 words) that summarizes this general issue so future similar complaints can be grouped under it.
            Return ONLY a valid JSON object with keys:
            - 'topic_title': string
            - 'target_org_name': string or null (if a specific company or government body is mentioned)
            """

            gemini_response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )

            result = json.loads(gemini_response.text)
            new_topic_title = result.get('topic_title', title)
            target_org_name = result.get('target_org_name')

            org_id = None
            if target_org_name:
                cursor.execute("SELECT id FROM organizations WHERE name ILIKE %s LIMIT 1;", (f"%{target_org_name}%",))
                org_row = cursor.fetchone()
                if org_row:
                    org_id = org_row['id']

            cursor.execute("""
                INSERT INTO topics (org_id, title, category, summary_embedding)
                VALUES (%s, %s, %s, %s::vector)
                RETURNING id;
            """, (org_id, new_topic_title, category, embedding_str))
            
            topic_id = cursor.fetchone()['id']
            print(f"Created New Topic: '{new_topic_title}' (ID: {topic_id})")

            if org_id:
                evaluate_topic_alignment(cursor, topic_id, org_id, new_topic_title)

        # Step 5: Save the Complaint
        cursor.execute("""
            INSERT INTO complaints (user_id, topic_id, title, description, embedding, status)
            VALUES (%s, %s, %s, %s, %s::vector, 'open')
            RETURNING id;
        """, (user_id, topic_id, title, description, embedding_str))

        complaint_id = cursor.fetchone()['id']

        # Step 6: Ingest Event into Timescale Hypertable
        cursor.execute("""
            INSERT INTO complaint_events (time, complaint_id, action_type)
            VALUES (now(), %s, 'created');
        """, (complaint_id,))

        print(f"Successfully saved complaint (ID: {complaint_id}) linked to Topic {topic_id}!")
        return {
            "status": "created",
            "complaint_id": complaint_id, 
            "topic_id": topic_id,
            "message": "Complaint successfully posted."
        }

    except Exception as e:
        print(f"Error during AI matchmaking: {e}")
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()