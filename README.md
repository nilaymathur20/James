# CivicAI: Municipal Intelligence & Accessibility Assistant

**Hackathon Project**

CivicAI is a unified AI platform that solves two major problems for citizens and municipal staff:
1. **Source-Grounded Municipal Policy FAQ**: Answers policy questions strictly using uploaded government documents with exact citations.
2. **Multilingual Public Notice Translator**: Extracts text from public notices via OCR, translates them into simple language, explains jargon, and extracts actionable summaries.

## Features
- Upload PDF, PNG, JPG, JPEG documents.
- OCR text extraction (pytesseract).
- Sentence-window retrieval from local SQLite FTS5 database.
- Grounded generation with strict citation metadata (page, paragraph).
- Multilingual translation and jargon extraction.
- Beautiful, mobile-responsive dashboard.

## Architecture
- **Frontend**: React, Vite, TailwindCSS
- **Backend**: FastAPI
- **Database**: SQLite FTS5 for RAG
- **LLM**: Gemini / Local Models / OpenRouter via `llm.py`
- **OCR**: PyMuPDF for PDFs, Pytesseract for images

## Setup
1. Create a Python virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\Activate.ps1  # Windows
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Copy `backend/.env.example` to `backend/.env` and add your API keys:
   ```env
   GEMINI_API_KEY=your_key_here
   ```

## Running the Application
**Backend**:
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

## Demo Workflow
1. Go to `data/demo_docs` and use the synthetic documents.
2. **Policy FAQ**: Upload `Housing_Scheme_Demo.md`, wait for it to index. Ask "Who is eligible for this scheme?".
3. **Notice Translator**: Upload `Property_Tax_Rebate_Notice.md` (or an image), select "Hindi", and click Translate.

## Testing
```bash
pytest backend/tests/
npm run typecheck && npm run build --prefix frontend
```
