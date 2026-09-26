from database import get_db_connection
from ai_services import get_gemini_embedding, generate_master_topic, evaluate_alignment

SIMILARITY_THRESHOLD = 0.75

def process_complaint_service(user_id: str, title: str, description: str, category: str):
    conn = get_db_connection()
    conn.autocommit = True
    cursor = conn.cursor()

    try:
        # Double check user verification inside service boundary
        cursor.execute("SELECT is_verified FROM users WHERE id = %s;", (user_id,))
        user_row = cursor.fetchone()
        if not user_row or not user_row['is_verified']:
            raise ValueError("User email is not verified.")

        full_text = f"{title}\n{description}"
        embedding = get_gemini_embedding(full_text)
        embedding_str = str(embedding)

        # 1. Search existing topics via pgvector cosine distance
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
        else:
            # 2. No match found -> Generate new topic with Gemini
            ai_result = generate_master_topic(title, description)
            new_topic_title = ai_result.get('topic_title', title)
            target_org_name = ai_result.get('target_org_name')

            org_id = None
            if target_org_name:
                cursor.execute("SELECT id FROM organizations WHERE name ILIKE %s LIMIT 1;", (f"%{target_org_name}%",))
                org_row = cursor.fetchone()
                if org_row:
                    org_id = org_row['id']

            # Insert new topic row
            cursor.execute("""
                SELECT id FROM topics 
                WHERE org_id IS NOT DISTINCT FROM %s AND title = %s AND category = %s
            """, (org_id, new_topic_title, category))
            existing_topic = cursor.fetchone()

            if existing_topic:
                topic_id = existing_topic['id']
            else:
                cursor.execute("""
                    INSERT INTO topics (org_id, title, category, summary_embedding)
                    VALUES (%s, %s, %s, %s::vector)
                    RETURNING id;
                """, (org_id, new_topic_title, category, embedding_str))
                topic_id = cursor.fetchone()['id']

            # 3. Calculate alignment score if organization has priorities registered
            if org_id:
                cursor.execute("SELECT title, description FROM organization_priorities WHERE org_id = %s;", (org_id,))
                priorities = cursor.fetchall()
                if priorities:
                    priorities_text = "\n".join([f"- {p['title']}: {p['description']}" for p in priorities])
                    alignment_res = evaluate_alignment(priorities_text, new_topic_title)
                    score = alignment_res.get("alignment_score", 0.0)
                    rationale = alignment_res.get("alignment_rationale", "")
                    
                    cursor.execute("""
                        UPDATE topics 
                        SET alignment_score = %s, alignment_rationale = %s
                        WHERE id = %s;
                    """, (score, rationale, topic_id))

        # 4. Save or Update the complaint record (Enforces 1 complaint per user per topic via UPSERT)
        cursor.execute("""
            INSERT INTO complaints (user_id, topic_id, title, description, embedding, status)
            VALUES (%s, %s, %s, %s, %s::vector, 'pending_review')
            ON CONFLICT (user_id, topic_id) 
            DO UPDATE SET 
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                embedding = EXCLUDED.embedding,
                status = 'pending_review'
            RETURNING id, (xmax = 0) AS inserted;
        """, (user_id, topic_id, title, description, embedding_str))
        
        result = cursor.fetchone()
        complaint_id = result['id']
        is_new_insertion = result['inserted']

        # 5. Record event in Timescale hypertable for real-time trending/analytics
        action_type = 'created' if is_new_insertion else 'updated'
        cursor.execute("""
            INSERT INTO complaint_events (time, complaint_id, action_type)
            VALUES (now(), %s, %s);
        """, (complaint_id, action_type))

        return {
            "complaint_id": complaint_id, 
            "topic_id": topic_id, 
            "action": action_type,
            "message": "Complaint created successfully." if is_new_insertion else "Existing complaint updated successfully for this topic."
        }

    finally:
        cursor.close()
        conn.close()