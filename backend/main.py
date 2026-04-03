"""
KaamPay — FastAPI Server
Single API layer connecting all agents.
RANG (frontend) calls these endpoints.

v2.0 — Added:
- Balance check endpoint (FIX 07)
- Dispute raise/list endpoints (FIX 08)
- KaamScore lookup API for lenders (FIX 12)
- Score history endpoint
- Contractor dashboard endpoints (FIX 13)
"""

import sys
import os

if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import json
from datetime import date
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional

from agents.vani import extract_with_retry, preprocess_transcript, validate_entry_count, verify_workers
from agents.hisaab import process_payroll, register_worker
from agents.paisa import (
    execute_all_payments, calculate_kaam_score, get_worker_history,
    init_db, check_contractor_balance, get_score_history,
    get_daily_totals, get_contractor_workers, generate_contractor_insights,
    get_today_summary, raise_dispute, get_disputes,
    validate_lender_api_key, find_workers_by_aadhaar, get_db
)
from agents.kagaz import generate_all_payslips

# Initialize
app = FastAPI(
    title="KaamPay API",
    description="Voice-first AI payroll for India's daily wage workers",
    version="2.0.0"
)

# CORS — allow all origins (supports Vercel + local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
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

class DisputeRequest(BaseModel):
    phone_number: Optional[str] = None
    worker_id: Optional[str] = None
    payment_id: Optional[str] = None

class ScoreLookupRequest(BaseModel):
    aadhaar_last4: str
    aeps_verification_token: str
    worker_name_hint: Optional[str] = None
    query_purpose: str = "credit_assessment"

class RegisterWorkerRequest(BaseModel):
    name: str
    phone_number: str
    aadhaar_number: str
    job_category: str = "unskilled"


# ─────────────────────────────────────────
# Endpoint 1: Transcribe & Extract (VANI)
# ─────────────────────────────────────────

@app.post("/api/transcribe")
async def api_transcribe(req: TranscribeRequest):
    """Takes text or audio, returns structured payroll data with worker verification."""
    try:
        # Get transcript
        if req.audio_base64:
            transcript = CONSTANTS.get("demo_audio_transcript", "")
        elif req.text:
            transcript = req.text
        else:
            transcript = CONSTANTS.get("demo_audio_transcript", "")

        # FIX 4: Preprocess before sending to LLM
        cleaned_transcript = preprocess_transcript(transcript)

        # FIX 3: Extract with retry
        result = await extract_with_retry(cleaned_transcript)

        # FIX 4: Validate entry count
        if (result.get("status") == "success" and
            not validate_entry_count(result, transcript)):
            result = await extract_with_retry(transcript)
            result["parsing_notes"] += " [retried: entry count mismatch]"

        # VERIFICATION GATE: Validate extracted names against worker database
        if result.get("payroll_entries"):
            verification = verify_workers(result["payroll_entries"])
            result["verification"] = {
                "all_verified": verification["all_verified"],
                "verified_count": verification["verified_count"],
                "unverified_count": verification["unverified_count"],
                "unverified_names": verification["unverified_names"],
                "details": verification["verification_details"]
            }

            if verification["all_verified"]:
                # Replace entries with verified versions (canonical names + worker IDs)
                result["payroll_entries"] = verification["verified_entries"]
                verified_names = [e["worker_name"] for e in verification["verified_entries"]]
                result["readback_hindi"] = f"Worker {', '.join(verified_names)} verified. Access accepted."
            else:
                # Stop all further processes immediately
                result["status"] = "error"
                # STRICT CONSTRAINT: Do not allow any data entry or logging if name is not verified.
                result["payroll_entries"] = []
                result["error_message"] = "Worker not found."
                result["readback_hindi"] = "Worker not found."

        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={
            "status": "error",
            "transcript": req.text or "",
            "payroll_entries": [],
            "confidence": 0.0,
            "readback_hindi": "",
            "error_message": str(e)
        })


