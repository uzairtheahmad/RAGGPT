# RAGGPT

I built this simple RAG project while learning langchain.

Upload documents (PDF, Word, Excel, CSV, Markdown, code files, and more) and chat with them in a ChatGPT-style UI. Answers are grounded strictly in your uploaded content, with source citations.

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/<your-username>/RAGGPT.git
cd RAGGPT
```

### 2. Set up the API key

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
```

### 3. Run the backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt    # macOS/Linux: .venv/bin/pip
.venv\Scripts\python -m uvicorn app.main:app --port 8000
```

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

> **Windows note:** if chromadb fails with `DLL load failed`, install the [VC++ redistributable](https://aka.ms/vs/17/release/vc_redist.x64.exe), or copy `msvcp140.dll`, `vcruntime140.dll`, and `vcruntime140_1.dll` into `backend/.venv/Lib/site-packages/chromadb_rust_bindings/`.
