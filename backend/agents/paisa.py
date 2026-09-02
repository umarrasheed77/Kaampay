"""
PAISA — Payments & Score Agent
Simulates Paytm UPI payments and computes KaamScore credit identity.
Takes input from HISAAB, passes output to RANG.

v2.0 — Full overhaul:
- New 8-table database schema
- Payment retry logic (max 2 retries)
- Contractor balance check
- KaamScore with seasonal gaps + anti-gaming
- Score history tracking
"""

import os
import re
import json
import uuid
import random
import sqlite3
import time
import statistics
from datetime import datetime, date, timedelta
from enum import Enum

# Database path
DB_DIR = os.path.join(os.path.dirname(__file__), '..', 'db')
DB_PATH = os.path.join(DB_DIR, 'kaampay.db')

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)

# Months where construction work naturally slows (monsoon)
SEASONAL_LOW_MONTHS = [6, 7, 8, 9]

MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 0.5  # Short for demo

DEFAULT_CONTRACTOR_ID = "CONT_001"
# Fixed demo token (seeded once, deterministic) so the shipped demo/docs
# can reference it directly. A real deployment would issue per-contractor
# tokens at signup rather than relying on any fixed value.
DEMO_CONTRACTOR_TOKEN = os.environ.get("DEMO_CONTRACTOR_TOKEN", "demo-contractor-token-CONT001")


class PaymentStatus(Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    RETRY_1 = "RETRY_1"
    RETRY_2 = "RETRY_2"
    HELD = "HELD"


def get_db():
    """Get database connection with row factory."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _ensure_column(cursor, table, column, col_type):
    """Add `column` to `table` if it doesn't already exist (safe on repeated calls)."""
    existing = [row[1] for row in cursor.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in existing:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")


def init_db():
    """Create all tables and seed demo data."""
    conn = get_db()
    cursor = conn.cursor()

    # ── Drop old table if exists (migration from v1)
    cursor.execute("DROP TABLE IF EXISTS payroll_history")

    # ── CONTRACTORS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contractors (
            contractor_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            business_name TEXT NOT NULL,
            phone_number TEXT UNIQUE NOT NULL,
            state TEXT NOT NULL,
            paytm_account_id TEXT,
            paytm_balance REAL DEFAULT 0,
            total_workers INTEGER DEFAULT 0,
            total_paid_lifetime REAL DEFAULT 0,
            date_registered DATE DEFAULT CURRENT_DATE,
            is_active INTEGER DEFAULT 1,
            contractor_token TEXT UNIQUE
        )
    """)
    # Migration: older DBs created before this column existed
    _ensure_column(cursor, "contractors", "contractor_token", "TEXT")

    # ── WORKERS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workers (
            worker_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone_number TEXT,
            phone_type TEXT DEFAULT 'smartphone',
            aadhaar_last4 TEXT,
            aadhaar_verified INTEGER DEFAULT 0,
            card_assigned INTEGER DEFAULT 0,
            card_last4 TEXT,
            card_pin_set INTEGER DEFAULT 0,
            job_type TEXT DEFAULT 'unskilled',
            state TEXT,
            kaam_score INTEGER DEFAULT 0,
            kaam_band TEXT DEFAULT 'building',
            score_last_updated DATE,
            total_days_worked REAL DEFAULT 0,
            total_earned_lifetime REAL DEFAULT 0,
            first_payment_date DATE,
            last_payment_date DATE,
            date_registered DATE DEFAULT CURRENT_DATE,
            registered_by_contractor TEXT,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (registered_by_contractor) REFERENCES contractors(contractor_id)
        )
    """)

    # ── CONTRACTOR_WORKER_RELATIONSHIPS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contractor_worker_relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contractor_id TEXT NOT NULL,
            worker_id TEXT NOT NULL,
            first_worked_date DATE DEFAULT CURRENT_DATE,
            last_worked_date DATE,
            total_days_for_this_contractor REAL DEFAULT 0,
            total_earned_from_this_contractor REAL DEFAULT 0,
            is_active INTEGER DEFAULT 1,
            UNIQUE(contractor_id, worker_id),
            FOREIGN KEY (contractor_id) REFERENCES contractors(contractor_id),
            FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
        )
    """)

    # ── PAYMENTS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            payment_id TEXT PRIMARY KEY,
            worker_id TEXT NOT NULL,
            contractor_id TEXT NOT NULL,
            payroll_date DATE NOT NULL,
            days_worked REAL NOT NULL,
            rate_per_day REAL NOT NULL,
            gross_pay REAL NOT NULL,
            deductions REAL DEFAULT 0,
            net_pay REAL NOT NULL,
            status TEXT DEFAULT 'PENDING',
            retry_count INTEGER DEFAULT 0,
            upi_reference TEXT,
            paytm_transaction_id TEXT,
            payment_method TEXT,
            wage_compliant INTEGER DEFAULT 1,
            minimum_wage_at_time REAL,
            dispute_raised INTEGER DEFAULT 0,
            dispute_raised_at TIMESTAMP,
            dispute_resolved INTEGER DEFAULT 0,
            dispute_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (worker_id) REFERENCES workers(worker_id),
            FOREIGN KEY (contractor_id) REFERENCES contractors(contractor_id)
        )
    """)

    # ── KAAM_SCORE_HISTORY TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS kaam_score_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            worker_id TEXT NOT NULL,
            score_date DATE NOT NULL,
            score_value INTEGER NOT NULL,
            band TEXT NOT NULL,
            days_worked_90d REAL,
            total_earned_90d REAL,
            unique_contractors_90d INTEGER,
            calculation_notes TEXT,
            FOREIGN KEY (worker_id) REFERENCES workers(worker_id)
        )
    """)

    # ── VOUCHERS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS vouchers (
            voucher_id TEXT PRIMARY KEY,
            claim_code TEXT UNIQUE NOT NULL,
            worker_id TEXT NOT NULL,
            payment_id TEXT NOT NULL,
            amount REAL NOT NULL,
            contractor_id TEXT NOT NULL,
            issued_date DATE NOT NULL,
            expiry_date DATE NOT NULL,
            status TEXT DEFAULT 'UNCLAIMED',
            redeemed_at TIMESTAMP,
            redeemed_by_agent TEXT,
            FOREIGN KEY (worker_id) REFERENCES workers(worker_id),
            FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
        )
    """)

    # ── DISPUTES TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS disputes (
            dispute_id TEXT PRIMARY KEY,
            payment_id TEXT NOT NULL,
            worker_id TEXT NOT NULL,
            contractor_id TEXT NOT NULL,
            raised_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            raised_via TEXT DEFAULT 'missed_call',
            status TEXT DEFAULT 'OPEN',
            resolution_notes TEXT,
            resolved_at TIMESTAMP,
            FOREIGN KEY (payment_id) REFERENCES payments(payment_id)
        )
    """)

    # ── LENDER_API_KEYS TABLE
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS lender_api_keys (
            key_id TEXT PRIMARY KEY,
            lender_name TEXT NOT NULL,
            api_key TEXT UNIQUE NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_used TIMESTAMP,
            total_queries INTEGER DEFAULT 0
        )
    """)

    # ── Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_payments_worker ON payments(worker_id, payroll_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_payments_contractor ON payments(contractor_id, payroll_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_workers_phone ON workers(phone_number)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_workers_aadhaar ON workers(aadhaar_last4)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_score_history_worker ON kaam_score_history(worker_id, score_date)")

    # Check if already seeded
    count = cursor.execute("SELECT COUNT(*) FROM workers").fetchone()[0]
    if count == 0:
        seed_demo_data(cursor)

    conn.commit()
    conn.close()