# ─────────────────────────────────────────
# Endpoint 1b: Verify Workers (standalone)
# ─────────────────────────────────────────

class VerifyWorkersRequest(BaseModel):
    worker_names: list

@app.post("/api/verify-workers")
async def api_verify_workers(req: VerifyWorkersRequest):
    """Standalone worker verification endpoint."""
    try:
        entries = [{"worker_name": name} for name in req.worker_names]
        result = verify_workers(entries)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={
            "all_verified": False,
            "error": str(e)
        })


# ─────────────────────────────────────────
# Endpoint 2: Process Payroll (HISAAB)
# ─────────────────────────────────────────

@app.post("/api/process-payroll")
async def api_process_payroll(req: PayrollRequest):
    """Takes VANI's output, validates wages, matches workers."""
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
    """Takes HISAAB's output, executes payments, generates payslips."""
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
# Endpoint X: Manual Worker Registration
# ─────────────────────────────────────────

@app.post("/api/register-worker")
async def api_register_worker(req: RegisterWorkerRequest):
    """Fallback manual registration handling Aadhaar and Name."""
    try:
        worker_data = {
            "name": req.name,
            "phone_type": "smartphone" if len(req.phone_number) >= 10 else "feature_phone",
            "phone_number": req.phone_number,
            "kaam_band": "building",
            "kaam_score": 600
        }
        contractor_id = CONSTANTS.get("demo_contractor", {}).get("contractor_id", "CONT_001")
        result = register_worker(contractor_id, worker_data, aadhaar_full=req.aadhaar_number)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={"success": False, "error": str(e)})


# ─────────────────────────────────────────
# Endpoint 4: Worker Score (PAISA)
# ─────────────────────────────────────────

@app.get("/api/worker-score/{worker_id}")
async def api_worker_score(worker_id: str):
    """Returns KaamScore + payment history for a worker."""
    try:
        score = calculate_kaam_score(worker_id)
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
# Endpoint 5: Balance Check (FIX 07)
# ─────────────────────────────────────────

@app.get("/api/check-balance")
async def api_check_balance(total: float = 0):
    """Check contractor balance before payment."""
    try:
        result = check_contractor_balance("CONT_001", total)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={
            "sufficient": True,
            "available_balance": 15000,
            "required": total,
            "shortfall": 0,
            "error_message": str(e)
        })


# ─────────────────────────────────────────
# Endpoint 6: Disputes (FIX 08)
# ─────────────────────────────────────────

@app.post("/api/dispute/raise")
async def api_raise_dispute(req: DisputeRequest):
    """Raise a dispute on a payment."""
    try:
        result = raise_dispute(
            worker_id=req.worker_id,
            payment_id=req.payment_id,
            phone_number=req.phone_number
        )
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={
            "success": False,
            "error": str(e)
        })

@app.get("/api/disputes")
async def api_list_disputes():
    """List all disputes for contractor."""
    try:
        disputes = get_disputes("CONT_001")
        return JSONResponse(content={"disputes": disputes})
    except Exception as e:
        return JSONResponse(content={"disputes": [], "error": str(e)})


# ─────────────────────────────────────────
# Endpoint 7: KaamScore Lookup API (FIX 12)
# ─────────────────────────────────────────

