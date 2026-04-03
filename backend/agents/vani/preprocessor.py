import re

HINDI_CONNECTORS = [
    "aur bhi", "aur unke saath", "saath mein",
    "ke saath", "aur woh bhi", "aur", "bhi"
]

HINDI_TIME_WORDS = {
    "aadha din":   0.5,
    "half din":    0.5,
    "half day":    0.5,
    "poora din":   1.0,
    "full din":    1.0,
    "full day":    1.0,
    "ek din":      1.0,
    "aath ghante": 1.0,
    "8 ghante":    1.0,
    "char ghante": 0.5,
    "4 ghante":    0.5,
    "teen ghante": 0.375,
    "3 ghante":    0.375,
}

HINDI_NUMBER_WORDS = {
    "ek sau":           100,
    "do sau":           200,
    "teen sau":         300,
    "chaar sau":        400,
    "paanch sau":       500,
    "chhe sau":         600,
    "saat sau":         700,
    "aath sau":         800,
    "nau sau":          900,
    "ek hazaar":       1000,
    "paanch sau pachaas": 550,
    "chhe sau pachaas":   650,
    "saat sau pachaas":   750,
    "aath sau pachaas":   850,
}

def preprocess_transcript(transcript: str) -> str:
    """
    Normalizes Hindi number words and time expressions
    before LLM extraction.
    Makes the LLM's job significantly easier.
    """
    text = transcript.lower().strip()

    # Replace Hindi number words with digits
    for word, num in sorted(
        HINDI_NUMBER_WORDS.items(),
        key=lambda x: len(x[0]),
        reverse=True  # longest match first
    ):
        text = text.replace(word, str(num))

    # Normalize time words to standard format
    for phrase, val in sorted(
        HINDI_TIME_WORDS.items(),
        key=lambda x: len(x[0]),
        reverse=True
    ):
        text = text.replace(
            phrase, f"{val} din"
        )

    # Normalize "X rupay/rupaye/rs/rupe" → "X rate"
    text = re.sub(
        r'(\d+)\s*(?:rupay|rupaye|rs|rupe|rupee|₹)',
        r'\1 rate',
        text
    )

    # Normalize "X ghante" → "X hours"
    text = re.sub(
        r'(\d+(?:\.\d+)?)\s*ghante?',
        r'\1 hours',
        text
    )

    return text.strip()


def count_workers_in_transcript(
    transcript: str
) -> int:
    """
    Estimates the number of workers mentioned.
    Used to validate LLM output — if LLM returns 
    fewer entries than expected, trigger retry.
    """
    text = transcript.lower()

    # Count connectors by actual occurrences (not just presence)
    # Process longest connectors first to avoid double-counting
    # e.g., "aur bhi" should be counted before "aur"
    remaining = f" {text} "
    connector_count = 0
    for c in sorted(HINDI_CONNECTORS[:6], key=len, reverse=True):
        pattern = f" {c} "
        while pattern in remaining:
            connector_count += 1
            # Replace first occurrence to avoid double-counting
            remaining = remaining.replace(pattern, " ", 1)

    # Also count comma-separated names
    # "Ramesh, Suresh, Mohan" = 3
    comma_count = text.count(",")

    # Return conservative estimate
    return max(1, connector_count + 1, 
               comma_count // 2 + 1)


def validate_entry_count(
    result: dict,
    transcript: str
) -> bool:
    """
    Checks if LLM returned roughly the right number
    of worker entries. Triggers retry if not.
    """
    expected = count_workers_in_transcript(transcript)
    # Check both keys: 'entries' (raw parser output) and 'payroll_entries' (API response)
    actual = len(result.get("payroll_entries", result.get("entries", [])))

    # Allow ±1 tolerance
    return abs(actual - expected) <= 1
