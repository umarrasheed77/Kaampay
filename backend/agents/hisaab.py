"""
HISAAB — Payroll Calculation Agent
Validates wages, matches workers, and produces finalized payroll records.
Takes input from VANI, passes output to PAISA and KAGAZ.

v2.0 — Added:
- Worker registration with Aadhaar eKYC (FIX 02)
- Universal worker identity (FIX 05)
- Card assignment for no-phone workers (FIX 03)
- Aadhaar last-4-only storage (FIX 04)
- card_load delivery method
"""

import os
import re
import json
import uuid
from rapidfuzz import process

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)

WAGES_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'minimum_wages.json')
with open(WAGES_PATH, 'r', encoding='utf-8') as f:
    MINIMUM_WAGES = json.load(f)


def generate_short_id():
    """Generate a short unique ID."""
    return uuid.uuid4().hex[:8].upper()


def match_worker(name: str, known_workers: list) -> dict:
    """Fuzzy match worker name to known workers in constants."""
    names = [w["name"] for w in known_workers]
    result = process.extractOne(name, names)
    if result is None:
        return {
            "id": f"W_NEW_{name[:3].upper()}",
            "name": name,
            "aadhaar_last4": "0000",
            "phone_type": "feature_phone",
            "days_in_system": 0,
            "is_new": True
        }
    match, score, idx = result
    if score >= 75:
        worker = known_workers[idx].copy()
        # Map field names from constants format
        worker["id"] = worker.get("worker_id", worker.get("id", f"W_NEW_{name[:3].upper()}"))
        worker["is_new"] = False
        return worker
    else:
        return {
            "id": f"W_NEW_{name[:3].upper()}",
            "name": name,
            "aadhaar_last4": "0000",
            "phone_type": "feature_phone",
            "days_in_system": 0,
            "is_new": True
        }


def validate_wage(rate_per_day: float, state: str, job_category: str = "unskilled") -> dict:
    """
    Check if wage meets minimum wage for the state.

    Previously checked constants.json's own minimum_wages table first,
    falling back to minimum_wages.json only if absent — both files
    independently defined the same states with duplicated values,
    risking silent drift if only one was updated during a wage revision.
    minimum_wages.json is now the single source of truth.
    """
    state_wages = MINIMUM_WAGES.get(state)

    if not state_wages:
        return {"compliant": True, "minimum_required": 0, "shortfall": 0, "warning_hindi": None}

    min_wage = state_wages.get(job_category, state_wages.get("unskilled", 0))

    if rate_per_day < min_wage:
        return {
            "compliant": False,
            "minimum_required": min_wage,
            "shortfall": min_wage - rate_per_day,
            "warning_hindi": f"Yeh rate minimum wage se kam hai. {state} mein minimum ₹{min_wage} rupay hai."
        }
    return {
        "compliant": True,
        "minimum_required": min_wage,
        "shortfall": 0,
        "warning_hindi": None
    }


def get_delivery_method(phone_type: str) -> str:
    """Determine payslip delivery method based on phone type."""
    methods = {
        "smartphone": "whatsapp_payslip",
        "feature_phone": "sms_payslip",
        "no_phone": "card_load",
        "family_number": "sms_payslip"
    }
    return methods.get(phone_type, "card_load")


# ─────────────────────────────────────────
# Worker Registration (FIX 02, 03, 04, 05)
# ─────────────────────────────────────────

def call_paytm_ekyc_api(aadhaar: str, name: str) -> dict:
    """
    Mock Paytm eKYC API call.
    In production: POST to Paytm eKYC API.

    The persisted account ID must never be derived from Aadhaar digits —
    a previous version embedded the last-4 Aadhaar digits directly into
    this string, which then got stored verbatim, leaking a PII fragment
    into a field that isn't otherwise treated as sensitive. Uses an
    opaque random identifier instead.
    """
    return {
        "success": True,
        "paytm_account_id": f"PPB_{uuid.uuid4().hex[:10].upper()}",
        "account_type": "paytm_payments_bank",
        "kyc_level": "full",
        "monthly_limit": 100000
    }


