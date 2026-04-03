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
    Very basic regex fallback for when LLM is down.
    Looks for names and numbers in the transcript.
    """
    import re
    
    # Try to find common patterns like "Ramesh 700" or "Suresh 800"
    # This is a naive implementation for demo reliability
    entries = []
    
    # Split by common connectors
    parts = re.split(r'aur|and|,|\.', transcript.lower())
    
    for part in parts:
        # Extract name (first word-ish) and amount (the number)
        # Assuming format like "Ramesh ko 700" or "Suresh 800 rupay"
        numbers = re.findall(r'\d+', part)
        if not numbers: continue
        
        amount = int(numbers[0])
        # Find potential name: words before the number, excluding common Hindi/Eng stop words
        words = re.findall(r'[a-z]+', part)
        stop_words = {'ko', 'ne', 'aaj', 'kaam', 'kiya', 'rupay', 'rate', 'do', 'mein', 'diya', 'the', 'is', 'to', 'for'}
        name_words = [w for w in words if w not in stop_words]
        
        if name_words:
            worker_name = name_words[0].capitalize()
            entries.append({
                "worker_name": worker_name,
                "days_worked": 1.0,
                "rate_per_day": amount,
                "gross_pay": float(amount)
            })
            
    if entries:
        return {
            "entries": entries,
            "confidence": 0.5,
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