def seed_demo_data(cursor):
    """Pre-populate database with 90 days of demo data."""

    # Demo contractor
    cursor.execute("""
        INSERT OR IGNORE INTO contractors VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        "CONT_001", "Suresh Sharma", "Sharma Construction",
        "9876500001", "Delhi", "PAYTM_CONT_001",
        15000.0, 3, 94500.0, "2025-10-01", 1,
        DEMO_CONTRACTOR_TOKEN
    ))

    # Demo lender API key
    cursor.execute("""
        INSERT OR IGNORE INTO lender_api_keys VALUES
        (?, ?, ?, ?, ?, ?, ?)
    """, (
        "KEY_001", "Demo NBFC", "demo-api-key-12345",
        1, datetime.now().isoformat(), None, 0
    ))

    # Demo workers
    workers_data = [
        ("W001", "Ramesh Kumar", "9876500002", "feature_phone",
         "4521", 1, 0, None, 0, "unskilled", "Delhi", 47),
        ("W002", "Suresh Yadav", None, "no_phone",
         "7832", 1, 1, "8321", 1, "unskilled", "Delhi", 23),
        ("W003", "Mohan Lal", "9876500004", "smartphone",
         "3319", 1, 0, None, 0, "semi_skilled", "Delhi", 61),
    ]

    for w in workers_data:
        worker_id, name, phone, phone_type, aadhaar_last4, \
            aadhaar_verified, card_assigned, card_last4, \
            card_pin_set, job_type, state, days_in_system = w

        reg_date = (date.today() - timedelta(days=days_in_system)).isoformat()

        cursor.execute("""
            INSERT OR IGNORE INTO workers
            (worker_id, name, phone_number, phone_type,
             aadhaar_last4, aadhaar_verified,
             card_assigned, card_last4, card_pin_set,
             job_type, state,
             date_registered, registered_by_contractor, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            worker_id, name, phone, phone_type,
            aadhaar_last4, aadhaar_verified,
            card_assigned, card_last4, card_pin_set,
            job_type, state,
            reg_date, "CONT_001", 1
        ))

        # Link worker to contractor
        cursor.execute("""
            INSERT OR IGNORE INTO contractor_worker_relationships
            (contractor_id, worker_id, first_worked_date)
            VALUES (?, ?, ?)
        """, ("CONT_001", worker_id, reg_date))

        # Insert payment history
        start_date = date.today() - timedelta(days=days_in_system)
        current = start_date
        total_days = 0
        total_earned = 0

        while current <= date.today():
            # Workers don't work every day — skip ~25%
            if random.random() > 0.25:
                days_worked = random.choice([0.5, 1.0, 1.0, 1.0])
                rate = random.choice([700, 700, 750, 650])
                net = days_worked * rate
                payment_method = "upi" if phone else "card_load"

                cursor.execute("""
                    INSERT OR IGNORE INTO payments
                    (payment_id, worker_id, contractor_id,
                     payroll_date, days_worked, rate_per_day,
                     gross_pay, deductions, net_pay, status,
                     upi_reference, payment_method,
                     wage_compliant, minimum_wage_at_time)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()), worker_id, "CONT_001",
                    current.isoformat(), days_worked, rate,
                    net, 0, net, "SUCCESS",
                    f"PAYTM{random.randint(100000000, 999999999)}",
                    payment_method, 1, 746
                ))
                total_days += days_worked
                total_earned += net

            current += timedelta(days=1)

        # Update worker lifetime stats
        cursor.execute("""
            UPDATE workers SET
                total_days_worked = ?,
                total_earned_lifetime = ?,
                first_payment_date = ?,
                last_payment_date = ?
            WHERE worker_id = ?
        """, (total_days, total_earned,
              start_date.isoformat(), date.today().isoformat(),
              worker_id))

        # Update relationship stats
        cursor.execute("""
            UPDATE contractor_worker_relationships SET
                last_worked_date = ?,
                total_days_for_this_contractor = ?,
                total_earned_from_this_contractor = ?
            WHERE contractor_id = ? AND worker_id = ?
        """, (date.today().isoformat(), total_days, total_earned,
              "CONT_001", worker_id))

    # Seed score history (weekly snapshots for the last 60 days)
    for w in workers_data:
        worker_id = w[0]
        days_in_system = w[11]
        for week_offset in range(0, min(days_in_system, 60), 7):
            score_date = (date.today() - timedelta(days=days_in_system - week_offset)).isoformat()
            # Score grows roughly linearly for demo
            base = 300 + int((week_offset / max(days_in_system, 1)) * 400)
            score_val = min(base + random.randint(-20, 20), 850)
            band = get_band_for_score(score_val)
            cursor.execute("""
                INSERT INTO kaam_score_history
                (worker_id, score_date, score_value, band,
                 days_worked_90d, total_earned_90d, unique_contractors_90d)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (worker_id, score_date, score_val, band,
                  week_offset * 0.75, week_offset * 525, 1))

    print("[PAISA] Demo data seeded — 3 workers, 90 days of payments")


