from database import get_db_connection
from ai_service import get_gemini_embedding, generate_topic_metadata, evaluate_topic_alignment

SIMILARITY_THRESHOLD = 0.75

def sync_or_create_user(user_id: str, name: str, email: str, is_verified: bool):
    """Syncs Auth0 user details into Tiger Data and auto-verifies matching organization emails."""
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()
    try:
        # Auto-verify organization if user email domain matches an organization's email domain
        if "@" in email:
            domain = email.split("@")[1]
            cursor.execute("""
                UPDATE organizations 
                SET is_verified = TRUE 
                WHERE email ILIKE %s;
            """, (f"%@{domain}",))

        cursor.execute("""
            INSERT INTO users (id, name, email, is_verified)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE 
            SET name = EXCLUDED.name, 
                email = EXCLUDED.email, 
                is_verified = EXCLUDED.is_verified
            RETURNING id, is_verified;
        """, (user_id, name, email, is_verified))
        return cursor.fetchone()
    finally:
        cursor.close()
        conn.close()

def process_and_match_complaint(
    user_id: str, 
    title: str, 
    description: str, 
    category: str, 
    force_submit: bool = False
):
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        full_text = f"{title}\n{description}"
        embedding = get_gemini_embedding(full_text)
        embedding_str = str(embedding)

        # Vector search using Cosine Distance operator (<=>)
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
            similarity_pct = float(matched_topic['similarity'])

            cursor.execute("""
                SELECT COUNT(id) AS complaint_count 
                FROM complaints 
                WHERE topic_id = %s;
            """, (topic_id,))
            stats = cursor.fetchone()
            complaint_count = stats['complaint_count'] if stats else 0

            if not force_submit:
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
            
            if cursor.fetchone():
                return {
                    "status": "exists", 
                    "message": "You already have an active complaint under this master topic."
                }
        else:
            metadata = generate_topic_metadata(title, description)
            new_topic_title = metadata.get('topic_title', title)
            target_org_name = metadata.get('target_org_name')

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

            if org_id:
                evaluate_topic_alignment(cursor, topic_id, org_id, new_topic_title)

        cursor.execute("""
            INSERT INTO complaints (user_id, topic_id, title, description, embedding, status)
            VALUES (%s, %s, %s, %s, %s::vector, 'open')
            RETURNING id;
        """, (user_id, topic_id, title, description, embedding_str))

        complaint_id = cursor.fetchone()['id']

        # Log event in TimescaleDB hypertable
        cursor.execute("""
            INSERT INTO complaint_events (time, complaint_id, action_type)
            VALUES (now(), %s, 'created');
        """, (complaint_id,))

        return {
            "status": "created",
            "complaint_id": complaint_id, 
            "topic_id": topic_id,
            "message": "Complaint successfully posted."
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()