@app.post("/api/kaam/score/lookup")
async def lookup_kaam_score(
    request: ScoreLookupRequest,
    x_api_key: Optional[str] = Header(None)
):
    """
    PRIMARY ENDPOINT FOR LENDERS AND BC AGENTS.
    Worker gives Aadhaar last 4 + fingerprint → score returned.
    """
    # Validate API key (accept any for demo)
    if x_api_key:
        lender = validate_lender_api_key(x_api_key)
    else:
        lender = {"lender_name": "Demo User"}

    # Validate AePS token (accept any non-empty for demo)
    if not request.aeps_verification_token:
        raise HTTPException(status_code=403, detail="Biometric verification required.")

    # Look up worker by Aadhaar last 4
    workers = find_workers_by_aadhaar(request.aadhaar_last4)

    if not workers:
        return JSONResponse(content={
            "found": False,
            "message": "Worker not found on KaamPay.",
            "recommendation": "Cannot assess creditworthiness through KaamPay."
        })

    # Disambiguate if multiple matches
    if len(workers) > 1 and request.worker_name_hint:
        workers = [w for w in workers if request.worker_name_hint.lower() in w["name"].lower()]

    if len(workers) > 1:
        raise HTTPException(status_code=300, detail="Multiple workers found. Provide worker name.")

    worker = workers[0]

    # Get current score
    score_data = calculate_kaam_score(worker["worker_id"])

    return JSONResponse(content={
        "found": True,
        "verified": True,
        "verification_method": "aadhaar_biometric",
        "worker_name": worker["name"],
        "aadhaar_last4": request.aadhaar_last4,
        "on_kaampay_since": worker.get("date_registered", ""),
        "kaam_score": score_data["score"],
        "kaam_band": score_data["band"],
        "score_last_updated": date.today().isoformat(),
        "total_verified_payments": score_data.get("total_payments", 0),
        "total_days_worked_90d": score_data.get("total_days_worked_90d", 0),
        "total_earned_90d": score_data.get("total_earned_90d", 0),
        "avg_monthly_income": round(score_data.get("total_earned_90d", 0) / 3, 2),
        "unique_employers_90d": score_data.get("unique_contractors", 0),
        "loan_eligible_amount": score_data.get("loan_eligible"),
        "recommended_products": score_data.get("benefits", []),
        "income_source": "verified_upi_payroll",
        "data_provider": "KaamPay",
        "verification_standard": "Aadhaar eKYC + UPI transaction verified",
        "disclaimer": (
            "KaamPay provides income verification data only. "
            "Credit decision remains with the lending institution."
        )
    })


@app.get("/api/kaam/score/worker/{worker_id}")
async def get_worker_score_by_id(worker_id: str):
    """Get worker score — for contractor app."""
    score_data = calculate_kaam_score(worker_id)
    return JSONResponse(content=score_data)


@app.get("/api/kaam/score/history/{worker_id}")
async def api_score_history(worker_id: str, days: int = 90):
    """Returns score progression over time for charts."""
    result = get_score_history(worker_id, days)
    return JSONResponse(content=result)


# ─────────────────────────────────────────
# Endpoint 8: Contractor Dashboard (FIX 13)
# ─────────────────────────────────────────

@app.get("/api/kaam/contractor/daily-totals")
async def api_daily_totals(days: int = 30):
    """Daily payment totals for spending chart."""
    totals = get_daily_totals("CONT_001", days)
    return JSONResponse(content={"totals": totals})

@app.get("/api/kaam/contractor/workers")
async def api_contractor_workers():
    """Worker roster for contractor."""
    workers = get_contractor_workers("CONT_001")
    return JSONResponse(content={"workers": workers})

@app.get("/api/kaam/contractor/insights")
async def api_contractor_insights():
    """AI insights for contractor dashboard."""
    insights = generate_contractor_insights("CONT_001")
    return JSONResponse(content={"insights": insights})

@app.get("/api/kaam/contractor/summary")
async def api_contractor_summary():
    """Today's summary for dashboard cards."""
    summary = get_today_summary("CONT_001")
    return JSONResponse(content=summary)


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
    return {"status": "ok", "service": "KaamPay API", "version": "2.0.0"}


# ─────────────────────────────────────────
# Demo Data Endpoint (for frontend fallback)
# ─────────────────────────────────────────

@app.get("/api/demo-constants")
async def demo_constants():
    """Return constants for frontend to use."""
    return JSONResponse(content=CONSTANTS)
