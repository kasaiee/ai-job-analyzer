# AI Job Analyzer

A self-hosted, AI-powered job-search cockpit: track every application on a kanban board, let an LLM analyze each job posting against your resume, and generate tailored resumes and cover letters — all backed by your own private memory.

Built with **Django 5** and **React 19 (Vite)**. Works with OpenAI-compatible APIs plus native **Anthropic** and **Google Gemini** APIs — the provider is chosen in Settings.

## Why this project exists

Job hunting is a data problem: dozens of postings, tailored resumes, interview stages, and decisions. This app turns that mess into a single dashboard where every application is tracked, analyzed, and acted on — while an AI assistant (with persistent memory of your career facts) helps you draft the materials for each one.

## Features

- **Job application tracker** — kanban board (Watchlist → Applied → Interview → Offer / Not selected) with drag-and-drop reordering, company profiles with logos, and per-application detail pages.
- **AI job analysis** — for every application, the backend fetches company research, analyzes the job description against your resume, and produces a structured dashboard: match assessment, skill-by-skill evidence, deal-breakers, and an explanation of how the scores were computed.
- **Tailored resume builder** — generates resume versions tailored to a specific posting from your master profile, with quality re-assessment, a PDF export, and full version history.
- **Cover letter builder** — per-application cover letters with selectable templates, editable preview, and PDF export.
- **Chat assistant** — ChatGPT-style conversations with file/URL/browser context, powered by the AI provider configured in Settings.
- **Memory system** — a hierarchical tree of career facts the AI can reference; includes AI-assisted auto-arrangement (newest-wins conflict resolution) and bulk move/delete.
- **i18n & RTL** — full English UI with dark/light theming and optional Jalali calendar.

## Screenshots

<!-- TODO: add screenshots/GIFs of the kanban board, analysis dashboard, and resume builder -->

## Architecture

```
┌────────────────────────┐         ┌─────────────────────────────┐
│  React 19 (Vite)       │  /api   │  Django 5 (REST API)        │
│  Atomic design         │ ──────► │  chat/                      │
│  atoms/molecules/      │  proxy  │  ├── views/       HTTP      │
│  organisms/templates   │         │  ├── services/    logic     │
│  i18n (EN)              │         │  ├── serializers.py JSON    │
│                        │         │  ├── selectors.py lookups   │
└────────────────────────┘         │  └── models.py    domain    │
                                   └────────────┬────────────────┘
                                                │ server-side only
                                    ┌───────────▼───────────┐
                                    │ OpenAI-compatible API │
                                    └───────────────────────┘
```

- **Views are thin**: request parsing, validation, and status codes only.
- **Business logic is testable**: AI client (with retry + TLS fallback), analysis parsing, resume/cover-letter generation, and PDF rendering live in services.
- The API key never reaches the browser — all AI calls are proxied through Django.
- **Multiple AI providers**: Settings offers OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral, DeepSeek, xAI, local Ollama (no key needed), or any custom OpenAI-compatible endpoint. The model dropdown is fetched live from the provider (`GET /api/ai/models/`), with manual entry as fallback.
- Provider adapters live in `chat/services/providers.py`: each translates the app's OpenAI-style payloads into the provider's wire format (and back), so the rest of the backend stays provider-agnostic.
- SQLite keeps the stack self-contained; no external database required.
- Engineering standards used during development are documented in [AI-RULES.md](AI-RULES.md).

## Tech stack

| Layer      | Tools |
|------------|-------|
| Backend    | Django 5, django-cors-headers, pypdf / PyMuPDF / reportlab, Pillow, BeautifulSoup |
| Frontend   | React 19, Vite, lucide-react, react-markdown, Vazirmatn font, node:test |
| AI         | OpenAI-compatible APIs (OpenAI, OpenRouter, Groq, Mistral, DeepSeek, xAI, Ollama, custom) plus native Anthropic and Google Gemini APIs |

## Getting started

### 1. Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env and set AI_PROVIDER_TOKEN

python manage.py migrate
python manage.py runserver 8005
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the Vite dev server proxies `/api` calls to Django on port 8005.

### 3. AI provider

No server-side key is needed: open **Settings → AI** in the app, pick a provider, enter its API token and (optionally edit) its base URL, then choose a model from the live list. Local **Ollama** needs no token.

## Running tests

```bash
# Backend (72 tests)
source .venv/bin/activate
python manage.py test chat

# Frontend (73 tests)
cd frontend
npm test
```

## Project structure

```
├── server/          # Django project (settings, URLs, WSGI)
├── chat/            # the application
│   ├── views/       # thin HTTP layer, one module per domain
│   ├── services/    # business logic (AI client, analysis, resumes, PDF)
│   ├── serializers.py / selectors.py
│   ├── models.py    # domain models
│   └── tests.py     # 72 backend tests
├── prompts/         # LLM prompt templates (company data extraction)
└── frontend/
    └── src/
        ├── components/   # atoms → molecules → organisms → templates
        ├── hooks/
        ├── i18n/         # EN translations
        └── utils/        # pure logic, fully unit-tested
```

## License

[MIT](LICENSE) © Mohammadreza Sharifi
