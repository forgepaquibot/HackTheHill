# Ripple Backend

The backend for **Ripple**, a community grievance and accountability platform developed for HackTheHill.

The backend provides the API, authentication, database operations, AI-powered complaint matching, organization matching, and speech-to-text token generation used by the Ripple frontend.

## Tech Stack

* **Python**
* **FastAPI** — REST API
* **PostgreSQL / Tiger Cloud (Timescale)** — database
* **pgvector** — vector embeddings and similarity search
* **Google Gemini** — embeddings and AI-generated topic metadata
* **Auth0** — user authentication and authorization
* **ElevenLabs** — speech-to-text
* **Uvicorn** — development server

## Project Structure

```text
HackTheHill/
├── main.py
├── services.py
├── database.py
├── ai_service.py
├── init_db.py
├── requirements.txt
├── tiger-cloud-ripple-credentials.env
└── README.md
```

### Main Files

| File               | Purpose                                                                               |
| ------------------ | ------------------------------------------------------------------------------------- |
| `main.py`          | FastAPI application and API endpoints                                                 |
| `services.py`      | Complaint processing, topic matching, user synchronization, and organization matching |
| `database.py`      | PostgreSQL/Tiger Cloud database connection                                            |
| `ai_service.py`    | Gemini embeddings and AI-powered topic analysis                                       |
| `init_db.py`       | Initializes the database schema and required PostgreSQL extensions                    |
| `requirements.txt` | Python dependencies                                                                   |

## Requirements

You will need:

* Python 3.12+
* A Tiger Cloud/PostgreSQL database
* An Auth0 application/API
* A Google Gemini API key
* An ElevenLabs API key

## Installation

Clone the repository and navigate to the project directory:

```bash
git clone <repository-url>
cd HackTheHill
```

Create a virtual environment:

### Windows

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### macOS / Linux

```bash
python3.12 -m venv .venv
source .venv/bin/activate
```

Install the dependencies:

```bash
python -m pip install -r requirements.txt
```

## Environment Variables

The backend requires environment variables for the database, Auth0, Gemini, and ElevenLabs.

Create a local environment file containing the required values.

Example:

```env
DATABASE_URL=your-postgresql-connection-string

AUTH0_DOMAIN=your-auth0-domain
AUTH0_API_AUDIENCE=your-auth0-api-audience

GEMINI_API_KEY=your-gemini-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key

ALLOW_LOCAL_DEV_AUTH=true
```

### Security

**Never commit API keys, database passwords, Auth0 secrets, or other credentials to GitHub.**

The project's credential files should remain local and be included in `.gitignore`.

For production deployments, configure these values through the hosting provider's environment-variable system instead of committing them to the repository.

## Database Setup

Ripple uses PostgreSQL with `pgvector` and TimescaleDB functionality.

The database initialization script can be run with:

```bash
python init_db.py
```

This creates the required database extensions, tables, indexes, and relationships.

The database includes tables for:

* Users
* Organizations
* Organization priorities
* Topics
* Complaints
* Complaint likes
* Complaint events

The `topics` and `complaints` tables store vector embeddings used for semantic similarity matching.

## Running the Backend

Start the FastAPI development server with:

```bash
uvicorn main:app --reload
```

The API will normally be available at:

```text
http://127.0.0.1:8000
```

FastAPI's interactive API documentation is available at:

```text
http://127.0.0.1:8000/docs
```

The OpenAPI schema is available at:

```text
http://127.0.0.1:8000/openapi.json
```

## API Overview

The backend exposes endpoints for:

### Authentication

Authentication is handled through Auth0 using bearer tokens.

Protected endpoints validate the authenticated user's identity before allowing access.

### Users

```text
POST /api/users/register
```

Synchronizes an authenticated Auth0 user with the Ripple database.

### Complaints

```text
POST /api/complaints
```

Submits a new complaint and processes it through the topic-matching system.

### Topics

```text
GET /api/topics
```

Retrieves community topics.

Additional topic and complaint endpoints are available through the FastAPI documentation.

### Likes

```text
POST /api/complaints/{id}/like
```

Adds a user's support/like to a complaint.

### Speech-to-Text

```text
POST /api/scribe-token
```

Generates a temporary ElevenLabs speech-to-text token.

The ElevenLabs API key remains exclusively on the backend.

## Complaint Matching

When a complaint is submitted, the backend:

1. Generates an embedding for the complaint.
2. Searches existing topics in the same category.
3. Compares the complaint embedding against existing topic embeddings.
4. Determines whether the complaint is sufficiently similar to an existing topic.
5. Creates a new topic or associates the complaint with an existing topic.
6. Updates the topic's voice count.
7. Attempts to identify the relevant organization.
8. Evaluates the relationship between the complaint and the organization's priorities.
9. Records the appropriate complaint event.

The current similarity threshold is defined in `services.py`.

```python
SIMILARITY_THRESHOLD = 0.85
```

## Authentication Flow

Ripple uses Auth0 for authentication.

The general flow is:

```text
User
 ↓
Ripple Frontend
 ↓
Auth0
 ↓
Access Token
 ↓
FastAPI
 ↓
Token Verification
 ↓
Ripple PostgreSQL Database
```

The backend verifies the Auth0 JWT before allowing access to protected endpoints.

For local development, `ALLOW_LOCAL_DEV_AUTH` can be enabled when appropriate. Production deployments should use proper Auth0 JWT verification.

## Development

Run the backend with:

```bash
uvicorn main:app --reload
```

When developing the frontend with Vite, the frontend's `/api` requests are proxied to the local FastAPI server.

The frontend therefore uses routes such as:

```text
/api/topics
/api/complaints
/api/users/register
```

rather than hard-coded `localhost:8000` URLs.

## Production

The backend can be deployed as a FastAPI service using a platform that supports Python/FastAPI applications.

Production environment variables should be configured through the hosting platform.

Do not commit:

```text
.env
.env.local
*.env
tiger-cloud-ripple-credentials.env
```

or any other files containing secrets.

## Troubleshooting

### Database connection timeout

If PostgreSQL/Tiger Cloud returns a connection timeout:

1. Verify that `DATABASE_URL` is correct.
2. Verify that the database service is running.
3. Check the Tiger Cloud IP allowlist.
4. Confirm that the current machine/network is permitted to connect.
5. Test the database host and port independently.

For example:

```powershell
Test-NetConnection <database-host> -Port <database-port>
```

### Authentication errors

Check:

* `AUTH0_DOMAIN`
* `AUTH0_API_AUDIENCE`
* Auth0 application configuration
* Auth0 allowed callback URLs
* Auth0 allowed web origins
* JWT audience and issuer configuration

### Missing API keys

Check that the required environment variables are available to the backend process.

Do not put backend-only API keys into Vite's `VITE_*` environment variables, since those values are exposed to the frontend.

## Team

Developed for **HackTheHill**.

The Ripple backend supports the goal of helping community members surface shared concerns, identify common issues, and follow accountability and progress over time.