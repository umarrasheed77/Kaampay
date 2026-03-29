"""
KAGAZ — Document Generation Agent
Generates payslips in PDF, WhatsApp, and SMS formats.
The payslip is the most emotionally powerful part of the demo.
"""

import os
import io
import json
import qrcode
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

# Output directory
PAYSLIPS_DIR = os.path.join(os.path.dirname(__file__), '..', 'payslips')
os.makedirs(PAYSLIPS_DIR, exist_ok=True)

# Load constants
CONSTANTS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'constants.json')
with open(CONSTANTS_PATH, 'r', encoding='utf-8') as f:
    CONSTANTS = json.load(f)

# Colors
GREEN = HexColor("#1a472a")
AMBER = HexColor("#f59e0b")
PAYTM_BLUE = HexColor("#00BAF2")
LIGHT_GRAY = HexColor("#f3f4f6")
DARK_TEXT = HexColor("#111827")
MID_GRAY = HexColor("#6b7280")


def generate_qr_code(data: dict) -> io.BytesIO:
    """Generate a QR code from payment data."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=2,
    )
    qr.add_data(json.dumps(data, ensure_ascii=False))
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1a472a", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return buffer


def generate_payslip_pdf(entry: dict, payment: dict, score: dict, contractor: dict) -> str:
    """
    Generate a dignified A6 payslip PDF.
    Returns the file path of the generated PDF.
    """
    filename = f"{entry['worker_id']}_{CONSTANTS['demo_date'].replace('-', '')}.pdf"
    filepath = os.path.join(PAYSLIPS_DIR, filename)

    w, h = A6  # 297 x 420 points (105mm x 148mm)
    c = canvas.Canvas(filepath, pagesize=A6)

    # ── Header Bar ──
    c.setFillColor(GREEN)
    c.rect(0, h - 55, w, 55, fill=1, stroke=0)

    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 16)
    c.drawString(12, h - 28, "MazdoorPay")
    c.setFont("Helvetica", 7)
    c.drawString(12, h - 40, "Powered by Paytm UPI")
    c.setFont("Helvetica", 7)
    c.drawString(12, h - 50, "Digital Wage Payslip | Dijital Mazdoori Parchi")

    # ── Worker Name Section ──
    y = h - 78
    c.setFillColor(DARK_TEXT)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(12, y, entry["worker_name"])

    y -= 14
    c.setFont("Helvetica", 8)
    c.setFillColor(MID_GRAY)
    c.drawString(12, y, f"Aadhaar: XXXX-XXXX-{entry.get('aadhaar_last4', '0000')}")
    c.drawString(w - 95, y, f"Date: {CONSTANTS['demo_date']}")

    # ── Separator ──
    y -= 10
    c.setStrokeColor(LIGHT_GRAY)
    c.setLineWidth(1)
    c.line(12, y, w - 12, y)

    # ── Payroll Details Table ──
    y -= 18
    c.setFillColor(DARK_TEXT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(12, y, "Description")
    c.drawString(w - 80, y, "Amount")

    y -= 3
    c.setStrokeColor(HexColor("#e5e7eb"))
    c.line(12, y, w - 12, y)

    # Row: Days Worked
    y -= 15
    c.setFont("Helvetica", 9)
    c.setFillColor(DARK_TEXT)
    c.drawString(12, y, f"Days Worked (Kaam ke din)")
    c.drawString(w - 80, y, f"{entry['days_worked']}")

    # Row: Rate
    y -= 15
    c.drawString(12, y, f"Daily Rate (Din ka rate)")
    c.drawString(w - 80, y, f"Rs.{int(entry['rate_per_day'])}")

    # Row: Gross
    y -= 15
    c.drawString(12, y, f"Gross Pay (Kul mazdoori)")
    c.drawString(w - 80, y, f"Rs.{int(entry['gross_pay'])}")

    # Row: Deductions
    y -= 15
    c.drawString(12, y, f"Deductions (Katauti)")
    c.drawString(w - 80, y, f"Rs.{int(entry.get('deductions', 0))}")

    # Separator before net
    y -= 8
    c.setStrokeColor(GREEN)
    c.setLineWidth(1.5)
    c.line(12, y, w - 12, y)

    # Row: Net Pay (BOLD, large)
    y -= 18
    c.setFont("Helvetica-Bold", 13)
    c.setFillColor(GREEN)
    c.drawString(12, y, "NET PAY")
    c.drawString(w - 90, y, f"Rs.{int(entry['net_pay'])}")

    # Hindi label
    y -= 12
    c.setFont("Helvetica", 7)
    c.setFillColor(MID_GRAY)
    c.drawString(12, y, "Haath mein aane wali raqam")

    # ── UPI Transaction Details ──
    y -= 20
    c.setFillColor(PAYTM_BLUE)
    c.rect(8, y - 28, w - 16, 30, fill=1, stroke=0)
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(14, y - 6, "Paytm UPI Payment")
    c.setFont("Helvetica", 7)
    c.drawString(14, y - 17, f"Txn ID: {payment.get('transaction_id', 'N/A')}")
    c.drawString(14, y - 26, f"UPI Ref: {payment.get('upi_reference', 'N/A')}")

    # ── Employer Details ──
    y -= 46
    c.setFillColor(DARK_TEXT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(12, y, "Employer (Niyokta)")
    y -= 12
    c.setFont("Helvetica", 8)
    c.setFillColor(MID_GRAY)
    c.drawString(12, y, f"{contractor.get('business', 'N/A')} — {contractor.get('location', 'N/A')}")

    # ── MazdoorScore Bar ──
    y -= 22
    c.setFillColor(DARK_TEXT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(12, y, f"MazdoorScore: {score.get('score', 0)}/850")

    y -= 12
    bar_width = w - 24
    bar_height = 8
    # Background bar
    c.setFillColor(LIGHT_GRAY)
    c.rect(12, y, bar_width, bar_height, fill=1, stroke=0)
    # Score fill
    fill_width = (score.get('score', 0) / 850) * bar_width
    c.setFillColor(AMBER)
    c.rect(12, y, fill_width, bar_height, fill=1, stroke=0)

    y -= 12
    c.setFont("Helvetica", 7)
    c.setFillColor(MID_GRAY)
    c.drawString(12, y, score.get('message', ''))

    # ── QR Code ──
    qr_data = {
        "worker": entry["worker_name"],
        "worker_id": entry["worker_id"],
        "date": CONSTANTS["demo_date"],
        "net_pay": entry["net_pay"],
        "txn": payment.get("transaction_id", "N/A"),
        "issuer": "MazdoorPay",
        "score": score.get("score", 0)
    }
    qr_buffer = generate_qr_code(qr_data)
    qr_image = ImageReader(qr_buffer)
    c.drawImage(qr_image, w - 82, 12, width=68, height=68)

    # ── Footer ──
    c.setFont("Helvetica", 6)
    c.setFillColor(MID_GRAY)
    c.drawString(12, 30, "Scan QR for digital record")
    c.drawString(12, 22, "QR scan karein dijital record ke liye")
    c.drawString(12, 12, "Issued by MazdoorPay | Powered by Paytm UPI")

    c.save()
    return filepath


def generate_whatsapp_message(entry: dict, payment: dict, contractor: dict) -> str:
    """Generate WhatsApp payslip message (bilingual)."""
    return f"""*MazdoorPay Payslip*