def get_band_for_score(score):
    """Get band name from score value."""
    if score < 300:
        return "building"
    elif score < 500:
        return "basic"
    elif score < 650:
        return "developing"
    elif score < 750:
        return "established"
    else:
        return "prime"


# ─────────────────────────────────────────
# Payment Execution with Retry (FIX 06)
# ─────────────────────────────────────────

def attempt_single_payment(entry):
    """Single payment attempt. Demo: 95% success rate."""
    time.sleep(0.3)  # Simulate network delay (short for demo)

    if random.random() < 0.95:
        return {
            "success": True,
            "upi_reference": f"PAYTM{random.randint(100000000, 999999999)}",
            "txn_id": f"PAY{uuid.uuid4().hex[:12].upper()}"
        }
    else:
        return {
            "success": False,
            "error_code": random.choice([
                "INSUFFICIENT_FUNDS", "NETWORK_TIMEOUT", "BANK_DECLINED"
            ])
        }


def execute_payment_with_retry(entry, payment_id, conn=None):
    """
    Attempts payment up to MAX_RETRIES + 1 times.
    Never silently fails — always returns clear status.

    Accepts an optional shared `conn` so a caller processing many
    entries in one batch (see execute_all_payments) can reuse a single
    connection instead of opening/closing a new one per worker per
    attempt.
    """
    should_close = False
    if conn is None:
        conn = get_db()
        should_close = True
    attempt = 0

    while attempt <= MAX_RETRIES:
        # Update status to show current attempt
        if attempt == 0:
            status = PaymentStatus.PENDING
        elif attempt == 1:
            status = PaymentStatus.RETRY_1
        else:
            status = PaymentStatus.RETRY_2

        conn.execute(
            "UPDATE payments SET status = ?, retry_count = ? WHERE payment_id = ?",
            (status.value, attempt, payment_id)
        )
        conn.commit()

        # Attempt the payment
        result = attempt_single_payment(entry)

        if result["success"]:
            conn.execute("""
                UPDATE payments SET
                    status = 'SUCCESS',
                    upi_reference = ?,
                    paytm_transaction_id = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE payment_id = ?
            """, (result["upi_reference"], result["txn_id"], payment_id))
            conn.commit()
            if should_close:
                conn.close()

            # Delivery status messages
            delivery_messages = {
                "whatsapp_payslip": f"WhatsApp payslip sent to {entry['worker_name']} ✓",
                "sms_payslip": f"SMS payslip sent to {entry['worker_name']} ✓",
                "qr_paper_receipt": f"QR paper receipt ready for {entry['worker_name']} ✓",
                "card_load": f"Loaded to RuPay card for {entry['worker_name']} ✓"
            }

            return {
                "payment_id": payment_id,
                "transaction_id": result["txn_id"],
                "upi_reference": result["upi_reference"],
                "worker_id": entry["worker_id"],
                "worker_name": entry["worker_name"],
                "amount": entry["net_pay"],
                "status": "SUCCESS",
                "attempts": attempt + 1,
                "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30"),
                "delivery_method": entry.get("delivery_method", "sms_payslip"),
                "delivery_status": delivery_messages.get(
                    entry.get("delivery_method", "sms_payslip"), "Sent ✓"
                ),
                "message_hindi": (
                    f"{entry['worker_name']} ko ₹{int(entry['net_pay'])} "
                    f"bhej diye gaye. UPI Ref: {result['upi_reference']}"
                )
            }

        attempt += 1
        if attempt <= MAX_RETRIES:
            time.sleep(RETRY_DELAY_SECONDS)

    # All retries exhausted
    conn.execute(
        "UPDATE payments SET status = 'HELD', updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?",
        (payment_id,)
    )
    conn.commit()
    if should_close:
        conn.close()

    return {
        "payment_id": payment_id,
        "transaction_id": None,
        "upi_reference": None,
        "worker_id": entry["worker_id"],
        "worker_name": entry["worker_name"],
        "amount": entry["net_pay"],
        "status": "HELD",
        "attempts": MAX_RETRIES + 1,
        "timestamp": datetime.now().strftime("%Y-%m-%dT%H:%M:%S+05:30"),
        "delivery_method": entry.get("delivery_method", "sms_payslip"),
        "delivery_status": f"Payment held for {entry['worker_name']}",
        "message_hindi": (
            f"{entry['worker_name']} ka payment fail hua. "
            f"₹{int(entry['net_pay'])} aapke account mein hold hai."
        ),
        "action_required": True
    }


# ─────────────────────────────────────────
# Balance Check (FIX 07)
# ─────────────────────────────────────────

