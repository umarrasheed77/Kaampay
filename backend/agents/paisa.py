"""
PAISA — Payments & Score Agent
Simulates Paytm UPI payments and computes MazdoorScore credit identity.
Takes input from HISAAB, passes output to RANG.
"""

import os
import json
import uuid
import random
import sqlite3
from datetime import datetime, timedelta

# Database path
DB_DIR = os.path.join(os.path.dirname(__file__), '..', 'db')
DB_PATH = os.path.join(DB_DIR, 'mazdoorpay.db')

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)


def get_db():
    """Get database connection."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables and seed demo data."""
    conn = get_db()
    cursor = conn.cursor()

    # Create table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payroll_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id TEXT,
            worker_name TEXT,
            payroll_date DATE,
            days_worked REAL,
            gross_pay REAL,
            rate_per_day REAL,
            contractor_id TEXT,
            transaction_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Check if already seeded
    count = cursor.execute("SELECT COUNT(*) FROM payroll_history").fetchone()[0]
    if count == 0:
        seed_demo_data(cursor)

    conn.commit()
    conn.close()


def seed_demo_data(cursor):
    """Pre-populate database with historical payroll data for demo workers."""
    workers = CONSTANTS["demo_workers"]
    contractor_id = CONSTANTS["demo_contractor"]["paytm_id"]
    base_date = datetime.now()

    for worker in workers:
        days_to_seed = worker["days_in_system"]
        rates = [650, 700, 700, 750, 700, 680, 700]  # Realistic rate variation

        for i in range(days_to_seed):
            # Not every day — skip some for realism (weekends, rain days)
            if random.random() < 0.15:
                continue

            payroll_date = (base_date - timedelta(days=days_to_seed - i)).strftime("%Y-%m-%d")
            rate = random.choice(rates)
            days_worked = random.choice([1.0, 1.0, 1.0, 0.5])  # Mostly full days
            gross_pay = rate * days_worked
            txn_id = f"PAY{uuid.uuid4().hex[:12].upper()}"

            cursor.execute("""
                INSERT INTO payroll_history 
                (worker_id, worker_name, payroll_date, days_worked, gross_pay, rate_per_day, contractor_id, transaction_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (worker["id"], worker["name"], payroll_date, days_worked, gross_pay, rate, contractor_id, txn_id))


def execute_mock_payment(entry: dict) -> dict:
    """
    Simulate a Paytm UPI payment. Looks real, is fake.
    Returns realistic transaction data.
    """
    txn_id = f"PAY{uuid.uuid4().hex[:12].upper()}"
    upi_ref = f"PAYTM{random.randint(100000000, 999999999)}"
    timestamp = datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30")

    # Delivery status messages
    delivery_messages = {
        "whatsapp_payslip": f"WhatsApp payslip sent to {entry['worker_name']} ✓",
        "sms_payslip": f"SMS payslip sent to {entry['worker_name']} ✓",
        "qr_paper_receipt": f"QR paper receipt ready for {entry['worker_name']} ✓"
    }

    return {
        "transaction_id": txn_id,
        "upi_reference": upi_ref,
        "worker_id": entry["worker_id"],
        "worker_name": entry["worker_name"],
        "amount": entry["net_pay"],
        "status": "SUCCESS",
        "timestamp": timestamp,
        "delivery_method": entry["delivery_method"],
        "delivery_status": delivery_messages.get(entry["delivery_method"], "Sent ✓"),
        "message_hindi": f"{entry['worker_name']} ko ₹{int(entry['net_pay'])} bhej diye gaye. UPI Ref: {upi_ref}"
    }


def save_payroll_record(entry: dict, txn_id: str):
    """Save payroll record to SQLite for MazdoorScore calculation."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO payroll_history 
        (worker_id, worker_name, payroll_date, days_worked, gross_pay, rate_per_day, contractor_id, transaction_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        entry["worker_id"],
        entry["worker_name"],
        CONSTANTS["demo_date"],
        entry["days_worked"],
        entry["gross_pay"],
        entry["rate_per_day"],
        CONSTANTS["demo_contractor"]["paytm_id"],
        txn_id
    ))
    conn.commit()
    conn.close()


