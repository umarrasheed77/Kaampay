/**
 * DEMO DATA — Offline Fallback
 * Pre-computed outputs from ALL agents.
 * If the backend is down during the demo, RANG reads from this file.
 * THE DEMO CONTINUES PERFECTLY.
 * 
 * Built FIRST, tested FIRST. This is the most important engineering
 * decision in the entire project.
 */

export const CONSTANTS = {
  demo_contractor: {
    name: "Suresh Sharma",
    business: "Sharma Construction",
    location: "Delhi",
    paytm_id: "MOCK_CONTRACTOR_001",
    state: "Delhi"
  },
  demo_workers: [
    { id: "W001", name: "Ramesh Kumar", aadhaar_last4: "4521", phone_type: "feature_phone", days_in_system: 47 },
    { id: "W002", name: "Suresh Yadav", aadhaar_last4: "7832", phone_type: "no_phone", days_in_system: 23 },
    { id: "W003", name: "Mohan Lal", aadhaar_last4: "3319", phone_type: "smartphone", days_in_system: 61 }
  ],
  demo_audio_transcript: "Ramesh aur Suresh ne aaj kaam kiya, 8 ghante, 700 rupay rate. Aur Mohan ne aadha din kiya.",
  demo_date: "2026-03-29"
};

// VANI output — what the NLP agent returns
export const DEMO_VANI_OUTPUT = {
  status: "success",
  transcript: "Ramesh aur Suresh ne aaj kaam kiya, 8 ghante, 700 rupay rate. Aur Mohan ne aadha din kiya.",
  payroll_entries: [
    { worker_name: "Ramesh Kumar", days_worked: 1.0, rate_per_day: 700, gross_pay: 700.0 },
    { worker_name: "Suresh Yadav", days_worked: 1.0, rate_per_day: 700, gross_pay: 700.0 },
    { worker_name: "Mohan Lal", days_worked: 0.5, rate_per_day: 700, gross_pay: 350.0 }
  ],
  confidence: 0.94,
  readback_hindi: "Maine suna:\nRamesh Kumar — 1 din — ₹700\nSuresh Yadav — 1 din — ₹700\nMohan Lal — 0.5 din — ₹350\nSahi hai?",
  error_message: null
};

// HISAAB output — validated payroll
export const DEMO_HISAAB_OUTPUT = {
  status: "success",
  payroll_date: "2026-03-29",
  contractor: CONSTANTS.demo_contractor,
  entries: [
    {
      worker_id: "W001",
      worker_name: "Ramesh Kumar",
      aadhaar_last4: "4521",
      days_worked: 1.0,
      rate_per_day: 700,
      gross_pay: 700.0,
      deductions: 0,
      net_pay: 700.0,
      wage_compliant: true,
      wage_warning: null,
      minimum_wage: 746,
      phone_type: "feature_phone",
      delivery_method: "sms_payslip",
      days_in_system: 47,
      is_new_worker: false
    },
    {
      worker_id: "W002",
      worker_name: "Suresh Yadav",
      aadhaar_last4: "7832",
      days_worked: 1.0,
      rate_per_day: 700,
      gross_pay: 700.0,
      deductions: 0,
      net_pay: 700.0,
      wage_compliant: true,
      wage_warning: null,
      minimum_wage: 746,
      phone_type: "no_phone",
      delivery_method: "qr_paper_receipt",
      days_in_system: 23,
      is_new_worker: false
    },
    {
      worker_id: "W003",
      worker_name: "Mohan Lal",
      aadhaar_last4: "3319",
      days_worked: 0.5,
      rate_per_day: 700,
      gross_pay: 350.0,
      deductions: 0,
      net_pay: 350.0,
      wage_compliant: true,
      wage_warning: null,
      minimum_wage: 746,
      phone_type: "smartphone",
      delivery_method: "whatsapp_payslip",
      days_in_system: 61,
      is_new_worker: false
    }
  ],
  total_payout: 1750.0,
  worker_count: 3
};

