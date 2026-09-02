import os
import time
from dotenv import load_dotenv
from typing import Annotated, Dict, Any

from .extraction import EXTRACTION_PROMPT
from .parser import parse_llm_response

load_dotenv()

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key and api_key != "your_gemini_api_key_here":
        genai.configure(api_key=api_key)
    else:
        GEMINI_AVAILABLE = False
except ImportError:
    GEMINI_AVAILABLE = False

MODELS_TO_TRY = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
]

def regex_fallback_extract(transcript: str) -> dict:
    """
    Regex/heuristic fallback for when the LLM is unavailable (quota
    exceeded, network error, etc).

    PREVIOUS BUG: this function split the transcript on a bare period
    character (via `re.split(r'aur|and|,|[.]', ...)`). preprocess_transcript
    normalizes hour/day phrases into decimal-day tokens like "1.0 din"
    and "0.5 din" — splitting on "." breaks "1.0" into "1" and "0",
    leaving "din" (Hindi for "day") orphaned in its own segment, where
    it then got misidentified as a worker's name (it isn't in the stop
    words list). For the standard demo transcript this produced ZERO
    correct entries: two fake "Din" workers and a dropped Ramesh/Suresh,
    because shared trailing clauses ("Ramesh aur Suresh ne ... 700
    rupay") were also never associated back to the names they applied to
    — each comma-delimited segment was treated in total isolation.

    FIX: search for KNOWN worker names directly in the transcript
    (rather than guessing from arbitrary leftover words), then for each
    name found, look FORWARD in the full text for the nearest days/rate
    mention, carrying the most recent value forward when a specific
    worker's clause doesn't repeat it — exactly matching the "last
    mentioned rate applies to subsequent workers" rule the LLM prompt
    itself documents. This also naturally handles a shared trailing
    clause covering multiple preceding names, since each name's forward
    search independently finds the same shared days/rate tokens.
    """
    import re
    from .verification import get_all_known_workers

    text = transcript.lower()
    known_workers = get_all_known_workers()
    known_names = [w["name"] for w in known_workers if w.get("name")]

    # 1. Locate every known worker's first-name occurrence in the text.
    name_positions = []
    for name in known_names:
        first_token = name.split()[0].lower()
        for m in re.finditer(r'\b' + re.escape(first_token) + r'\b', text):
            name_positions.append((m.start(), name))

    # Fallback: no known name matched at all (e.g. a brand-new,
    # unregistered worker) — fall back to a generic word heuristic so an
    # "unverified" entry can still surface for the contractor to correct,
    # rather than silently returning nothing.
    if not name_positions:
        stop_words = {
            'ko', 'ne', 'aaj', 'kaam', 'kiya', 'rate', 'do', 'mein', 'diya',
            'the', 'is', 'to', 'for', 'din', 'hours', 'aur', 'and'
        }
        for m in re.finditer(r'[a-z]+', text):
            word = m.group()
            if word not in stop_words and len(word) > 2:
                name_positions.append((m.start(), word.capitalize()))

    # De-duplicate same name matched at multiple positions, keep first occurrence
    seen = set()
    deduped = []
    for pos, name in sorted(name_positions):
        if name.lower() not in seen:
            seen.add(name.lower())
            deduped.append((pos, name))
    name_positions = deduped

    if not name_positions:
        return None

    # 2. Locate every days-worked mention (decimal-day tokens the
    # preprocessor already normalized things into, e.g. "1.0 din").
    days_tokens = [
        (m.start(), float(m.group(1)))
        for m in re.finditer(r'(\d+(?:\.\d+)?)\s*din\b', text)
    ]
    days_tokens.sort()

    # 3. Locate every rate mention (preprocessor normalizes "700 rupay" -> "700 rate").
    rate_tokens = [
        (m.start(), int(float(m.group(1))))
        for m in re.finditer(r'(\d+(?:\.\d+)?)\s*rate\b', text)
    ]
    rate_tokens.sort()

    # 4. For each name, take the first days/rate token AT OR AFTER its
    #    position; fall back to carrying the most recent value forward.
    entries = []
    last_rate = 700
    last_days = 1.0
    for pos, name in name_positions:
        days_val = next((v for p, v in days_tokens if p >= pos), None)
        rate_val = next((v for p, v in rate_tokens if p >= pos), None)

        if days_val is None:
            days_val = last_days
        else:
            last_days = days_val

        if rate_val is None:
            rate_val = last_rate
        else:
            last_rate = rate_val

        entries.append({
            "worker_name": name,
            "days_worked": round(days_val, 2),
            "rate_per_day": rate_val,
            "gross_pay": round(days_val * rate_val, 2)
        })

    if entries:
        return {
            "entries": entries,
            "confidence": 0.6,
            "language_detected": "mixed",
            "parsing_notes": "Extracted via Regex Fallback (API Quota Exceeded)"
        }
    return None


