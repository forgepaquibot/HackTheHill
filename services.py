import traceback
from database import get_db_connection
from ai_service import get_gemini_embedding, generate_topic_metadata, evaluate_topic_alignment

SIMILARITY_THRESHOLD = 0.85

def sync_or_create_user(user_id: str, name: str, email: str, is_verified: bool):
    """Syncs Auth0 user details into Tiger Data and auto-verifies matching organization emails."""
    conn = get_db_connection()
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
        
        user_row = cursor.fetchone()
        
        # Explicit transaction commit
        conn.commit()
        return user_row
    except Exception as e:
        conn.rollback()
        print("❌ COMMIT FAILED AND ROLLED BACK!")
        print(traceback.format_exc())
        raise e
    finally:
        cursor.close()
        conn.close()

def process_and_match_complaint(
    user_id: str, 
    title: str, 
    description: str, 
    category: str, 
    force_submit: bool = True
):
    conn = get_db_connection()
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

        # Insert new complaint
        cursor.execute("""
            INSERT INTO complaints (user_id, topic_id, title, description, embedding, status)
            VALUES (%s, %s, %s, %s, %s::vector, 'open')
            RETURNING id;
        """, (user_id, topic_id, title, description, embedding_str))

        complaint_id = cursor.fetchone()['id']

        # Log creation event in TimescaleDB hypertable
        cursor.execute("""
            INSERT INTO complaint_events (time, complaint_id, action_type)
            VALUES (now(), %s, 'created');
        """, (complaint_id,))

        # Auto-add user's like to their newly posted complaint
        cursor.execute("""
            INSERT INTO complaint_likes (complaint_id, user_id)
            VALUES (%s, %s)
            ON CONFLICT (complaint_id, user_id) DO NOTHING;
        """, (complaint_id, user_id))

        # IF a match was found, auto-like all existing complaints in this topic
        if matched_topic:
            cursor.execute("""
                SELECT id FROM complaints WHERE topic_id = %s AND id != %s;
            """, (topic_id, complaint_id))
            existing_complaints = cursor.fetchall()

            for existing in existing_complaints:
                existing_id = existing['id']
                cursor.execute("""
                    INSERT INTO complaint_likes (complaint_id, user_id)
                    VALUES (%s, %s)
                    ON CONFLICT (complaint_id, user_id) DO NOTHING;
                """, (existing_id, user_id))

                cursor.execute("""
                    INSERT INTO complaint_events (time, complaint_id, action_type)
                    VALUES (now(), %s, 'like');
                """, (existing_id,))

        # Commit all inserts and likes atomically
        conn.commit()

        return {
            "status": "created",
            "complaint_id": complaint_id, 
            "topic_id": topic_id,
            "message": "Complaint successfully posted and matched topic upvoted."
        }

    except Exception as e:
        conn.rollback()
        print("❌ COMMIT FAILED AND ROLLED BACK!")
        print(traceback.format_exc())
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()