// PAISA output — payment results + scores
export const DEMO_PAISA_OUTPUT = {
  payment_results: [
    {
      transaction_id: "PAYABC123DEF456",
      upi_reference: "PAYTM837462819",
      worker_id: "W001",
      worker_name: "Ramesh Kumar",
      amount: 700.0,
      status: "SUCCESS",
      timestamp: "2026-03-29T18:43:22+05:30",
      delivery_method: "sms_payslip",
      delivery_status: "SMS payslip sent to Ramesh Kumar ✓",
      message_hindi: "Ramesh Kumar ko ₹700 bhej diye gaye. UPI Ref: PAYTM837462819"
    },
    {
      transaction_id: "PAYGHI789JKL012",
      upi_reference: "PAYTM291847365",
      worker_id: "W002",
      worker_name: "Suresh Yadav",
      amount: 700.0,
      status: "SUCCESS",
      timestamp: "2026-03-29T18:43:24+05:30",
      delivery_method: "qr_paper_receipt",
      delivery_status: "QR paper receipt ready for Suresh Yadav ✓",
      message_hindi: "Suresh Yadav ko ₹700 bhej diye gaye. UPI Ref: PAYTM291847365"
    },
    {
      transaction_id: "PAYMNO345PQR678",
      upi_reference: "PAYTM462819374",
      worker_id: "W003",
      worker_name: "Mohan Lal",
      amount: 350.0,
      status: "SUCCESS",
      timestamp: "2026-03-29T18:43:26+05:30",
      delivery_method: "whatsapp_payslip",
      delivery_status: "WhatsApp payslip sent to Mohan Lal ✓",
      message_hindi: "Mohan Lal ko ₹350 bhej diye gaye. UPI Ref: PAYTM462819374"
    }
  ],
  scores: {
    W001: {
      score: 487,
      band: "developing",
      days_in_system: 47,
      total_days_worked_90d: 39,
      total_earned_90d: 26950,
      message: "₹10,000 loan + insurance eligible",
      message_hindi: "₹10,000 loan + insurance ke liye eligible",
      progress_to_next_band: { next_band: "established", points_needed: 163, progress_percent: 75 },
      factors: [
        { name: "Work Consistency", name_hindi: "Kaam ki Niyamitata", value: 156, max: 200 },
        { name: "Time on Platform", name_hindi: "Platform par Samay", value: 120, max: 150 },
        { name: "Total Earnings", name_hindi: "Kul Kamaai", value: 139, max: 200 },
        { name: "Employer Diversity", name_hindi: "Vibhinn Niyokta", value: 25, max: 100 }
      ],
      eligibility: [
        { name: "Emergency Loan", name_hindi: "Emergency Loan", amount: "₹2,000", provider: "Paytm Postpaid", icon: "loan" },
        { name: "Personal Loan", name_hindi: "Personal Loan", amount: "₹10,000", provider: "Paytm Postpaid", icon: "loan" },
        { name: "PMJJBY Health Insurance", name_hindi: "PMJJBY Swasthya Bima", amount: "₹330/year", provider: "Govt of India", icon: "insurance" }
      ]
    },
    W002: {
      score: 382,
      band: "basic",
      days_in_system: 23,
      total_days_worked_90d: 19,
      total_earned_90d: 13100,
      message: "₹2,000 emergency loan eligible",
      message_hindi: "₹2,000 emergency loan ke liye eligible",
      progress_to_next_band: { next_band: "developing", points_needed: 118, progress_percent: 76 },
      factors: [
        { name: "Work Consistency", name_hindi: "Kaam ki Niyamitata", value: 76, max: 200 },
        { name: "Time on Platform", name_hindi: "Platform par Samay", value: 57, max: 150 },
        { name: "Total Earnings", name_hindi: "Kul Kamaai", value: 82, max: 200 },
        { name: "Employer Diversity", name_hindi: "Vibhinn Niyokta", value: 25, max: 100 }
      ],
      eligibility: [
        { name: "Emergency Loan", name_hindi: "Emergency Loan", amount: "₹2,000", provider: "Paytm Postpaid", icon: "loan" }
      ]
    },
    W003: {
      score: 621,
      band: "established",
      days_in_system: 61,
      total_days_worked_90d: 52,
      total_earned_90d: 35750,
      message: "₹25,000 loan + govt schemes eligible",
      message_hindi: "₹25,000 loan + sarkari yojanaon ke liye eligible",
      progress_to_next_band: { next_band: "prime", points_needed: 129, progress_percent: 83 },
      factors: [
        { name: "Work Consistency", name_hindi: "Kaam ki Niyamitata", value: 200, max: 200 },
        { name: "Time on Platform", name_hindi: "Platform par Samay", value: 150, max: 150 },
        { name: "Total Earnings", name_hindi: "Kul Kamaai", value: 175, max: 200 },
        { name: "Employer Diversity", name_hindi: "Vibhinn Niyokta", value: 25, max: 100 }
      ],
      eligibility: [
        { name: "Emergency Loan", name_hindi: "Emergency Loan", amount: "₹2,000", provider: "Paytm Postpaid", icon: "loan" },
        { name: "Personal Loan", name_hindi: "Personal Loan", amount: "₹10,000", provider: "Paytm Postpaid", icon: "loan" },
        { name: "PMJJBY Health Insurance", name_hindi: "PMJJBY Swasthya Bima", amount: "₹330/year", provider: "Govt of India", icon: "insurance" },
        { name: "PM Vishwakarma Scheme", name_hindi: "PM Vishwakarma Yojana", amount: "Up to ₹3,00,000", provider: "Govt of India", icon: "scheme" }
      ]
    }
  },
  total_paid: 1750.0,
  payment_status: "all_success",
  payslips: {
    W001: {
      whatsapp_text: "*MazdoorPay Payslip*\n\nNaam: Ramesh Kumar\nTarikh: 2026-03-29\nKaam ke din: 1.0\nRate: ₹700/din\n*Net Pay: ₹700*\n\nUPI Ref: PAYTM837462819\nEmployer: Sharma Construction\n\n_MazdoorPay — Paytm se bheja_",
      sms_text: "MazdoorPay: Ramesh Kumar ko ₹700 bheje. 1.0 din, ₹700/din. UPI:PAYTM837462",
      qr_data: { worker: "Ramesh Kumar", worker_id: "W001", date: "2026-03-29", net_pay: 700, txn: "PAYABC123DEF456", issuer: "MazdoorPay", score: 487 },
      delivery_method: "sms_payslip"
    },
    W002: {
      whatsapp_text: "*MazdoorPay Payslip*\n\nNaam: Suresh Yadav\nTarikh: 2026-03-29\nKaam ke din: 1.0\nRate: ₹700/din\n*Net Pay: ₹700*\n\nUPI Ref: PAYTM291847365\nEmployer: Sharma Construction\n\n_MazdoorPay — Paytm se bheja_",
      sms_text: "MazdoorPay: Suresh Yadav ko ₹700 bheje. 1.0 din, ₹700/din. UPI:PAYTM291847",
      qr_data: { worker: "Suresh Yadav", worker_id: "W002", date: "2026-03-29", net_pay: 700, txn: "PAYGHI789JKL012", issuer: "MazdoorPay", score: 382 },
      delivery_method: "qr_paper_receipt"
    },
    W003: {
      whatsapp_text: "*MazdoorPay Payslip*\n\nNaam: Mohan Lal\nTarikh: 2026-03-29\nKaam ke din: 0.5\nRate: ₹700/din\n*Net Pay: ₹350*\n\nUPI Ref: PAYTM462819374\nEmployer: Sharma Construction\n\n_MazdoorPay — Paytm se bheja_",
      sms_text: "MazdoorPay: Mohan Lal ko ₹350 bheje. 0.5 din, ₹700/din. UPI:PAYTM462819",
      qr_data: { worker: "Mohan Lal", worker_id: "W003", date: "2026-03-29", net_pay: 350, txn: "PAYMNO345PQR678", issuer: "MazdoorPay", score: 621 },
      delivery_method: "whatsapp_payslip"
    }
  }
};