def check_contractor_balance(contractor_id, total_required):
    """Check if contractor has enough balance before payment."""
    conn = get_db()
    row = conn.execute(
        "SELECT paytm_balance FROM contractors WHERE contractor_id = ?",
        (contractor_id,)
    ).fetchone()
    conn.close()

    available = row["paytm_balance"] if row else 0
    sufficient = available >= total_required
    shortfall = max(0, total_required - available)

    return {
        "sufficient": sufficient,
        "available_balance": available,
        "required": total_required,
        "shortfall": shortfall,
        "message_hindi": (
            f"Balance theek hai. ₹{available} available."
            if sufficient else
            f"Balance kam hai. ₹{available} available hain "
            f"lekin ₹{total_required} chahiye. ₹{shortfall} aur add karein."
        ),
        "action": None if sufficient else "ADD_FUNDS"
    }


# ─────────────────────────────────────────
# KaamScore — Seasonal + Anti-Gaming (FIX 10+11)
# ─────────────────────────────────────────

def detect_gaming_patterns(records, worker_id):
    """Detect suspicious patterns indicating artificial score inflation."""
    if len(records) < 5:
        return {"suspicious": False, "flags": [], "flag_count": 0}

    flags = []

    # Check 1: All round numbers
    rates = [r["rate_per_day"] for r in records]
    if all(r % 100 == 0 for r in rates):
        flags.append("all_round_number_rates")

    # Check 2: Zero gaps in 30+ day period
    dates = sorted([
        date.fromisoformat(r["payroll_date"]) for r in records
    ])
    if len(dates) >= 20:
        date_range = (dates[-1] - dates[0]).days
        if date_range > 0:
            density = len(dates) / date_range
            if density > 0.95:
                flags.append("unrealistic_attendance")

    # Check 3: Rate jumps > 100% in short period
    for i in range(1, len(rates)):
        if rates[i] > rates[i - 1] * 2:
            flags.append("suspicious_rate_jump")
            break

    suspicious = len(flags) >= 2
    return {"suspicious": suspicious, "flags": flags, "flag_count": len(flags)}


def calculate_weekly_earnings(records):
    """Group records into weekly earnings for consistency analysis."""
    if not records:
        return []

    weekly = {}
    for r in records:
        d = date.fromisoformat(r["payroll_date"])
        week_key = d.isocalendar()[1]
        weekly[week_key] = weekly.get(week_key, 0) + r["net_pay"]

    return list(weekly.values())


def calculate_progress(score, band):
    """Calculate progress to next band."""
    band_thresholds = {
        "building": {"next": "basic", "threshold": 300, "max": 300},
        "basic": {"next": "developing", "threshold": 500, "max": 500},
        "developing": {"next": "established", "threshold": 650, "max": 650},
        "established": {"next": "prime", "threshold": 750, "max": 750},
        "prime": {"next": "prime", "threshold": 850, "max": 850}
    }
    info = band_thresholds.get(band, band_thresholds["building"])
    progress = min(100, int((score / info["max"]) * 100))
    points_needed = max(0, info["threshold"] - score)
    return {
        "next_band": info["next"],
        "points_needed": points_needed,
        "progress_percent": progress
    }