def register_worker(contractor_id: str, worker_data: dict,
                     aadhaar_full: str = None) -> dict:
    """
    Register a worker with optional Aadhaar eKYC.
    NEVER stores full Aadhaar — last 4 digits only.
    """
    from agents.paisa import get_db

    # Validate Aadhaar format
    if aadhaar_full:
        aadhaar_clean = re.sub(r'\s+', '', str(aadhaar_full))
        if not re.match(r'^\d{12}$', aadhaar_clean):
            return {"success": False, "error": "Invalid Aadhaar format. Must be 12 digits."}

        aadhaar_last4 = aadhaar_clean[-4:]

        # Send to Paytm eKYC API
        ekyc_result = call_paytm_ekyc_api(aadhaar_clean, worker_data["name"])

        # DISCARD FULL AADHAAR IMMEDIATELY
        aadhaar_clean = "000000000000"
        aadhaar_full = "000000000000"

        if not ekyc_result["success"]:
            return {"success": False, "error": "Aadhaar verification failed."}

        aadhaar_verified = 1
    else:
        aadhaar_last4 = None
        aadhaar_verified = 0

    # Check if worker already exists (universal identity)
    existing = check_existing_worker(
        worker_data.get("phone_number"), aadhaar_last4
    )

    if existing and not existing.get("multiple_matches"):
        link_contractor_to_worker(contractor_id, existing["worker_id"])
        return {
            "success": True,
            "worker_id": existing["worker_id"],
            "is_existing_worker": True,
            "message": f"{worker_data['name']} already on KaamPay. Profile linked.",
            "existing_kaam_score": existing.get("kaam_score", 0)
        }

    # New worker
    worker_id = f"W_{generate_short_id()}"

    conn = get_db()
    conn.execute("""
        INSERT INTO workers
        (worker_id, name, phone_number, phone_type,
         aadhaar_last4, aadhaar_verified, job_type,
         state, registered_by_contractor)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        worker_id, worker_data["name"],
        worker_data.get("phone_number"),
        worker_data.get("phone_type", "feature_phone"),
        aadhaar_last4, aadhaar_verified,
        worker_data.get("job_type", "unskilled"),
        worker_data.get("state", "Delhi"),
        contractor_id
    ))
    conn.commit()
    conn.close()

    link_contractor_to_worker(contractor_id, worker_id)

    return {
        "success": True,
        "worker_id": worker_id,
        "is_existing_worker": False,
        "aadhaar_verified": aadhaar_verified,
        "account_type": "paytm_payments_bank" if aadhaar_verified else "basic_wallet",
        "monthly_limit": 100000 if aadhaar_verified else 10000
    }


def check_existing_worker(phone_number=None, aadhaar_last4=None):
    """Check if worker already exists across ALL contractors."""
    from agents.paisa import get_db
    conn = get_db()
    
    try:
        if phone_number:
            result = conn.execute(
                "SELECT * FROM workers WHERE phone_number = ? AND is_active = 1",
                (phone_number,)
            ).fetchone()
            if result:
                return dict(result)

        if aadhaar_last4:
            results = conn.execute(
                "SELECT * FROM workers WHERE aadhaar_last4 = ? AND is_active = 1",
                (aadhaar_last4,)
            ).fetchall()

            if len(results) == 1:
                return dict(results[0])
            elif len(results) > 1:
                return {"multiple_matches": True, "count": len(results)}

        return None
    finally:
        conn.close()


def link_contractor_to_worker(contractor_id, worker_id):
    """Create many-to-many relationship between contractor and worker."""
    from agents.paisa import get_db
    conn = get_db()
    conn.execute("""
        INSERT INTO contractor_worker_relationships
        (contractor_id, worker_id, first_worked_date)
        VALUES (?, ?, CURRENT_DATE)
        ON CONFLICT(contractor_id, worker_id)
        DO UPDATE SET
            last_worked_date = CURRENT_DATE,
            is_active = 1
    """, (contractor_id, worker_id))
    conn.commit()
    conn.close()


def assign_card_to_worker(worker_id, pin_choice):
    """Assign prepaid RuPay card to no-phone worker."""
    from agents.paisa import get_db

    if not re.match(r'^\d{4}$', str(pin_choice)):
        return {"success": False, "error": "PIN must be exactly 4 digits"}

    # Mock card assignment
    card_last4 = str(pin_choice)[::-1]  # Reverse as mock card number

    conn = get_db()
    conn.execute("""
        UPDATE workers SET
            card_assigned = 1,
            card_last4 = ?,
            card_pin_set = 1
        WHERE worker_id = ?
    """, (card_last4, worker_id))
    conn.commit()
    conn.close()

    return {
        "success": True,
        "card_last4": card_last4,
        "card_type": "RuPay Prepaid"
    }


# ─────────────────────────────────────────
# Main Payroll Processing
# ─────────────────────────────────────────

def process_payroll(vani_output: dict) -> dict:
    """
    Main HISAAB function.
    Takes VANI's output, validates wages, matches workers.
    Returns finalized payroll ready for payment.
    """
    try:
        contractor = CONSTANTS.get("demo_contractor", {})
        state = contractor.get("state", "Delhi")
        known_workers = CONSTANTS.get("demo_workers", [])
        payroll_date = CONSTANTS.get("demo_date", "2026-03-29")

        entries = []
        total_payout = 0.0

        for pe in vani_output.get("payroll_entries", []):
            if not isinstance(pe, dict):
                continue

            worker_name = str(pe.get("worker_name", pe.get("name", "Unknown Worker")))
            try:
                days_worked = float(pe.get("days_worked", 1.0))
            except (ValueError, TypeError):
                days_worked = 1.0
            try:
                rate_per_day = float(pe.get("rate_per_day", 700))
            except (ValueError, TypeError):
                rate_per_day = 700.0

            # Match worker
            worker = match_worker(worker_name, known_workers)

            # Validate wage
            wage_check = validate_wage(rate_per_day, state)

            # Calculate pay
            gross_pay = days_worked * rate_per_day
            deductions = float(pe.get("deductions", 0))
            net_pay = gross_pay - deductions

            # Determine delivery method
            phone_type = worker.get("phone_type", "feature_phone")
            delivery = get_delivery_method(phone_type)

            entry = {
                "worker_id": worker.get("id", worker.get("worker_id", f"W_NEW")),
                "worker_name": worker["name"],
                "aadhaar_last4": worker.get("aadhaar_last4", "0000"),
                "days_worked": days_worked,
                "rate_per_day": rate_per_day,
                "gross_pay": gross_pay,
                "deductions": deductions,
                "net_pay": net_pay,
                "wage_compliant": wage_check["compliant"],
                "wage_warning": wage_check["warning_hindi"],
                "minimum_wage": wage_check["minimum_required"],
                "phone_type": phone_type,
                "delivery_method": delivery,
                "days_in_system": worker.get("days_in_system", 0),
                "is_new_worker": worker.get("is_new", False)
            }
            entries.append(entry)
            total_payout += net_pay

        return {
            "status": "success",
            "payroll_date": payroll_date,
            "contractor": contractor,
            "entries": entries,
            "total_payout": total_payout,
            "worker_count": len(entries)
        }

    except Exception as e:
        return {
            "status": "error",
            "payroll_date": CONSTANTS.get("demo_date", ""),
            "contractor": CONSTANTS.get("demo_contractor", {}),
            "entries": [],
            "total_payout": 0.0,
            "worker_count": 0,
            "error_message": str(e)
        }
