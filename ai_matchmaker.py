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


def process_and_match_complaint(user_id: str, title: str, description: str, category: str):
    """
    1. Embeds the complaint with Gemini text-embedding-004.
    2. Runs pgvector similarity search against existing topics in Tiger Data.
    3. If similarity > 0.75, links to existing topic.
    4. If no match, calls Gemini 2.5 Flash to summarize a new master topic.
    5. Stores the complaint and records the hypertable event in Tiger Data.
    """
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        full_text = f"{title}\n{description}"
        print(f"\nProcessing complaint: '{title}'...")

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

        if matched_topic:
            topic_id = matched_topic['id']
            print(f"Matched to Existing Topic: '{matched_topic['title']}' (Similarity: {matched_topic['similarity']:.2%})")

            # --- Does this user already have a complaint for this topic (business rule 1 complaint per user per topic)? ---
            cursor.execute("""
                SELECT id FROM complaints 
                WHERE user_id = %s AND topic_id = %s
            """, (user_id, topic_id))
            
            existing_complaint = cursor.fetchone()
            
            if existing_complaint:
                print("User already submitted a complaint for this topic. Returning existing ID...")
                return {
                    "status": "exists", 
                    "complaint_id": existing_complaint['id'], 
                    "topic_id": topic_id,
                    "message": "You already have an active complaint for this issue."
                }
        else:
            # Step 3: No match found -> Generate a concise master topic using Gemini 2.5 Flash
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

            # Enforce JSON output using response_mime_type
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

            # Step 4: Insert the New Topic
            cursor.execute("""
                INSERT INTO topics (org_id, title, category, summary_embedding)
                VALUES (%s, %s, %s, %s::vector)
                RETURNING id;
            """, (org_id, new_topic_title, category, embedding_str))
            
            topic_id = cursor.fetchone()['id']
            print(f"Created New Topic: '{new_topic_title}' (ID: {topic_id})")

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
        return {"complaint_id": complaint_id, "topic_id": topic_id}

    except Exception as e:
        print(f"Error during AI matchmaking: {e}")
    finally:
        cursor.close()
        conn.close()