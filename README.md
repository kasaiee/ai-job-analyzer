# Mirza Chat

A simple ChatGPT-style interface using Django, SQLite, React, and the Mirza OpenAI-compatible API.

## Run locally

1. Create a Python environment and install dependencies:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. Configure the API key on the backend:

   ```bash
   cp .env.example .env
   # edit .env and set MIRZA_API_KEY
   python manage.py migrate
   python manage.py runserver
   ```

3. In a second terminal, install and run the React frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

Open http://localhost:5173. The API key stays on the Django server and is never exposed to React.