def calculate_kaam_score(worker_id, conn=None):
    """
    Calculate KaamScore from verified payment history.
    Anti-gaming: only payments with valid upi_reference are counted.
    Seasonal: monsoon months (Jun-Sep) don't penalize.
    """
    should_close = False
    if conn is None:
        conn = get_db()
        should_close = True

    # Fetch 90 days of VERIFIED payments only
    records = conn.execute("""
        SELECT * FROM payments
        WHERE worker_id = ?
        AND status = 'SUCCESS'
        AND upi_reference IS NOT NULL
        AND payroll_date >= date('now', '-90 days')
        ORDER BY payroll_date ASC
    """, (worker_id,)).fetchall()

    if len(records) < 3:
        if should_close:
            conn.close()
        return {
            "score": 0,
            "band": "building",
            "days_in_system": len(records),
            "total_days_worked_90d": 0,
            "total_earned_90d": 0,
            "total_payments": len(records),
            "unique_contractors": 0,
            "loan_eligible": None,
            "message": "Score builds after first few payments",
            "message_hindi": "Score kuch payments ke baad banta hai",
            "progress_to_next_band": {"next_band": "basic", "points_needed": 300, "progress_percent": 0},
            "factors": [],
            "eligibility": [],
            "benefits": []
        }

    records = [dict(r) for r in records]

    # SEASONAL ADJUSTMENT — filter monsoon months for consistency only
    non_seasonal_records = [
        r for r in records
        if date.fromisoformat(r["payroll_date"]).month not in SEASONAL_LOW_MONTHS
    ]

    # METRICS
    total_days = sum(r["days_worked"] for r in records)
    total_earned = sum(r["net_pay"] for r in records)
    unique_contractors = len(set(r["contractor_id"] for r in records))

    # Weekly earnings for consistency (using non-seasonal)
    weekly_earnings = calculate_weekly_earnings(
        non_seasonal_records if non_seasonal_records else records
    )

    # Consistency score
    if len(weekly_earnings) > 1:
        std_dev = statistics.stdev(weekly_earnings)
        avg_weekly = statistics.mean(weekly_earnings)
        consistency_ratio = (1 - min(std_dev / max(avg_weekly, 1), 1))
        consistency_score = consistency_ratio * 150
    else:
        consistency_score = 75

    # ANTI-GAMING CHECK
    gaming_flag = detect_gaming_patterns(records, worker_id)
    gaming_penalty = 0.7 if gaming_flag["suspicious"] else 1.0

    # SCORE CALCULATION
    base_score = 300
    days_bonus = min(total_days * 3.5, 180)
    earnings_bonus = min(total_earned / 60, 180)
    contractor_diversity = min(unique_contractors * 30, 90)

    raw_score = (
        base_score + days_bonus + earnings_bonus +
        consistency_score + contractor_diversity
    ) * gaming_penalty

    final_score = min(int(raw_score), 850)

    # BAND DETERMINATION
    band = get_band_for_score(final_score)

    band_config = {
        "building": {"loan": None, "benefits": []},
        "basic": {
            "loan": "₹2,000",
            "benefits": ["₹2,000 emergency loan"]
        },
        "developing": {
            "loan": "₹10,000",
            "benefits": [
                "₹10,000 personal loan",
                "PMJJBY life insurance (₹330/year)",
                "Ration card linkage support"
            ]
        },
        "established": {
            "loan": "₹25,000",
            "benefits": [
                "₹25,000 business loan",
                "PM Vishwakarma scheme",
                "PM Suraksha Bima insurance",
                "Priority govt scheme enrollment"
            ]
        },
        "prime": {
            "loan": "₹50,000",
            "benefits": [
                "₹50,000 loan",
                "Formal bank account referral",
                "All government schemes",
                "Priority KaamPay support"
            ]
        }
    }

    config = band_config.get(band, band_config["building"])

    # Eligibility list
    eligibility = []
    if band in ["basic", "developing", "established", "prime"]:
        eligibility.append({
            "name": "Emergency Loan", "name_hindi": "Emergency Loan",
            "amount": "₹2,000", "provider": "Paytm Postpaid", "icon": "loan"
        })
    if band in ["developing", "established", "prime"]:
        eligibility.append({
            "name": "Personal Loan", "name_hindi": "Personal Loan",
            "amount": "₹10,000", "provider": "Paytm Postpaid", "icon": "loan"
        })
        eligibility.append({
            "name": "PMJJBY Health Insurance", "name_hindi": "PMJJBY Swasthya Bima",
            "amount": "₹330/year", "provider": "Govt of India", "icon": "insurance"
        })
    if band in ["established", "prime"]:
        eligibility.append({
            "name": "PM Vishwakarma Scheme", "name_hindi": "PM Vishwakarma Yojana",
            "amount": "Up to ₹3,00,000", "provider": "Govt of India", "icon": "scheme"
        })
    if band == "prime":
        eligibility.append({
            "name": "Bank Account Referral", "name_hindi": "Bank Account Referral",
            "amount": "₹50,000 loan", "provider": "Partner Banks", "icon": "bank"
        })

    # Score factors
    factors = [
        {"name": "Work Consistency", "name_hindi": "Kaam ki Niyamitata",
         "value": int(consistency_score), "max": 150},
        {"name": "Days Worked", "name_hindi": "Kaam ke Din",
         "value": int(days_bonus), "max": 180},
        {"name": "Total Earnings", "name_hindi": "Kul Kamaai",
         "value": int(earnings_bonus), "max": 180},
        {"name": "Employer Diversity", "name_hindi": "Vibhinn Niyokta",
         "value": int(contractor_diversity), "max": 90},
    ]

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

    # Save to score history
    try:
        conn.execute("""
            INSERT INTO kaam_score_history
            (worker_id, score_date, score_value, band,
             days_worked_90d, total_earned_90d, unique_contractors_90d)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (worker_id, date.today().isoformat(), final_score, band,
              total_days, total_earned, unique_contractors))

        # Update worker record
        conn.execute("""
            UPDATE workers SET kaam_score = ?, kaam_band = ?,
            score_last_updated = ? WHERE worker_id = ?
        """, (final_score, band, date.today().isoformat(), worker_id))
        conn.commit()
    except Exception:
        pass  # Non-critical — don't break payment flow

    if should_close:
        conn.close()

    return {
        "score": final_score,
        "band": band,
        "days_in_system": len(records),
        "total_days_worked_90d": total_days,
        "total_earned_90d": total_earned,
        "total_payments": len(records),
        "unique_contractors": unique_contractors,
        "loan_eligible": config["loan"],
        "message": band_messages.get(band, "Keep working to build your score"),
        "message_hindi": band_messages_hindi.get(band, "Score badhane ke liye kaam karte rahein"),
        "progress_to_next_band": calculate_progress(final_score, band),
        "factors": factors,
        "eligibility": eligibility,
        "benefits": config["benefits"]
    }


def get_worker_history(worker_id, limit=8):
    """Get recent payment history for a worker."""
    conn = get_db()
    records = conn.execute("""
        SELECT payroll_date, days_worked, net_pay as gross_pay,
               rate_per_day, paytm_transaction_id as transaction_id,
               upi_reference, status
        FROM payments
        WHERE worker_id = ?
        AND status = 'SUCCESS'
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
            "transaction_id": r["transaction_id"] or "N/A"
        }
        for r in records
    ]


def get_score_history(worker_id, days=90):
    """Get score progression over time."""
    conn = get_db()
    history = conn.execute("""
        SELECT score_date, score_value, band
        FROM kaam_score_history
        WHERE worker_id = ?
        AND score_date >= date('now', ? || ' days')
        ORDER BY score_date ASC
    """, (worker_id, f"-{days}")).fetchall()
    conn.close()

    history_list = [dict(h) for h in history]
    current = history_list[-1]["score_value"] if history_list else 0
    score_30d = None
    if history_list:
        cutoff = (date.today() - timedelta(days=30)).isoformat()
        older = [h for h in history_list if h["score_date"] <= cutoff]
        if older:
            score_30d = older[-1]["score_value"]

    return {
        "worker_id": worker_id,
        "history": history_list,
        "current_score": current,
        "score_30_days_ago": score_30d,
        "growth": current - score_30d if score_30d else 0
    }