def calculate_progress(score: int, band: str) -> dict:
    """Calculate progress to next band."""
    band_thresholds = {
        "no_score": {"next": "basic", "threshold": 300, "max": 300},
        "basic": {"next": "developing", "threshold": 500, "max": 500},
        "developing": {"next": "established", "threshold": 650, "max": 650},
        "established": {"next": "prime", "threshold": 750, "max": 750},
        "prime": {"next": "prime", "threshold": 850, "max": 850}
    }
    info = band_thresholds.get(band, band_thresholds["no_score"])
    progress = min(100, int((score / info["max"]) * 100))
    points_needed = max(0, info["threshold"] - score)
    return {
        "next_band": info["next"],
        "points_needed": points_needed,
        "progress_percent": progress
    }


def calculate_mazdoor_score(worker_id: str) -> dict:
    """
    Calculate MazdoorScore for a worker based on their payroll history.
    Score range: 0-850, 5 bands.
    """
    conn = get_db()
    cursor = conn.cursor()

    # Fetch last 90 days of records
    records = cursor.execute("""
        SELECT * FROM payroll_history 
        WHERE worker_id = ? 
        AND payroll_date >= date('now', '-90 days')
        ORDER BY payroll_date ASC
    """, (worker_id,)).fetchall()

    conn.close()

    if len(records) < 5:
        return {
            "score": 0,
            "band": "building",
            "days_in_system": len(records),
            "total_days_worked_90d": 0,
            "total_earned_90d": 0,
            "message": "Score builds after 5 verified payments",
            "message_hindi": "Score 5 verified payments ke baad banta hai",
            "progress_to_next_band": {"next_band": "basic", "points_needed": 300, "progress_percent": 0},
            "factors": [],
            "eligibility": []
        }

    days_worked = sum(r["days_worked"] for r in records)
    total_pay = sum(r["gross_pay"] for r in records)
    unique_contractors = len(set(r["contractor_id"] for r in records))

    # Score formula — weighted sum, max 850
    consistency_bonus = min(days_worked * 4, 200)
    longevity_bonus = min(len(records) * 3, 150)
    earnings_bonus = min(total_pay / 50, 200)
    diversity_bonus = min(unique_contractors * 25, 100)
    base_score = 300

    raw_score = base_score + consistency_bonus + longevity_bonus + earnings_bonus + diversity_bonus
    final_score = min(int(raw_score), 850)

    # Determine band
    if final_score < 300:
        band = "no_score"
    elif final_score < 500:
        band = "basic"
    elif final_score < 650:
        band = "developing"
    elif final_score < 750:
        band = "established"
    else:
        band = "prime"

    band_messages = {
        "basic": "₹2,000 emergency loan eligible",
        "developing": "₹10,000 loan + insurance eligible",
        "established": "₹25,000 loan + govt schemes eligible",
        "prime": "₹50,000 loan + bank referral eligible"
    }

    band_messages_hindi = {
        "basic": "₹2,000 emergency loan ke liye eligible",
        "developing": "₹10,000 loan + insurance ke liye eligible",
        "established": "₹25,000 loan + sarkari yojanaon ke liye eligible",
        "prime": "₹50,000 loan + bank referral ke liye eligible"
    }

    # Eligibility list based on band
    eligibility = []
    if band in ["basic", "developing", "established", "prime"]:
        eligibility.append({
            "name": "Emergency Loan",
            "name_hindi": "Emergency Loan",
            "amount": "₹2,000",
            "provider": "Paytm Postpaid",
            "icon": "loan"
        })
    if band in ["developing", "established", "prime"]:
        eligibility.append({
            "name": "Personal Loan",
            "name_hindi": "Personal Loan",
            "amount": "₹10,000",
            "provider": "Paytm Postpaid",
            "icon": "loan"
        })
        eligibility.append({
            "name": "PMJJBY Health Insurance",
            "name_hindi": "PMJJBY Swasthya Bima",
            "amount": "₹330/year",
            "provider": "Govt of India",
            "icon": "insurance"
        })
    if band in ["established", "prime"]:
        eligibility.append({
            "name": "PM Vishwakarma Scheme",
            "name_hindi": "PM Vishwakarma Yojana",
            "amount": "Up to ₹3,00,000",
            "provider": "Govt of India",
            "icon": "scheme"
        })
    if band == "prime":
        eligibility.append({
            "name": "Bank Account Referral",
            "name_hindi": "Bank Account Referral",
            "amount": "₹50,000 loan",
            "provider": "Partner Banks",
            "icon": "bank"
        })

    # Score factors for visualization
    factors = [
        {"name": "Work Consistency", "name_hindi": "Kaam ki Niyamitata", "value": int(consistency_bonus), "max": 200},
        {"name": "Time on Platform", "name_hindi": "Platform par Samay", "value": int(longevity_bonus), "max": 150},
        {"name": "Total Earnings", "name_hindi": "Kul Kamaai", "value": int(earnings_bonus), "max": 200},
        {"name": "Employer Diversity", "name_hindi": "Vibhinn Niyokta", "value": int(diversity_bonus), "max": 100},
    ]

    return {
        "score": final_score,
        "band": band,
        "days_in_system": len(records),
        "total_days_worked_90d": days_worked,
        "total_earned_90d": total_pay,
        "message": band_messages.get(band, "Keep working to build your score"),
        "message_hindi": band_messages_hindi.get(band, "Score badhane ke liye kaam karte rahein"),
        "progress_to_next_band": calculate_progress(final_score, band),
        "factors": factors,
        "eligibility": eligibility
    }


