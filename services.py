import traceback
from database import get_db_connection
from ai_service import (
    get_gemini_embedding,
    generate_topic_metadata,
    evaluate_topic_alignment,
)

SIMILARITY_THRESHOLD = 0.85


def _get_val(row, key: str, idx: int = 0):
    """
    Safely extracts a column value whether the DB cursor returns
    a dictionary-like row or a tuple.
    """
    if row is None:
        return None

    if isinstance(row, dict):
        return row[key]

    try:
        return row[key]
    except (TypeError, KeyError, IndexError):
        return row[idx]


def sync_or_create_user(
    user_id: str,
    name: str,
    email: str,
    is_verified: bool
):
    """
    Syncs Auth0 user details into the database and automatically
    verifies matching organizations based on email domain.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Auto-verify organizations whose email domain matches the user.
        if "@" in email:
            domain = email.split("@", 1)[1]

            cursor.execute(
                """
                UPDATE organizations
                SET is_verified = TRUE
                WHERE email ILIKE %s;
                """,
                (f"%@{domain}",)
            )

        cursor.execute(
            """
            INSERT INTO users (id, name, email, is_verified)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE
            SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                is_verified = EXCLUDED.is_verified
            RETURNING id, is_verified;
            """,
            (user_id, name, email, is_verified)
        )

        user_row = cursor.fetchone()

        conn.commit()

        return user_row

    except Exception:
        conn.rollback()

        print("❌ USER SYNC FAILED — TRANSACTION ROLLED BACK")
        print(traceback.format_exc())

        raise

    finally:
        cursor.close()
        conn.close()


def get_topic_voices(cursor, topic_id: str) -> int:
    """
    Calculates the number of distinct community users who have
    either authored or liked a complaint under the topic.
    """
    cursor.execute(
        """
        SELECT COUNT(DISTINCT user_id) AS voice_count
        FROM (
            SELECT user_id
            FROM complaints
            WHERE topic_id = %s

            UNION

            SELECT cl.user_id
            FROM complaint_likes cl
            JOIN complaints c
                ON cl.complaint_id = c.id
            WHERE c.topic_id = %s
        ) AS unique_voices;
        """,
        (topic_id, topic_id)
    )

    result = cursor.fetchone()

    if not result:
        return 0

    return int(_get_val(result, "voice_count", 0))


def process_and_match_complaint(
    user_id: str,
    title: str,
    description: str,
    category: str,
):
    """
    Processes a confirmed complaint.

    Behavior:

    1. Generate an embedding for the complaint.
    2. Search for the closest existing topic in the same category.
    3. If a sufficiently similar topic exists:
       - If the user already has a complaint under that topic,
         update their existing complaint.
       - Otherwise, create a new complaint under that topic.
    4. If no sufficiently similar topic exists:
       - Generate a new topic.
       - Associate it with a matching organization when possible.
       - Evaluate topic/organization alignment.
       - Create the complaint under the new topic.
    5. Record complaint events.
    6. Commit the complete transaction atomically.
    """

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # ---------------------------------------------------------
        # 1. Generate complaint embedding
        # ---------------------------------------------------------

        full_text = f"{title}\n{description}"

        print("Generating Gemini embedding...")

        embedding = get_gemini_embedding(full_text)
        embedding_str = str(embedding)

        # ---------------------------------------------------------
        # 2. Search for an existing matching topic
        # ---------------------------------------------------------

        print(
            f"Searching for matching topic in category "
            f"'{category}' with threshold {SIMILARITY_THRESHOLD}..."
        )

        cursor.execute(
            """
            SELECT
                id,
                title,
                (1 - (summary_embedding <=> %s::vector)) AS similarity
            FROM topics
            WHERE category = %s
              AND summary_embedding IS NOT NULL
              AND (1 - (summary_embedding <=> %s::vector)) >= %s
            ORDER BY summary_embedding <=> %s::vector ASC
            LIMIT 1;
            """,
            (
                embedding_str,
                category,
                embedding_str,
                SIMILARITY_THRESHOLD,
                embedding_str,
            )
        )

        matched_topic = cursor.fetchone()

        # These are filled differently depending on whether
        # a topic was matched or created.
        topic_id = None
        topic_title = None
        similarity_pct = None
        is_similar = False

        # ---------------------------------------------------------
        # 3A. EXISTING TOPIC MATCHED
        # ---------------------------------------------------------

        if matched_topic:
            topic_id = _get_val(matched_topic, "id", 0)
            topic_title = _get_val(matched_topic, "title", 1)
            similarity_pct = float(
                _get_val(matched_topic, "similarity", 2)
            )

            is_similar = True

            print(
                f"✅ Matched existing topic: '{topic_title}' "
                f"({similarity_pct * 100:.2f}%)"
            )

            # -----------------------------------------------------
            # Check whether this user already has a complaint
            # under the matched topic.
            # -----------------------------------------------------

            cursor.execute(
                """
                SELECT id
                FROM complaints
                WHERE user_id = %s
                  AND topic_id = %s
                LIMIT 1;
                """,
                (user_id, topic_id)
            )

            existing_user_complaint = cursor.fetchone()

            # -----------------------------------------------------
            # 3A-1. User already has a complaint → UPDATE
            # -----------------------------------------------------

            if existing_user_complaint:
                complaint_id = _get_val(
                    existing_user_complaint,
                    "id",
                    0
                )

                print(
                    f"Updating existing complaint {complaint_id} "
                    f"under topic {topic_id}..."
                )

                cursor.execute(
                    """
                    UPDATE complaints
                    SET
                        title = %s,
                        description = %s,
                        embedding = %s::vector,
                        status = 'open'
                    WHERE id = %s;
                    """,
                    (
                        title,
                        description,
                        embedding_str,
                        complaint_id,
                    )
                )

                # Record update event.
                cursor.execute(
                    """
                    INSERT INTO complaint_events (
                        time,
                        complaint_id,
                        action_type
                    )
                    VALUES (now(), %s, 'updated');
                    """,
                    (complaint_id,)
                )

                # Make sure the user continues to count as a
                # supporting voice for their complaint.
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
                    (complaint_id, user_id)
                )

                conn.commit()

                final_voices = get_topic_voices(
                    cursor,
                    topic_id
                )

                print(
                    f"✅ Complaint {complaint_id} updated successfully."
                )

                return {
                    "status": "updated",
                    "complaint_id": complaint_id,
                    "topic_id": topic_id,
                    "topic_title": topic_title,
                    "category": category,
                    "similarity": round(similarity_pct, 4),
                    "voices": final_voices,
                    "isSimilar": True,
                    "message": (
                        "Your existing complaint under this topic "
                        "was updated with new details."
                    ),
                }

            # -----------------------------------------------------
            # 3A-2. User does not have a complaint under topic
            #       → CREATE new complaint under existing topic
            # -----------------------------------------------------

            print(
                "No existing complaint from this user under the "
                "matched topic. Creating a new complaint..."
            )

        # ---------------------------------------------------------
        # 3B. NO MATCHED TOPIC → CREATE NEW TOPIC
        # ---------------------------------------------------------

        else:
            print(
                "No matching topic found. Generating new topic metadata..."
            )

            metadata = generate_topic_metadata(
                title,
                description
            )

            topic_title = metadata.get("topic_title") or title
            target_org_name = metadata.get("target_org_name")

            org_id = None

            # -----------------------------------------------------
            # Try to identify the organization targeted by the topic.
            # -----------------------------------------------------

            if target_org_name:
                cursor.execute(
                    """
                    SELECT id
                    FROM organizations
                    WHERE name ILIKE %s
                    LIMIT 1;
                    """,
                    (f"%{target_org_name}%",)
                )

                org_row = cursor.fetchone()

                if org_row:
                    org_id = _get_val(org_row, "id", 0)

            # -----------------------------------------------------
            # Create new topic
            # -----------------------------------------------------

            print(f"Creating new topic: '{topic_title}'")

            cursor.execute(
                """
                INSERT INTO topics (
                    org_id,
                    title,
                    category,
                    summary_embedding
                )
                VALUES (%s, %s, %s, %s::vector)
                RETURNING id;
                """,
                (
                    org_id,
                    topic_title,
                    category,
                    embedding_str,
                )
            )

            topic_row = cursor.fetchone()
            topic_id = _get_val(topic_row, "id", 0)

            print(f"✅ Created new topic {topic_id}")

            # -----------------------------------------------------
            # Evaluate alignment with organization priorities.
            # -----------------------------------------------------

            if org_id:
                print(
                    "Evaluating topic alignment with organization..."
                )

                evaluate_topic_alignment(
                    cursor,
                    topic_id,
                    org_id,
                    topic_title
                )

        # ---------------------------------------------------------
        # 4. Create complaint
        #
        # This is reached when:
        #
        # - A matching topic exists and this user does not already
        #   have a complaint under it.
        #
        # OR
        #
        # - A brand-new topic was just created.
        # ---------------------------------------------------------

        print(
            f"Creating complaint under topic {topic_id}..."
        )

        cursor.execute(
            """
            INSERT INTO complaints (
                user_id,
                topic_id,
                title,
                description,
                embedding,
                status
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s::vector,
                'open'
            )
            RETURNING id;
            """,
            (
                user_id,
                topic_id,
                title,
                description,
                embedding_str,
            )
        )

        complaint_row = cursor.fetchone()
        complaint_id = _get_val(
            complaint_row,
            "id",
            0
        )

        # ---------------------------------------------------------
        # 5. Log complaint creation
        # ---------------------------------------------------------

        cursor.execute(
            """
            INSERT INTO complaint_events (
                time,
                complaint_id,
                action_type
            )
            VALUES (now(), %s, 'created');
            """,
            (complaint_id,)
        )

        # ---------------------------------------------------------
        # 6. Automatically like the user's own complaint
        # ---------------------------------------------------------

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
            (complaint_id, user_id)
        )

        # ---------------------------------------------------------
        # 7. If this was an existing topic, add this user's like
        #    to all other complaints under that topic.
        #
        # This preserves your existing "join the Ripple" behavior.
        # ---------------------------------------------------------

        if is_similar:
            cursor.execute(
                """
                SELECT id
                FROM complaints
                WHERE topic_id = %s
                  AND id != %s;
                """,
                (topic_id, complaint_id)
            )

            existing_complaints = cursor.fetchall()

            for existing in existing_complaints:
                existing_id = _get_val(
                    existing,
                    "id",
                    0
                )

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
                        existing_id,
                        user_id
                    )
                )

                # Only record a like event if the like was actually
                # newly inserted.
                if cursor.rowcount > 0:
                    cursor.execute(
                        """
                        INSERT INTO complaint_events (
                            time,
                            complaint_id,
                            action_type
                        )
                        VALUES (now(), %s, 'like');
                        """,
                        (existing_id,)
                    )

        # ---------------------------------------------------------
        # 8. Commit everything atomically
        # ---------------------------------------------------------

        conn.commit()

        # ---------------------------------------------------------
        # 9. Calculate final community voice count
        # ---------------------------------------------------------

        final_voices = get_topic_voices(
            cursor,
            topic_id
        )

        print(
            f"✅ Complaint {complaint_id} successfully created."
        )
        print(
            f"Topic: {topic_title}"
        )
        print(
            f"Voices: {final_voices}"
        )

        return {
            "status": "created",
            "complaint_id": complaint_id,
            "topic_id": topic_id,
            "topic_title": topic_title,
            "category": category,
            "similarity": (
                round(similarity_pct, 4)
                if similarity_pct is not None
                else None
            ),
            "voices": final_voices,
            "isSimilar": is_similar,
            "message": (
                "Complaint successfully posted and matched "
                "to a community topic."
                if is_similar
                else
                "Complaint successfully posted as a new community topic."
            ),
        }

    except Exception:
        conn.rollback()

        print(
            "❌ COMPLAINT TRANSACTION FAILED — ROLLED BACK"
        )
        print(traceback.format_exc())

        # IMPORTANT:
        # Re-raise instead of returning {"status": "error"}.
        # This allows FastAPI to return HTTP 500 rather than
        # incorrectly returning HTTP 200.
        raise

    finally:
        cursor.close()
        conn.close()