# ─────────────────────────────────────────
# Contractor Dashboard Data (FIX 13)
# ─────────────────────────────────────────

def get_daily_totals(contractor_id, days=30):
    """Get daily payment totals for chart."""
    conn = get_db()
    rows = conn.execute("""
        SELECT payroll_date, SUM(net_pay) as total, COUNT(*) as count
        FROM payments
        WHERE contractor_id = ?
        AND status = 'SUCCESS'
        AND payroll_date >= date('now', ? || ' days')
        GROUP BY payroll_date
        ORDER BY payroll_date ASC
    """, (contractor_id, f"-{days}")).fetchall()
    conn.close()
    return [{"date": r["payroll_date"], "total": r["total"], "count": r["count"]} for r in rows]


def get_contractor_workers(contractor_id):
    """Get all workers for a contractor with last payment info."""
    conn = get_db()
    rows = conn.execute("""
        SELECT w.worker_id, w.name, w.job_type, w.kaam_score, w.kaam_band,
               cwr.last_worked_date, cwr.total_days_for_this_contractor,
               cwr.total_earned_from_this_contractor
        FROM workers w
        JOIN contractor_worker_relationships cwr
            ON w.worker_id = cwr.worker_id
        WHERE cwr.contractor_id = ?
        AND cwr.is_active = 1
        ORDER BY cwr.last_worked_date DESC
    """, (contractor_id,)).fetchall()
    conn.close()

    result = []
    for r in rows:
        last_date = r["last_worked_date"]
        if last_date:
            days_since = (date.today() - date.fromisoformat(last_date)).days
        else:
            days_since = 999

        result.append({
            "worker_id": r["worker_id"],
            "name": r["name"],
            "job_type": r["job_type"],
            "kaam_score": r["kaam_score"],
            "kaam_band": r["kaam_band"] or "building",
            "last_paid_date": last_date,
            "days_since_last_payment": days_since,
            "total_days": r["total_days_for_this_contractor"],
            "total_earned": r["total_earned_from_this_contractor"]
        })
    return result


def generate_contractor_insights(contractor_id):
    """Generate AI-style insights for contractor dashboard."""
    conn = get_db()
    insights = []

    # Insight 1: Most reliable worker (most days in last 30 days)
    reliable = conn.execute("""
        SELECT worker_id, COUNT(*) as cnt
        FROM payments
        WHERE contractor_id = ? AND status = 'SUCCESS'
        AND payroll_date >= date('now', '-30 days')
        GROUP BY worker_id
        ORDER BY cnt DESC LIMIT 1
    """, (contractor_id,)).fetchone()

    if reliable:
        worker = conn.execute(
            "SELECT name FROM workers WHERE worker_id = ?",
            (reliable["worker_id"],)
        ).fetchone()
        if worker:
            insights.append({
                "icon": "star",
                "text_hindi": f"{worker['name']} aapka sabse regular worker hai",
                "text_english": f"{worker['name']} is your most reliable worker",
                "type": "positive"
            })

    # Insight 2: Spending trend
    this_week = conn.execute("""
        SELECT COALESCE(SUM(net_pay), 0) as total FROM payments
        WHERE contractor_id = ? AND status = 'SUCCESS'
        AND payroll_date >= date('now', '-7 days')
    """, (contractor_id,)).fetchone()["total"]

    last_week = conn.execute("""
        SELECT COALESCE(SUM(net_pay), 0) as total FROM payments
        WHERE contractor_id = ? AND status = 'SUCCESS'
        AND payroll_date >= date('now', '-14 days')
        AND payroll_date < date('now', '-7 days')
    """, (contractor_id,)).fetchone()["total"]

    if last_week > 0:
        pct = int(((this_week - last_week) / last_week) * 100)
        if pct > 10:
            insights.append({
                "icon": "trending_up",
                "text_hindi": f"Is hafte spending {pct}% zyada hai pichhle hafte se",
                "text_english": f"Spending is {pct}% higher than last week",
                "type": "warning"
            })
        elif pct < -10:
            insights.append({
                "icon": "trending_down",
                "text_hindi": f"Is hafte spending {abs(pct)}% kam hai",
                "text_english": f"Spending is {abs(pct)}% lower than last week",
                "type": "info"
            })

    # Insight 3: Workers unpaid for 7+ days
    inactive = conn.execute("""
        SELECT w.name, cwr.last_worked_date
        FROM contractor_worker_relationships cwr
        JOIN workers w ON w.worker_id = cwr.worker_id
        WHERE cwr.contractor_id = ?
        AND cwr.is_active = 1
        AND (cwr.last_worked_date IS NULL
             OR cwr.last_worked_date < date('now', '-7 days'))
    """, (contractor_id,)).fetchall()

    if inactive:
        insights.append({
            "icon": "alert",
            "text_hindi": f"{len(inactive)} workers ko 7 din se payment nahi mili",
            "text_english": f"{len(inactive)} workers unpaid for 7+ days",
            "type": "alert"
        })

    conn.close()
    return insights


def get_today_summary(contractor_id):
    """Get today's payment summary for dashboard cards."""
    conn = get_db()
    today = date.today().isoformat()

    today_data = conn.execute("""
        SELECT COALESCE(SUM(net_pay), 0) as total,
               COUNT(DISTINCT worker_id) as workers
        FROM payments
        WHERE contractor_id = ? AND status = 'SUCCESS'
        AND payroll_date = ?
    """, (contractor_id, today)).fetchone()

    month_start = date.today().replace(day=1).isoformat()
    month_data = conn.execute("""
        SELECT COALESCE(SUM(net_pay), 0) as total
        FROM payments
        WHERE contractor_id = ? AND status = 'SUCCESS'
        AND payroll_date >= ?
    """, (contractor_id, month_start)).fetchone()

    pending = conn.execute("""
        SELECT COUNT(*) as cnt FROM payments
        WHERE contractor_id = ? AND status = 'HELD'
    """, (contractor_id,)).fetchone()

    conn.close()

    return {
        "today_total": today_data["total"],
        "today_workers": today_data["workers"],
        "month_total": month_data["total"],
        "pending_count": pending["cnt"]
    }