// Worker history for profile pages
export const DEMO_WORKER_HISTORY = {
  W001: [
    { date: "2026-03-29", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYABC123DEF456" },
    { date: "2026-03-28", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY1B2C3D4E5F6" },
    { date: "2026-03-27", days_worked: 1.0, gross_pay: 750, rate_per_day: 750, transaction_id: "PAY7G8H9I0J1K2" },
    { date: "2026-03-26", days_worked: 0.5, gross_pay: 350, rate_per_day: 700, transaction_id: "PAY3L4M5N6O7P8" },
    { date: "2026-03-25", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY9Q0R1S2T3U4" },
    { date: "2026-03-24", days_worked: 1.0, gross_pay: 680, rate_per_day: 680, transaction_id: "PAY5V6W7X8Y9Z0" },
    { date: "2026-03-22", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYA1B2C3D4E5F" },
    { date: "2026-03-21", days_worked: 1.0, gross_pay: 650, rate_per_day: 650, transaction_id: "PAY6G7H8I9J0K1" }
  ],
  W002: [
    { date: "2026-03-29", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYGHI789JKL012" },
    { date: "2026-03-28", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY2L3M4N5O6P7" },
    { date: "2026-03-27", days_worked: 1.0, gross_pay: 650, rate_per_day: 650, transaction_id: "PAY8Q9R0S1T2U3" },
    { date: "2026-03-25", days_worked: 0.5, gross_pay: 350, rate_per_day: 700, transaction_id: "PAY4V5W6X7Y8Z9" },
    { date: "2026-03-24", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYB0C1D2E3F4G" }
  ],
  W003: [
    { date: "2026-03-29", days_worked: 0.5, gross_pay: 350, rate_per_day: 700, transaction_id: "PAYMNO345PQR678" },
    { date: "2026-03-28", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY5H6I7J8K9L0" },
    { date: "2026-03-27", days_worked: 1.0, gross_pay: 750, rate_per_day: 750, transaction_id: "PAY1M2N3O4P5Q6" },
    { date: "2026-03-26", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY7R8S9T0U1V2" },
    { date: "2026-03-25", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY3W4X5Y6Z7A8" },
    { date: "2026-03-24", days_worked: 1.0, gross_pay: 680, rate_per_day: 680, transaction_id: "PAY9B0C1D2E3F4" },
    { date: "2026-03-22", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAY5G6H7I8J9K0" },
    { date: "2026-03-21", days_worked: 0.5, gross_pay: 350, rate_per_day: 700, transaction_id: "PAY1L2M3N4O5P6" }
  ]
};
