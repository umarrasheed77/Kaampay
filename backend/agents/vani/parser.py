import json
import re

def parse_llm_response(raw_text: str) -> dict | None:
    """
    Attempts to parse LLM output into valid payroll JSON.
    Tries 4 strategies in order before giving up.
    Never throws. Always returns dict or None.
    """

    if not raw_text or not raw_text.strip():
        return None

    # STRATEGY 1: Direct parse (ideal case)
    try:
        data = json.loads(raw_text.strip())
        result = validate_and_normalize(data)
        if result is not None:
            return result
    except json.JSONDecodeError:
        pass

    # STRATEGY 2: Strip markdown code fences
    # Handles: ```json { ... } ``` or ``` { ... } ```
    stripped = re.sub(
        r'^```(?:json)?\s*|\s*```$',
        '',
        raw_text.strip(),
        flags=re.MULTILINE
    ).strip()
    try:
        data = json.loads(stripped)
        result = validate_and_normalize(data)
        if result is not None:
            return result
    except json.JSONDecodeError:
        pass

    # STRATEGY 3: Extract first { ... } block
    # Handles: preamble text + JSON + trailing text
    match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            result = validate_and_normalize(data)
            if result is not None:
                return result
        except json.JSONDecodeError:
            pass

    # STRATEGY 4: Extract entries array directly
    # Handles: LLM returns just the array, not wrapped
    match = re.search(r'\[.*\]', raw_text, re.DOTALL)
    if match:
        try:
            entries = json.loads(match.group())
            if isinstance(entries, list):
                return validate_and_normalize(
                    {"entries": entries,
                     "confidence": 0.6,
                     "language_detected": "hi",
                     "parsing_notes": 
                         "Recovered from array-only response"}
                )
        except json.JSONDecodeError:
            pass

    # All strategies failed
    return None


def validate_and_normalize(data: dict) -> dict | None:
    """
    Ensures the parsed JSON has the correct structure.
    Fixes common shape mismatches.
    Never throws. Returns None if unrecoverable.
    """

    if not isinstance(data, dict):
        return None

    # Handle flat object (single worker, not wrapped in array)
    # LLM returns: {"worker_name": "Ramesh", ...}
    # instead of:  {"entries": [{"worker_name": "Ramesh"}]}
    if "worker_name" in data and "entries" not in data:
        data = {
            "entries": [data],
            "confidence": data.get("confidence", 0.7),
            "language_detected": 
                data.get("language_detected", "hi"),
            "parsing_notes": 
                "Normalized from flat single-worker object"
        }

    # Ensure entries key exists
    if "entries" not in data:
        return None

    entries = data["entries"]

    # Handle entries being a single dict instead of list
    if isinstance(entries, dict):
        entries = [entries]
        data["entries"] = entries

    # Ensure entries is a non-empty list
    if not isinstance(entries, list) or len(entries) == 0:
        return None

    # Validate and fix each entry
    fixed_entries = []
    last_valid_rate = 700  # sensible default

    for i, entry in enumerate(entries):
        if not isinstance(entry, dict):
            continue

        # worker_name: required
        name = entry.get("worker_name", "").strip()
        if not name:
            continue

        # days_worked: default 1.0 if missing
        try:
            days = float(entry.get("days_worked", 1.0))
            days = max(0.25, min(days, 3.0))
        except (ValueError, TypeError):
            days = 1.0

        # rate_per_day: use last valid if missing
        try:
            rate = int(entry.get("rate_per_day", 
                                  last_valid_rate))
            if rate > 100:
                last_valid_rate = rate
        except (ValueError, TypeError):
            rate = last_valid_rate

        # gross_pay: always recalculate
        gross = round(days * rate, 2)

        fixed_entries.append({
            "worker_name": name,
            "days_worked": days,
            "rate_per_day": rate,
            "gross_pay": gross
        })

    if not fixed_entries:
        return None

    return {
        "entries": fixed_entries,
        "confidence": float(
            data.get("confidence", 0.75)
        ),
        "language_detected": str(
            data.get("language_detected", "hi")
        ),
        "parsing_notes": str(
            data.get("parsing_notes", "")
        )
    }
