import os
import json

from google import genai
from google.genai import types
from dotenv import load_dotenv


load_dotenv(
    dotenv_path="tiger-cloud-ripple-credentials.env"
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError(
        "Missing GEMINI_API_KEY in environment!"
    )


client = genai.Client(
    api_key=GEMINI_API_KEY
)


def _get_val(row, key: str, index: int = 0):
    """
    Safely extracts a value from either a dictionary-style
    or tuple-style database row.
    """

    if row is None:
        return None

    if isinstance(row, dict):
        return row[key]

    try:
        return row[key]
    except (TypeError, KeyError, IndexError):
        return row[index]


def get_gemini_embedding(text: str) -> list[float]:
    """
    Generates a 768-dimensional vector embedding using
    Google's Gemini embedding model.
    """

    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
        config=types.EmbedContentConfig(
            output_dimensionality=768
        ),
    )

    return response.embeddings[0].values


def generate_topic_metadata(
    title: str,
    description: str
) -> dict:
    """
    Uses Gemini to generate a concise Master Topic title
    and identify a targeted organization when applicable.
    """

    prompt = f"""
A user submitted the following grievance:

Title: {title}

Description: {description}

Generate a concise, objective Master Topic Title
under 8 words that summarizes the general issue.

Also identify whether a specific organization or agency
is being targeted.

Return ONLY a valid JSON object with exactly these keys:

- "topic_title": string
- "target_org_name": string or null
"""

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        ),
    )

    return json.loads(response.text)


def evaluate_topic_alignment(
    cursor,
    topic_id: str,
    org_id: str,
    topic_title: str
):
    """
    Evaluates how strongly a topic relates to or contradicts
    an organization's stated priorities.
    """

    cursor.execute(
        """
        SELECT
            title,
            description
        FROM organization_priorities
        WHERE org_id = %s;
        """,
        (org_id,)
    )

    priorities = cursor.fetchall()

    if not priorities:
        return

    priorities_text = "\n".join(
        [
            (
                f"- {_get_val(p, 'title', 0)}: "
                f"{_get_val(p, 'description', 1)}"
            )
            for p in priorities
        ]
    )

    prompt = f"""
You are an objective policy and corporate
accountability analyst.

Target Organization's Stated Priorities / Targets:

{priorities_text}

Master Public Complaint Topic:

"{topic_title}"

Task:

Evaluate how strongly this complaint topic contradicts
or targets the organization's stated priorities.

Provide:

1. A score from 0.0 to 1.0
   where 1.0 means complete direct failure/contradiction
   and 0.0 means unrelated.

2. A brief one-sentence rationale explaining the score.

Return ONLY a valid JSON object with exactly these keys:

- "alignment_score": float
- "alignment_rationale": string
"""

    response = client.models.generate_content(
        model="gemini-3.8-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json"
        ),
    )

    result = json.loads(response.text)

    score = result.get(
        "alignment_score",
        0.0
    )

    rationale = result.get(
        "alignment_rationale",
        ""
    )

    cursor.execute(
        """
        UPDATE topics
        SET
            alignment_score = %s,
            alignment_rationale = %s
        WHERE id = %s;
        """,
        (
            score,
            rationale,
            topic_id,
        )
    )