"""
HISAAB — Payroll Calculation Agent
Validates wages, matches workers, and produces finalized payroll records.
Takes input from VANI, passes output to PAISA and KAGAZ.
"""

import os
import json
from rapidfuzz import process

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)

WAGES_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'minimum_wages.json')
with open(WAGES_PATH, 'r', encoding='utf-8') as f:
    MINIMUM_WAGES = json.load(f)


def match_worker(name: str, known_workers: list) -> dict:
    """Fuzzy match worker name to known workers in constants."""
    names = [w["name"] for w in known_workers]
    result = process.extractOne(name, names)
    if result is None:
        return {
            "id": f"W_NEW_{name[:3].upper()}",
            "name": name,
            "aadhaar_last4": "0000",
            "paytm_wallet": f"MOCK_NEW_{name[:3].upper()}",
            "phone_type": "feature_phone",
            "days_in_system": 0,
            "is_new": True
        }
    match, score, idx = result
    if score >= 75:
        worker = known_workers[idx].copy()
        worker["is_new"] = False
        return worker
    else:
        return {
            "id": f"W_NEW_{name[:3].upper()}",
            "name": name,
            "aadhaar_last4": "0000",
            "paytm_wallet": f"MOCK_NEW_{name[:3].upper()}",
            "phone_type": "feature_phone",
            "days_in_system": 0,
            "is_new": True
        }


def validate_wage(rate_per_day: float, state: str, job_category: str = "unskilled") -> dict:
    """Check if wage meets minimum wage for the state."""
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
        "no_phone": "qr_paper_receipt"
    }
    return methods.get(phone_type, "qr_paper_receipt")


def process_payroll(vani_output: dict) -> dict:
    """
    Main HISAAB function.
    Takes VANI's output, validates wages, matches workers, returns finalized payroll.
    
    Output contract:
    {
        "payroll_date": "2026-03-29",
        "contractor": {...},
        "entries": [...],
        "total_payout": float,
        "worker_count": int
    }
    """
    try:
        contractor = CONSTANTS["demo_contractor"]
        state = contractor.get("state", "Delhi")
        known_workers = CONSTANTS["demo_workers"]
        payroll_date = CONSTANTS["demo_date"]

        entries = []
        total_payout = 0.0

        for pe in vani_output.get("payroll_entries", []):
            # Match worker
            worker = match_worker(pe["worker_name"], known_workers)

            # Validate wage
            wage_check = validate_wage(pe["rate_per_day"], state)

            # Calculate net pay (no deductions for demo)
            gross_pay = pe["days_worked"] * pe["rate_per_day"]
            deductions = 0
            net_pay = gross_pay - deductions

            # Determine delivery method
            delivery = get_delivery_method(worker.get("phone_type", "feature_phone"))

            entry = {
                "worker_id": worker["id"],
                "worker_name": worker["name"],
                "aadhaar_last4": worker.get("aadhaar_last4", "0000"),
                "days_worked": pe["days_worked"],
                "rate_per_day": pe["rate_per_day"],
                "gross_pay": gross_pay,
                "deductions": deductions,
                "net_pay": net_pay,
                "wage_compliant": wage_check["compliant"],
                "wage_warning": wage_check["warning_hindi"],
                "minimum_wage": wage_check["minimum_required"],
                "phone_type": worker.get("phone_type", "feature_phone"),
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