def get_worker_history(worker_id: str, limit: int = 8) -> list:
    """Get recent payslip history for a worker."""
    conn = get_db()
    cursor = conn.cursor()
    records = cursor.execute("""
        SELECT payroll_date, days_worked, gross_pay, rate_per_day, transaction_id
        FROM payroll_history 
        WHERE worker_id = ?
        ORDER BY payroll_date DESC
        LIMIT ?
    """, (worker_id, limit)).fetchall()
    conn.close()

    return [
        {
            "date": r["payroll_date"],
            "days_worked": r["days_worked"],
            "gross_pay": r["gross_pay"],
            "rate_per_day": r["rate_per_day"],
            "transaction_id": r["transaction_id"]
        }
        for r in records
    ]


def execute_all_payments(hisaab_output: dict) -> dict:
    """
    Process all payments and compute scores.
    
    Output contract:
    {
        "payment_results": [...],
        "scores": { "W001": {...}, ... },
        "total_paid": float,
        "payment_status": "all_success"
    }
    """
    try:
        # Initialize DB on first use
        init_db()

        payment_results = []
        scores = {}

        for entry in hisaab_output.get("entries", []):
            # Execute mock payment
            payment = execute_mock_payment(entry)
            payment_results.append(payment)

            # Save to history
            save_payroll_record(entry, payment["transaction_id"])

            # Calculate score
            score = calculate_mazdoor_score(entry["worker_id"])
            scores[entry["worker_id"]] = score

        total_paid = sum(p["amount"] for p in payment_results)
        all_success = all(p["status"] == "SUCCESS" for p in payment_results)

        return {
            "payment_results": payment_results,
            "scores": scores,
            "total_paid": total_paid,
            "payment_status": "all_success" if all_success else "partial_failure"
        }

    except Exception as e:
        # Fallback — never crash the demo
        return {
            "payment_results": [],
            "scores": {},
            "total_paid": 0,
            "payment_status": "error",
            "error_message": str(e)
        }
