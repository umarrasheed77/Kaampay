"""
KaamPay VANI Agent - Test Suite
Tests all 8 mandatory test cases from the bug fix spec.
Run with: python test_vani.py
"""

import json
import sys
import os

# Force UTF-8 on Windows
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from agents.vani.parser import parse_llm_response, validate_and_normalize
from agents.vani.preprocessor import (
    preprocess_transcript, 
    count_workers_in_transcript, 
    validate_entry_count
)

# ── Test tracking ──
passed = 0
failed = 0
total = 0

def test(name, condition, detail=""):
    global passed, failed, total
    total += 1
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} -- {detail}")


def header(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


# ═══════════════════════════════════════════════
# TEST 1: Basic multi-worker (the original crash)
# ═══════════════════════════════════════════════
header("TEST 1 — Basic multi-worker extraction")

# Simulate LLM returning correct JSON for the crash scenario
test1_llm_output = json.dumps({
    "entries": [
        {"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0},
        {"worker_name": "Suresh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0},
        {"worker_name": "Mohan", "days_worked": 0.5, "rate_per_day": 700, "gross_pay": 350.0}
    ],
    "confidence": 0.9,
    "language_detected": "hi",
    "parsing_notes": "Rate 700 applied to all 3 workers."
})

result = parse_llm_response(test1_llm_output)
test("Parser returns dict", result is not None)
test("Has 3 entries", len(result["entries"]) == 3, f"got {len(result.get('entries', []))}")
test("Ramesh: 1.0 day, ₹700, gross ₹700",
     result["entries"][0] == {"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0})
test("Suresh: 1.0 day, ₹700, gross ₹700",
     result["entries"][1] == {"worker_name": "Suresh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0})
test("Mohan: 0.5 day, ₹700, gross ₹350",
     result["entries"][2] == {"worker_name": "Mohan", "days_worked": 0.5, "rate_per_day": 700, "gross_pay": 350.0})

# Also test the preprocessor on the original crash input
crash_input = "Ramesh aur Suresh ne aaj kaam kiya, 8 ghante, 700 rupay rate. Aur Mohan ne aadha din kiya."
worker_count = count_workers_in_transcript(crash_input)
test("Preprocessor detects >= 2 workers", worker_count >= 2, f"got {worker_count}")


# ═══════════════════════════════════════════════
# TEST 2: Different rates per worker
# ═══════════════════════════════════════════════
header("TEST 2 — Different rates per worker")

test2_llm_output = json.dumps({
    "entries": [
        {"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 800, "gross_pay": 800.0},
        {"worker_name": "Suresh", "days_worked": 1.0, "rate_per_day": 750, "gross_pay": 750.0}
    ],
    "confidence": 1.0,
    "language_detected": "hi",
    "parsing_notes": "Different rates."
})

result = parse_llm_response(test2_llm_output)
test("Has 2 entries", len(result["entries"]) == 2)
test("Rates are different",
     result["entries"][0]["rate_per_day"] != result["entries"][1]["rate_per_day"],
     f"both are {result['entries'][0]['rate_per_day']}")
test("Ramesh rate is 800", result["entries"][0]["rate_per_day"] == 800)
test("Suresh rate is 750", result["entries"][1]["rate_per_day"] == 750)


# ═══════════════════════════════════════════════
# TEST 3: Three workers, mixed rates
# ═══════════════════════════════════════════════
header("TEST 3 — Three workers, one rate, one different")

test3_llm_output = json.dumps({
    "entries": [
        {"worker_name": "Raju", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0},
        {"worker_name": "Sonu", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0},
        {"worker_name": "Bhim", "days_worked": 1.0, "rate_per_day": 950, "gross_pay": 950.0}
    ],
    "confidence": 0.95,
    "language_detected": "hi",
    "parsing_notes": "Bhim has different rate."
})

result = parse_llm_response(test3_llm_output)
test("Has 3 entries", len(result["entries"]) == 3)
test("Bhim's rate is 950 not 700",
     result["entries"][2]["rate_per_day"] == 950,
     f"got {result['entries'][2]['rate_per_day']}")
test("Raju's rate is 700", result["entries"][0]["rate_per_day"] == 700)
test("Sonu's rate is 700", result["entries"][1]["rate_per_day"] == 700)


# ═══════════════════════════════════════════════
# TEST 4: Hindi number words (preprocessor)
# ═══════════════════════════════════════════════
header("TEST 4 — Hindi number words preprocessing")

input4 = "Ramesh ko saat sau pachaas do, ek din."
cleaned = preprocess_transcript(input4)
test("'saat sau pachaas' → '750'", "750" in cleaned, f"cleaned = '{cleaned}'")

# Additional Hindi number tests
test("'saat sau' → '700'", "700" in preprocess_transcript("saat sau rupay"))
test("'aath sau' → '800'", "800" in preprocess_transcript("aath sau rupay"))
test("'ek hazaar' → '1000'", "1000" in preprocess_transcript("ek hazaar rupay"))
test("'paanch sau' → '500'", "500" in preprocess_transcript("paanch sau rupay"))
test("'chhe sau pachaas' → '650'", "650" in preprocess_transcript("chhe sau pachaas"))

# Test time word normalization
test("'aadha din' normalizes", "0.5" in preprocess_transcript("aadha din"))
test("'poora din' normalizes", "1.0" in preprocess_transcript("poora din"))

# Test rupay → rate normalization
cleaned_rupay = preprocess_transcript("700 rupay")
test("'700 rupay' → '700 rate'", "700 rate" in cleaned_rupay, f"got '{cleaned_rupay}'")


# ═══════════════════════════════════════════════
# TEST 5: Single worker (must not break)
# ═══════════════════════════════════════════════
header("TEST 5 — Single worker (must not break)")

test5_llm_output = json.dumps({
    "entries": [
        {"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0}
    ],
    "confidence": 1.0,
    "language_detected": "hi",
    "parsing_notes": "Single worker, clear."
})

result = parse_llm_response(test5_llm_output)
test("Has 1 entry", len(result["entries"]) == 1, f"got {len(result.get('entries', []))}")
test("Worker is Ramesh", result["entries"][0]["worker_name"] == "Ramesh")
test("Gross pay is 700", result["entries"][0]["gross_pay"] == 700.0)

# Also test: flat object (LLM returns single worker not wrapped)
flat_output = json.dumps({
    "worker_name": "Ramesh",
    "days_worked": 1.0,
    "rate_per_day": 700,
    "gross_pay": 700.0,
    "confidence": 0.9,
    "language_detected": "hi"
})
result_flat = parse_llm_response(flat_output)
test("Flat object → normalized to array", 
     result_flat is not None and len(result_flat["entries"]) == 1,
     "flat object normalization failed")


# ═══════════════════════════════════════════════
# TEST 6: Malformed LLM output (parser test)
# ═══════════════════════════════════════════════
header("TEST 6 — Malformed LLM output (parser strategies)")

# 6a: Markdown code fences
fenced = '```json\n{"entries": [{"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0}], "confidence": 0.9, "language_detected": "hi", "parsing_notes": "test"}\n```'
result_fenced = parse_llm_response(fenced)
test("Strategy 2: strips markdown fences",
     result_fenced is not None and len(result_fenced["entries"]) == 1,
     "fence stripping failed")

# 6b: Preamble text + JSON
preamble = 'Here is the extracted data:\n{"entries": [{"worker_name": "Raju", "days_worked": 1.0, "rate_per_day": 650, "gross_pay": 650.0}], "confidence": 0.8, "language_detected": "hi", "parsing_notes": ""}'
result_preamble = parse_llm_response(preamble)
test("Strategy 3: extracts JSON from preamble text",
     result_preamble is not None and result_preamble["entries"][0]["worker_name"] == "Raju",
     "preamble extraction failed")

# 6c: Array-only response (no wrapper object)
array_only = '[{"worker_name": "Sonu", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0}]'
result_array = parse_llm_response(array_only)
test("Strategy 4: wraps bare array",
     result_array is not None and len(result_array["entries"]) == 1,
     "array wrapping failed")

# 6d: Complete garbage
garbage = "I cannot understand this input. Please try again."
result_garbage = parse_llm_response(garbage)
test("Garbage input → returns None", result_garbage is None)

# 6e: Empty string
result_empty = parse_llm_response("")
test("Empty string → returns None", result_empty is None)

# 6f: None input
result_none = parse_llm_response(None)
test("None input → returns None", result_none is None)

# 6g: entries as single dict (not list)
single_dict_entries = json.dumps({
    "entries": {"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 700, "gross_pay": 700.0},
    "confidence": 0.8,
    "language_detected": "hi",
    "parsing_notes": ""
})
result_dict_entries = parse_llm_response(single_dict_entries)
test("Entries as dict → normalized to list",
     result_dict_entries is not None and len(result_dict_entries["entries"]) == 1,
     "dict-to-list normalization failed")


# ═══════════════════════════════════════════════
# TEST 7: validate_and_normalize edge cases
# ═══════════════════════════════════════════════
header("TEST 7 — validate_and_normalize edge cases")

# Missing gross_pay → recalculated
result_no_gross = validate_and_normalize({
    "entries": [
        {"worker_name": "Test", "days_worked": 1.0, "rate_per_day": 800}
    ],
    "confidence": 0.9,
    "language_detected": "hi"
})
test("Missing gross_pay → recalculated",
     result_no_gross["entries"][0]["gross_pay"] == 800.0,
     f"got {result_no_gross['entries'][0].get('gross_pay')}")

# Missing days_worked → defaults to 1.0
result_no_days = validate_and_normalize({
    "entries": [
        {"worker_name": "Test", "rate_per_day": 700}
    ],
    "confidence": 0.8,
    "language_detected": "hi"
})
test("Missing days_worked → defaults to 1.0",
     result_no_days["entries"][0]["days_worked"] == 1.0)

# Missing rate_per_day → uses default 700
result_no_rate = validate_and_normalize({
    "entries": [
        {"worker_name": "Test", "days_worked": 1.0}
    ],
    "confidence": 0.7,
    "language_detected": "hi"
})
test("Missing rate → defaults to 700",
     result_no_rate["entries"][0]["rate_per_day"] == 700)

# Rate cascading: second worker inherits first worker's rate
result_cascade = validate_and_normalize({
    "entries": [
        {"worker_name": "A", "days_worked": 1.0, "rate_per_day": 900},
        {"worker_name": "B", "days_worked": 1.0}
    ],
    "confidence": 0.8,
    "language_detected": "hi"
})
test("Rate cascade: B inherits A's rate (900)",
     result_cascade["entries"][1]["rate_per_day"] == 900,
     f"got {result_cascade['entries'][1]['rate_per_day']}")

# Empty entries list → returns None
result_empty_list = validate_and_normalize({
    "entries": [],
    "confidence": 0.5,
    "language_detected": "hi"
})
test("Empty entries → returns None", result_empty_list is None)

# Worker with empty name → skipped
result_no_name = validate_and_normalize({
    "entries": [
        {"worker_name": "", "days_worked": 1.0, "rate_per_day": 700},
        {"worker_name": "Ramesh", "days_worked": 1.0, "rate_per_day": 700}
    ],
    "confidence": 0.8,
    "language_detected": "hi"
})
test("Empty name worker skipped, valid kept",
     result_no_name is not None and len(result_no_name["entries"]) == 1)


# ═══════════════════════════════════════════════
# TEST 8: validate_entry_count checks
# ═══════════════════════════════════════════════
header("TEST 8 — Entry count validation")

# Test with payroll_entries key (API response shape)
api_result = {
    "status": "success",
    "payroll_entries": [
        {"worker_name": "A"}, {"worker_name": "B"}, {"worker_name": "C"}
    ]
}
test("validate_entry_count with payroll_entries key",
     validate_entry_count(api_result, "A aur B aur C ne kaam kiya"),
     "should recognize payroll_entries")

# Test with entries key (raw parser shape)
raw_result = {
    "entries": [
        {"worker_name": "A"}, {"worker_name": "B"}
    ]
}
test("validate_entry_count with entries key",
     validate_entry_count(raw_result, "A aur B ne kaam kiya"),
     "should recognize entries")

# Count mismatch
mismatch_result = {
    "payroll_entries": [{"worker_name": "A"}]  # Only 1
}
# "A aur B aur C" → expects 3, got 1 → difference 2 → should fail
test("Entry count mismatch detected",
     not validate_entry_count(mismatch_result, "A aur B aur C ne kaam kiya"),
     "should detect mismatch of 2")


# ═══════════════════════════════════════════════
# TEST 9: Preprocessor — connector detection
# ═══════════════════════════════════════════════
header("TEST 9 — Worker connector detection")

test("'A aur B' → 2 workers",
     count_workers_in_transcript("A aur B ne kaam kiya") >= 2)
test("'A aur B aur C' → 3 workers",
     count_workers_in_transcript("A aur B aur C ne kaam kiya") >= 3)
test("'A, B, C' (comma-separated) → ≥2 workers",
     count_workers_in_transcript("A, B, C ne kaam kiya") >= 2)
test("Single worker → 1",
     count_workers_in_transcript("Ramesh ne kaam kiya") == 1)


# ═══════════════════════════════════════════════
# TEST 10: safeEntries (JavaScript logic test via Python)
# ═══════════════════════════════════════════════
header("TEST 10 — safeEntries logic equivalence test")

def safe_entries_py(data):
    """Python equivalent of safeEntries.js for testing"""
    def is_valid_entry(entry):
        return (
            entry and isinstance(entry, dict) and
            isinstance(entry.get("worker_name"), str) and
            len(entry.get("worker_name", "")) > 0 and
            (isinstance(entry.get("net_pay"), (int, float)) or
             isinstance(entry.get("gross_pay"), (int, float)) or
             isinstance(entry.get("amount"), (int, float)))
        )
    
    if not data:
        return []
    if isinstance(data, list):
        return [e for e in data if is_valid_entry(e)]
    if isinstance(data, dict):
        if isinstance(data.get("payroll_entries"), list):
            return [e for e in data["payroll_entries"] if is_valid_entry(e)]
        if isinstance(data.get("entries"), list):
            return [e for e in data["entries"] if is_valid_entry(e)]
        if is_valid_entry(data):
            return [data]
    return []

# Test: None/null
test("safeEntries(None) → []", safe_entries_py(None) == [])

# Test: empty dict
test("safeEntries({}) → []", safe_entries_py({}) == [])

# Test: empty list
test("safeEntries([]) → []", safe_entries_py([]) == [])

# Test: { payroll_entries: [] }
test("safeEntries({payroll_entries:[]}) → []",
     safe_entries_py({"payroll_entries": []}) == [])

# Test: valid payroll_entries
valid_data = {
    "payroll_entries": [
        {"worker_name": "Ramesh", "gross_pay": 700}
    ]
}
entries = safe_entries_py(valid_data)
test("safeEntries with payroll_entries → 1 entry",
     len(entries) == 1 and entries[0]["worker_name"] == "Ramesh")

# Test: single object not in array
single = {"worker_name": "Ramesh", "gross_pay": 700}
test("safeEntries(single object) → [single]",
     len(safe_entries_py(single)) == 1)

# Test: entries key
entries_data = {
    "entries": [
        {"worker_name": "A", "gross_pay": 500},
        {"worker_name": "B", "gross_pay": 600}
    ]
}
test("safeEntries({entries: [...]}) → 2 entries",
     len(safe_entries_py(entries_data)) == 2)


# ═══════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════
print(f"\n{'='*60}")
print(f"  RESULTS: {passed}/{total} passed, {failed} failed")
print(f"{'='*60}")

if failed > 0:
    print("\n  [WARNING] SOME TESTS FAILED - do not deploy!")
    sys.exit(1)
else:
    print("\n  [SUCCESS] ALL TESTS PASSED - safe to deploy!")
    sys.exit(0)