*MazdoorPay Mazdoori Parchi*

Naam: {entry['worker_name']}
Tarikh: {CONSTANTS['demo_date']}
Kaam ke din: {entry['days_worked']}
Rate: ₹{int(entry['rate_per_day'])}/din
*Net Pay: ₹{int(entry['net_pay'])}*

UPI Ref: {payment.get('upi_reference', 'N/A')}
Employer: {contractor.get('business', 'N/A')}

_MazdoorPay — Paytm se bheja_"""


def generate_sms_message(entry: dict, payment: dict) -> str:
    """Generate SMS payslip (< 160 chars)."""
    return f"MazdoorPay: {entry['worker_name']} ko ₹{int(entry['net_pay'])} bheje. {entry['days_worked']} din, ₹{int(entry['rate_per_day'])}/din. UPI:{payment.get('upi_reference', 'N/A')[:12]}"


def generate_all_payslips(hisaab_output: dict, payment_results: list, scores: dict) -> dict:
    """
    Generate payslips for all workers.
    
    Output contract:
    {
        "payslips": {
            "W001": {
                "pdf_path": "payslips/W001_20260329.pdf",
                "pdf_url": "/api/payslip/W001_20260329.pdf",
                "whatsapp_text": "...",
                "sms_text": "...",
                "qr_data": {...},
                "delivery_method": "sms_payslip"
            }
        }
    }
    """
    try:
        payslips = {}
        contractor = hisaab_output.get("contractor", CONSTANTS["demo_contractor"])

        for i, entry in enumerate(hisaab_output.get("entries", [])):
            worker_id = entry["worker_id"]
            payment = payment_results[i] if i < len(payment_results) else {}
            score = scores.get(worker_id, {"score": 0, "message": ""})

            # Generate PDF
            try:
                pdf_path = generate_payslip_pdf(entry, payment, score, contractor)
                pdf_filename = os.path.basename(pdf_path)
                pdf_url = f"/api/payslip/{pdf_filename}"
            except Exception as e:
                print(f"[KAGAZ] PDF generation failed for {worker_id}: {e}")
                pdf_path = None
                pdf_url = None

            # Generate messages
            whatsapp_text = generate_whatsapp_message(entry, payment, contractor)
            sms_text = generate_sms_message(entry, payment)

            # QR data
            qr_data = {
                "worker": entry["worker_name"],
                "worker_id": worker_id,
                "date": CONSTANTS["demo_date"],
                "net_pay": entry["net_pay"],
                "txn": payment.get("transaction_id", "N/A"),
                "issuer": "MazdoorPay",
                "score": score.get("score", 0)
            }

            payslips[worker_id] = {
                "pdf_path": pdf_path,
                "pdf_url": pdf_url,
                "whatsapp_text": whatsapp_text,
                "sms_text": sms_text,
                "qr_data": qr_data,
                "delivery_method": entry.get("delivery_method", "qr_paper_receipt")
            }

        return {"payslips": payslips}

    except Exception as e:
        return {"payslips": {}, "error_message": str(e)}
