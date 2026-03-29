# MazdoorPay

Voice-first AI payroll system for India's daily wage workers.  
Built for Fin-O-Hack (Paytm × Assets DTU).

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
# Add your Gemini API key to .env
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 on mobile viewport (390px).

## Stack
- **Frontend:** React + Vite + Vanilla CSS
- **Backend:** Python FastAPI
- **Database:** SQLite
- **AI:** Google Gemini 2.0 Flash (Hindi NER)
- **Payments:** Mock Paytm UPI
