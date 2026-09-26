import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment!")

client = genai.Client(api_key=GEMINI_API_KEY)

def get_gemini_embedding(text: str) -> list[float]:
    """Generates a 768-dimensional vector embedding using Google Gemini."""
    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return response.embeddings[0].values

def generate_topic_metadata(title: str, description: str) -> dict:
    """Uses Gemini to summarize a complaint into a Master Topic title and find targeted org name."""
    prompt = f"""
    A user submitted the following grievance:
    Title: {title}
    Description: {description}
    
    Generate a concise, objective Master Topic Title (under 8 words) that summarizes this general issue, and identify if a specific organization or agency is targeted.
    Return ONLY a valid JSON object with keys:
    - "topic_title": string
    - "target_org_name": string or null
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(response.text)

def evaluate_topic_alignment(cursor, topic_id: str, org_id: str, topic_title: str):
    """Evaluates how much a topic aligns with an organization's stated priorities using Gemini."""
    cursor.execute("""
        SELECT title, description FROM organization_priorities 
        WHERE org_id = %s;
    """, (org_id,))
    priorities = cursor.fetchall()

    if not priorities:
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
    1. A score from 0.0 to 1.0 (where 1.0 means complete direct failure/contradiction, 0.0 is unrelated).
    2. A brief 1-sentence rationale explaining the alignment score.

    Return ONLY a valid JSON object with keys:
    - "alignment_score": float
    - "alignment_rationale": string
    """

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )

    result = json.loads(response.text)
    score = result.get("alignment_score", 0.0)
    rationale = result.get("alignment_rationale", "")

    cursor.execute("""
        UPDATE topics 
        SET alignment_score = %s, alignment_rationale = %s
        WHERE id = %s;
    """, (score, rationale, topic_id))