# ─────────────────────────────────────────
# Dispute Functions (FIX 08)
# ─────────────────────────────────────────

def raise_dispute(worker_id, payment_id=None, phone_number=None):
    """Raise a dispute on a payment."""
    conn = get_db()

    # Find worker
    if phone_number and not worker_id:
        worker = conn.execute(
            "SELECT worker_id FROM workers WHERE phone_number = ?",
            (phone_number,)
        ).fetchone()
        if worker:
            worker_id = worker["worker_id"]

    if not worker_id:
        conn.close()
        return {"success": False, "error": "Worker not found"}

    # Find the payment to dispute
    if not payment_id:
        payment = conn.execute("""
            SELECT payment_id, contractor_id FROM payments
            WHERE worker_id = ? AND status = 'SUCCESS'
            ORDER BY payroll_date DESC LIMIT 1
        """, (worker_id,)).fetchone()
    else:
        payment = conn.execute(
            "SELECT payment_id, contractor_id FROM payments WHERE payment_id = ?",
            (payment_id,)
        ).fetchone()

    if not payment:
        conn.close()
        return {"success": False, "error": "No payment found to dispute"}

    dispute_id = f"DSP_{uuid.uuid4().hex[:8].upper()}"

    conn.execute("""
        INSERT INTO disputes (dispute_id, payment_id, worker_id, contractor_id)
        VALUES (?, ?, ?, ?)
    """, (dispute_id, payment["payment_id"], worker_id, payment["contractor_id"]))

    conn.execute("""
        UPDATE payments SET dispute_raised = 1,
        dispute_raised_at = CURRENT_TIMESTAMP
        WHERE payment_id = ?
    """, (payment["payment_id"],))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "dispute_id": dispute_id,
        "payment_id": payment["payment_id"],
        "message": "Dispute raised successfully"
    }


