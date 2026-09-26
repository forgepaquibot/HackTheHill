import os
import json
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(dotenv_path="tiger-cloud-ripple-credentials.env")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("Missing GEMINI_API_KEY in environment variables.")

client = genai.Client(api_key=GEMINI_API_KEY)

def get_gemini_embedding(text: str) -> list[float]:
    """Generates a 768-dimensional vector embedding using text-embedding-004."""
    response = client.models.embed_content(
        model="text-embedding-004",
        contents=text,
    )
    return response.embeddings[0].values

def generate_master_topic(title: str, description: str) -> dict:
    """Uses Gemini to summarize a new complaint into a master topic title and target org."""
    prompt = f"""
    A user submitted the following grievance:
    Title: {title}
    Description: {description}
    
    Generate a concise, objective Master Topic Title (under 8 words) that summarizes this general issue so future similar complaints can be grouped under it.
    Return ONLY a valid JSON object with keys:
    - 'topic_title': string
    - 'target_org_name': string or null (if a specific company or government body is mentioned)
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(response.text)

def evaluate_alignment(priorities_text: str, topic_title: str) -> dict:
    """Evaluates contradiction/alignment against target organization goals using Gemini."""
    prompt = f"""
    You are an objective policy and corporate accountability analyst.
    
    Target Organization's Stated Priorities / Targets:
    {priorities_text}
    
    Master Public Complaint Topic:
    "{topic_title}"
    
    Task:
    Evaluate how strongly this complaint topic contradicts or targets the organization's stated priorities.
    Return ONLY a valid JSON object with keys:
    - "alignment_score": float (0.0 to 1.0)
    - "alignment_rationale": string (1-sentence explanation)
    """
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(response_mime_type="application/json")
    )
    return json.loads(response.text)