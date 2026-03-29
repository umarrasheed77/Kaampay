"""
MazdoorPay — FastAPI Server
Single API layer connecting all agents.
RANG (frontend) calls these 4 endpoints.
"""

import os
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

from agents.vani import transcribe_and_extract
from agents.hisaab import process_payroll
from agents.paisa import execute_all_payments, calculate_mazdoor_score, get_worker_history, init_db
from agents.kagaz import generate_all_payslips

# Initialize
app = FastAPI(
    title="MazdoorPay API",
    description="Voice-first AI payroll for India's daily wage workers",
    version="1.0.0"
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)

# Initialize database on startup
@app.on_event("startup")
def startup():
    init_db()


# ─────────────────────────────────────────
# Request Models
# ─────────────────────────────────────────

class TranscribeRequest(BaseModel):
    text: Optional[str] = None
    audio_base64: Optional[str] = None

class PayrollRequest(BaseModel):
    status: str
    transcript: str
    payroll_entries: list
    confidence: float
    readback_hindi: str
    error_message: Optional[str] = None

class PaymentRequest(BaseModel):
    status: Optional[str] = "success"
    payroll_date: str
    contractor: dict
    entries: list
    total_payout: float
    worker_count: int


# ─────────────────────────────────────────
# Endpoint 1: Transcribe & Extract (VANI)
# ─────────────────────────────────────────

@app.post("/api/transcribe")
async def api_transcribe(req: TranscribeRequest):
    """
    Takes text or audio, returns structured payroll data.
    If no input provided, uses demo transcript.
    """
    try:
        result = transcribe_and_extract(
            text=req.text,
            audio_base64=req.audio_base64
        )
        return JSONResponse(content=result)
    except Exception as e:
        # Never crash — return structured error
        return JSONResponse(content={
            "status": "error",
            "transcript": req.text or "",
            "payroll_entries": [],
            "confidence": 0.0,
            "readback_hindi": "",
            "error_message": str(e)
        })


# ─────────────────────────────────────────
# Endpoint 2: Process Payroll (HISAAB)
# ─────────────────────────────────────────

@app.post("/api/process-payroll")
async def api_process_payroll(req: PayrollRequest):
    """
    Takes VANI's output, validates wages, matches workers.
    Returns finalized payroll ready for payment.
    """
    try:
        vani_output = req.model_dump()
        result = process_payroll(vani_output)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={
            "status": "error",
            "payroll_date": CONSTANTS.get("demo_date", ""),
            "contractor": CONSTANTS.get("demo_contractor", {}),
            "entries": [],
            "total_payout": 0.0,
            "worker_count": 0,
            "error_message": str(e)
        })


# ─────────────────────────────────────────
# Endpoint 3: Execute Payments (PAISA + KAGAZ)
# ─────────────────────────────────────────

@app.post("/api/execute-payments")
async def api_execute_payments(req: PaymentRequest):
    """
    Takes HISAAB's output, executes mock payments,
    generates payslips, computes MazdoorScores.
    Returns combined PAISA + KAGAZ output.
    """
    try:
        hisaab_output = req.model_dump()

        # PAISA: Execute payments + calculate scores
        paisa_result = execute_all_payments(hisaab_output)

        # KAGAZ: Generate payslips
        kagaz_result = generate_all_payslips(
            hisaab_output,
            paisa_result.get("payment_results", []),
            paisa_result.get("scores", {})
        )

        # Merge results
        combined = {
            **paisa_result,
            **kagaz_result
        }
        return JSONResponse(content=combined)

    except Exception as e:
        return JSONResponse(content={
            "payment_results": [],
            "scores": {},
            "payslips": {},
            "total_paid": 0,
            "payment_status": "error",
            "error_message": str(e)
        })


# ─────────────────────────────────────────
# Endpoint 4: Worker Score (PAISA)
# ─────────────────────────────────────────

@app.get("/api/worker-score/{worker_id}")
async def api_worker_score(worker_id: str):
    """
    Returns MazdoorScore + payment history for a worker.
    """
    try:
        score = calculate_mazdoor_score(worker_id)
        history = get_worker_history(worker_id, limit=8)

        return JSONResponse(content={
            "worker_id": worker_id,
            "score": score,
            "history": history
        })

    except Exception as e:
        return JSONResponse(content={
            "worker_id": worker_id,
            "score": {"score": 0, "band": "building", "message": "Error loading score"},
            "history": [],
            "error_message": str(e)
        })


# ─────────────────────────────────────────
# Payslip PDF Download
# ─────────────────────────────────────────

@app.get("/api/payslip/{filename}")
async def download_payslip(filename: str):
    """Serve generated PDF payslips."""
    filepath = os.path.join(os.path.dirname(__file__), 'payslips', filename)
    if os.path.exists(filepath):
        return FileResponse(filepath, media_type="application/pdf", filename=filename)
    raise HTTPException(status_code=404, detail="Payslip not found")


# ─────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "MazdoorPay API", "version": "1.0.0"}


# ─────────────────────────────────────────
# Demo Data Endpoint (for frontend fallback)
# ─────────────────────────────────────────

@app.get("/api/demo-constants")
async def demo_constants():
    """Return constants for frontend to use."""
    return JSONResponse(content=CONSTANTS)
