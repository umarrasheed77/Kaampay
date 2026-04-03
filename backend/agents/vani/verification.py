"""
VANI — Worker Verification Module
Validates extracted worker names against the known worker database
before allowing payroll processing.

Strict rule: If a name cannot be verified, it MUST be flagged.
No data entry or logging proceeds for unverified workers.
"""

import os
import json
from rapidfuzz import process, fuzz

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)


# ── Phonetic normalization for Hindi names ──
PHONETIC_ALIASES = {
    # Common romanization variations
    "ramesh": ["ramesh", "rames", "ramash", "rameshh"],
    "suresh": ["suresh", "sures", "surash", "sureshh"],
    "mohan": ["mohan", "mohun", "mohaan", "mohn"],
    "raju": ["raju", "raaju", "rajoo", "rajju"],
    "sonu": ["sonu", "sonoo", "sonnu"],
    "bhim": ["bhim", "bheem", "bheem", "bheema"],
    "kumar": ["kumar", "kumaar", "kumarr"],
    "lal": ["lal", "laal", "lall"],
    "yadav": ["yadav", "yaadav", "yadaw"],
}


def normalize_name(name: str) -> str:
    """Strip honorifics and normalize spacing."""
    if not name:
        return ""
    cleaned = name.strip().lower()
    # Remove common Hindi honorifics
    honorifics = ["bhai", "ji", "sahab", "bhaiya", "didi", "ben", "saheb"]
    words = cleaned.split()
    words = [w for w in words if w not in honorifics]
    return " ".join(words).strip()


def phonetic_match(input_name: str, db_name: str) -> float:
    """
    Returns a similarity score (0-100) using both
    fuzzy string matching and phonetic alias lookup.
    """
    n1 = normalize_name(input_name)
    n2 = normalize_name(db_name)

    if not n1 or not n2:
        return 0.0

    # Exact match after normalization
    if n1 == n2:
        return 100.0

    # Check phonetic aliases — if both names resolve to same base
    n1_parts = set(n1.split())
    n2_parts = set(n2.split())

    for base, aliases in PHONETIC_ALIASES.items():
        for part in list(n1_parts):
            if part in aliases or part == base:
                n1_parts.discard(part)
                n1_parts.add(base)
        for part in list(n2_parts):
            if part in aliases or part == base:
                n2_parts.discard(part)
                n2_parts.add(base)

    # After alias normalization, check overlap
    if n1_parts == n2_parts:
        return 95.0

    # Partial name match (first name only)
    n1_first = n1.split()[0] if n1.split() else ""
    n2_first = n2.split()[0] if n2.split() else ""
    if n1_first and n2_first and n1_first == n2_first:
        return 90.0

    # Fuzzy match as fallback
    score = fuzz.ratio(n1, n2)
    return float(score)


def get_all_known_workers():
    """
    Merge workers from constants.json AND the SQLite database.
    This ensures both demo workers and manually registered workers
    are available for verification.
    """
    known = list(CONSTANTS.get("demo_workers", []))
    known_ids = {w.get("worker_id") or w.get("id") for w in known}

    # Also pull from SQLite DB
    try:
        import sqlite3
        db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'db', 'kaampay.db')
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path, timeout=10.0)
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT worker_id, name, phone_number, phone_type, aadhaar_last4 FROM workers WHERE is_active = 1"
            ).fetchall()
            conn.close()
            for r in rows:
                if r["worker_id"] not in known_ids:
                    known.append({
                        "worker_id": r["worker_id"],
                        "id": r["worker_id"],
                        "name": r["name"],
                        "phone_type": r["phone_type"] or "feature_phone",
                        "aadhaar_last4": r["aadhaar_last4"] or "XXXX",
                    })
                    known_ids.add(r["worker_id"])
    except Exception as e:
        print(f"[VANI Verification] DB lookup failed, using constants only: {e}")

    return known


def verify_workers(extracted_entries: list) -> dict:
    """
    Database Verification: Validates each extracted worker name
    against the known worker database (constants + SQLite).

    Returns:
        {
            "all_verified": bool,
            "verified_entries": [...],
            "unverified_names": [...],
            "verification_details": [...]
        }
    """
    known_workers = get_all_known_workers()
    known_names = [w["name"] for w in known_workers]

    verified_entries = []
    unverified_names = []
    verification_details = []

    for entry in extracted_entries:
        worker_name = entry.get("worker_name", "")
        if not worker_name.strip():
            continue

        # Try matching against all known workers
        best_match = None
        best_score = 0.0
        best_worker = None

        for kw in known_workers:
            score = phonetic_match(worker_name, kw["name"])
            if score > best_score:
                best_score = score
                best_match = kw["name"]
                best_worker = kw

        # Verification threshold: >= 75 = verified
        if best_score >= 75 and best_worker:
            verified_entry = {
                **entry,
                "worker_id": best_worker.get("worker_id", best_worker.get("id")),
                "worker_name": best_worker["name"],  # Use canonical DB name
                "verified": True,
                "match_score": best_score,
                "match_method": (
                    "exact" if best_score == 100
                    else "phonetic" if best_score >= 90
                    else "fuzzy"
                ),
                "aadhaar_last4": best_worker.get("aadhaar_last4", "XXXX"),
                "phone_type": best_worker.get("phone_type", "feature_phone"),
            }
            verified_entries.append(verified_entry)
            verification_details.append({
                "input_name": worker_name,
                "matched_to": best_worker["name"],
                "score": best_score,
                "status": "verified"
            })
        else:
            unverified_names.append(worker_name)
            verification_details.append({
                "input_name": worker_name,
                "matched_to": best_match,
                "score": best_score,
                "status": "not_found"
            })

    all_verified = len(unverified_names) == 0 and len(verified_entries) > 0

    return {
        "all_verified": all_verified,
        "verified_entries": verified_entries,
        "unverified_names": unverified_names,
        "verification_details": verification_details,
        "verified_count": len(verified_entries),
        "unverified_count": len(unverified_names)
    }