def get_disputes(contractor_id):
    """Get all disputes for a contractor."""
    conn = get_db()
    rows = conn.execute("""
        SELECT d.*, w.name as worker_name, p.net_pay, p.payroll_date
        FROM disputes d
        JOIN workers w ON w.worker_id = d.worker_id
        JOIN payments p ON p.payment_id = d.payment_id
        WHERE d.contractor_id = ?
        ORDER BY d.raised_at DESC
    """, (contractor_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────
# Contractor Authentication
#
# Previously every endpoint hardcoded "CONT_001" with no way for any
# other contractor to authenticate — the DB schema (contractors,
# contractor_worker_relationships) was already multi-tenant-ready but
# the API layer enforced none of it. This resolves the acting
# contractor from a bearer token when one is supplied, and falls back
# to the demo contractor only when no Authorization header is present
# at all — preserving today's working demo flow while making it
# possible (and testable) for any other registered contractor to
# authenticate as themselves via their own token.
# ─────────────────────────────────────────

def get_contractor_by_token(token: str):
    """Look up a contractor by their auth token. Returns None if invalid/inactive."""
    if not token:
        return None
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM contractors WHERE contractor_token = ? AND is_active = 1",
        (token,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def resolve_contractor_id(authorization_header: str = None) -> str:
    """
    Resolves the acting contractor_id from a `Bearer <token>` Authorization
    header. Falls back to the demo contractor ONLY when no header is
    supplied at all (back-compat with the current single-tenant demo UI).
    A header that IS supplied but doesn't match any active contractor
    raises ValueError so the caller can reject the request with 401
    rather than silently acting as the demo contractor.
    """
    if not authorization_header:
        return DEFAULT_CONTRACTOR_ID

    token = authorization_header
    if authorization_header.lower().startswith("bearer "):
        token = authorization_header[7:].strip()

    contractor = get_contractor_by_token(token)
    if contractor is None:
        raise ValueError("Invalid or inactive contractor token")
    return contractor["contractor_id"]


def issue_contractor_token(contractor_id: str) -> str:
    """Generates and persists a new random auth token for a contractor."""
    token = f"ct_{uuid.uuid4().hex}"
    conn = get_db()
    conn.execute(
        "UPDATE contractors SET contractor_token = ? WHERE contractor_id = ?",
        (token, contractor_id)
    )
    conn.commit()
    conn.close()
    return token


# ─────────────────────────────────────────
# Lender API Functions (FIX 12)
# ─────────────────────────────────────────

def validate_lender_api_key(api_key):
    """Validate a lender API key and record usage against it."""
    if not api_key:
        return None
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM lender_api_keys WHERE api_key = ? AND is_active = 1",
        (api_key,)
    ).fetchone()
    if row:
        conn.execute("""
            UPDATE lender_api_keys
            SET total_queries = total_queries + 1, last_used = CURRENT_TIMESTAMP
            WHERE api_key = ?
        """, (api_key,))
        conn.commit()
    conn.close()
    return dict(row) if row else None


# Mock AePS (Aadhaar-enabled Payment System) biometric token format.
# This is NOT real biometric verification — a genuine integration
# requires a licensed AePS provider and hardware fingerprint capture,
# neither of which is available here. This at minimum rejects the
# previous "any non-empty string" check, which accepted literally
# anything (including "x") as proof of a completed biometric scan.
_AEPS_TOKEN_PATTERN = re.compile(r'^AEPS-[A-Za-z0-9]{12,}$')


def is_valid_aeps_token_format(token: str) -> bool:
    """
    MOCK format check only — verifies the token LOOKS like something a
    real AePS device/SDK would have issued (a fixed prefix + a
    sufficiently long opaque identifier). Does not verify the token was
    ever actually issued by a biometric device; only a real AePS
    provider integration can do that.
    """
    if not token:
        return False
    return bool(_AEPS_TOKEN_PATTERN.match(token))


def find_workers_by_aadhaar(aadhaar_last4):
    """Find workers by Aadhaar last 4 digits."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM workers WHERE aadhaar_last4 = ? AND is_active = 1",
        (aadhaar_last4,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────
# Main Payment Orchestrator
# ─────────────────────────────────────────

def save_payment_record(entry, contractor_id, conn=None):
    """
    Create a payment record in PENDING state.
    Accepts an optional shared `conn` to avoid opening a fresh
    connection per worker in a batch payroll run.
    """
    payment_id = str(uuid.uuid4())
    should_close = False
    if conn is None:
        conn = get_db()
        should_close = True

    payment_method = "upi"
    if entry.get("phone_type") == "no_phone":
        payment_method = "card_load"
    elif entry.get("delivery_method") == "qr_paper_receipt":
        payment_method = "card_load"

    conn.execute("""
        INSERT INTO payments
        (payment_id, worker_id, contractor_id, payroll_date,
         days_worked, rate_per_day, gross_pay, deductions, net_pay,
         status, payment_method, wage_compliant, minimum_wage_at_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        payment_id, entry["worker_id"], contractor_id,
        CONSTANTS.get("demo_date", date.today().isoformat()),
        entry["days_worked"], entry["rate_per_day"],
        entry["gross_pay"], entry.get("deductions", 0), entry["net_pay"],
        "PENDING", payment_method,
        1 if entry.get("wage_compliant", True) else 0,
        entry.get("minimum_wage", 746)
    ))
    conn.commit()
    if should_close:
        conn.close()
    return payment_id


def execute_all_payments(hisaab_output, contractor_id=None):
    """
    Process all payments and compute scores. Uses retry logic for each
    payment.

    contractor_id: the AUTHENTICATED acting contractor (resolved by the
    caller from the request's auth token — see main.py). If not
    supplied, falls back to the contractor_id embedded in HISAAB's own
    output. NOTE: a previous version of this function read
    CONSTANTS["demo_contractor"]["paytm_id"] ("PAYTM_CONT_001") instead
    of "contractor_id" ("CONT_001") — since paytm_id is not a valid
    primary key in the contractors table, every payment failed with a
    FOREIGN KEY constraint error.

    Balance handling: the full requested total is reserved ATOMICALLY
    up front via a single guarded UPDATE (`WHERE paytm_balance >= ?`).
    This closes two separate problems in the old implementation: (1) a
    TOCTOU race between a separate /api/check-balance call and this
    deduction, and (2) the more fundamental issue that payments used to
    be executed FIRST and the balance decremented unconditionally
    afterward — meaning the balance could be driven negative regardless
    of any race, since nothing ever guarded the UPDATE. Any amount that
    ends up HELD (payment gateway simulation failure) is refunded back
    to the balance once final payment outcomes are known.
    """
    conn = None
    try:
        init_db()

        if not contractor_id:
            contractor_id = hisaab_output.get("contractor", {}).get(
                "contractor_id", DEFAULT_CONTRACTOR_ID
            )

        entries = hisaab_output.get("entries", [])
        total_requested = sum(float(e.get("net_pay", 0)) for e in entries)

        conn = get_db()

        if total_requested > 0:
            cur = conn.execute("""
                UPDATE contractors
                SET paytm_balance = paytm_balance - ?
                WHERE contractor_id = ? AND paytm_balance >= ?
            """, (total_requested, contractor_id, total_requested))
            if cur.rowcount == 0:
                row = conn.execute(
                    "SELECT paytm_balance FROM contractors WHERE contractor_id = ?",
                    (contractor_id,)
                ).fetchone()
                available = row["paytm_balance"] if row else 0
                conn.close()
                return {
                    "payment_results": [],
                    "scores": {},
                    "total_paid": 0,
                    "payment_status": "insufficient_balance",
                    "error_message": (
                        f"Insufficient contractor balance: need ₹{total_requested:.2f}, "
                        f"have ₹{available:.2f}."
                    )
                }
            conn.commit()

        payment_results = []
        scores = {}

        for entry in entries:
            payment_id = save_payment_record(entry, contractor_id, conn=conn)
            payment = execute_payment_with_retry(entry, payment_id, conn=conn)
            payment_results.append(payment)

            score = calculate_kaam_score(entry["worker_id"], conn=conn)
            scores[entry["worker_id"]] = score

        total_paid = sum(p["amount"] for p in payment_results if p["status"] == "SUCCESS")
        held_amount = sum(p["amount"] for p in payment_results if p["status"] != "SUCCESS")
        all_success = all(p["status"] == "SUCCESS" for p in payment_results)

        if held_amount > 0:
            conn.execute(
                "UPDATE contractors SET paytm_balance = paytm_balance + ? WHERE contractor_id = ?",
                (held_amount, contractor_id)
            )
        if total_paid > 0:
            conn.execute(
                "UPDATE contractors SET total_paid_lifetime = total_paid_lifetime + ? WHERE contractor_id = ?",
                (total_paid, contractor_id)
            )
        conn.commit()
        conn.close()

        return {
            "payment_results": payment_results,
            "scores": scores,
            "total_paid": total_paid,
            "payment_status": "all_success" if all_success else "partial_failure"
        }

    except Exception as e:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass
        return {
            "payment_results": [],
            "scores": {},
            "total_paid": 0,
            "payment_status": "error",
            "error_message": str(e)
        }