RETRY_PROMPT = """
Extract payroll data. Return ONLY raw JSON. 
No markdown. No explanation.

Rules: One entry per worker. 
"aur" means a new worker. 
If rate not stated per worker, use last mentioned rate.
days_worked: 1.0 = full day, 0.5 = half day.

Text: {transcript}

JSON format:
{{
  "entries": [
    {{
      "worker_name": "string",
      "days_worked": 0.5 or 1.0,
      "rate_per_day": integer,
      "gross_pay": float
    }}
  ],
  "confidence": 0.8,
  "language_detected": "hi",
  "parsing_notes": "brief note"
}}
"""

async def call_llm_async(prompt: str) -> str:
    """
    Wrapper around Gemini synchronous call to maintain async API structure
    while looping through fallback models for Rate Limits.
    """
    if not GEMINI_AVAILABLE:
        raise Exception("Gemini API key not configured. Set GEMINI_API_KEY in backend/.env")
        
    last_error = None
    max_model_retries = 2
    
    for model_name in MODELS_TO_TRY:
        for attempt in range(max_model_retries):
            try:
                print(f"[VANI Extractor] Trying {model_name} (attempt {attempt + 1})")
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.1,
                        max_output_tokens=1024,
                    )
                )
                return response.text
            except Exception as e:
                last_error = e
                error_str = str(e)
                if "429" in error_str or "quota" in error_str.lower():
                    print(f"[VANI Extractor] Rate limited on {model_name}, trying next model...")
                    break
                elif attempt < max_model_retries - 1:
                    time.sleep(1)
                    continue
                else:
                    break
    
    raise Exception(f"All Gemini models failed. Last error: {str(last_error)[:200]}")


async def extract_with_retry(
    transcript: str,
    max_retries: int = 2
) -> dict:
    """
    Calls LLM with primary prompt.
    On failure or low confidence, retries with simpler RETRY_PROMPT.
    On second failure, returns structured error.
    """
    attempts = []

    # ATTEMPT 1: Full prompt
    try:
        raw = await call_llm_async(EXTRACTION_PROMPT.format(transcript=transcript))
        result = parse_llm_response(raw)
        
        if result and result["confidence"] >= 0.5:
            result["attempt"] = 1
            return build_success_response(transcript, result)
            
        attempts.append(f"Attempt 1: confidence={result['confidence'] if result else 'parse_fail'}")
    except Exception as e:
        attempts.append(f"Attempt 1 exception: {str(e)}")

    # ATTEMPT 2: Simpler retry prompt
    try:
        raw = await call_llm_async(RETRY_PROMPT.format(transcript=transcript))
        result = parse_llm_response(raw)
        
        if result and result["confidence"] >= 0.4:
            result["attempt"] = 2
            result["parsing_notes"] += " [recovered via retry]"
            return build_success_response(transcript, result)
            
        attempts.append(f"Attempt 2: confidence={result['confidence'] if result else 'parse_fail'}")
    except Exception as e:
        attempts.append(f"Attempt 2 exception: {str(e)}")

    # FALLBACK: Regex match if all AI failed
    fallback_result = regex_fallback_extract(transcript)
    if fallback_result:
        fallback_result["attempt"] = "fallback"
        return build_success_response(transcript, fallback_result)

    # ALL ATTEMPTS FAILED — return safe fallback
    return {
        "status": "needs_confirmation",
        "transcript": transcript,
        "payroll_entries": [],
        "confidence": 0.0,
        "readback_hindi": "Maafi chahta hoon, samajh nahi aaya. Kripya dobara bolein ya type karein.",
        "readback_english": "Sorry, could not understand. Please try again or type instead.",
        "error_message": f"Extraction failed after {max_retries} attempts: {'; '.join(attempts)}",
        "show_text_fallback": True
    }


def build_success_response(transcript: str, result: dict) -> dict:
    status = "needs_confirmation" if result["confidence"] < 0.75 else "success"

    # Build Hindi readback string
    readback_parts = []
    for e in result["entries"]:
        readback_parts.append(
            f"{e['worker_name']} — {e['days_worked']} din — ₹{e['rate_per_day']} rate — ₹{e['gross_pay']} total"
        )
    readback = "Maine suna: " + ". ".join(readback_parts) + ". Sahi hai?"

    return {
        "status": status,
        "transcript": transcript,
        "payroll_entries": result["entries"],
        "confidence": result["confidence"],
        "readback_hindi": readback,
        "error_message": None,
        "parsing_notes": result.get("parsing_notes", ""),
        "attempt": result.get("attempt", 1)
    }
