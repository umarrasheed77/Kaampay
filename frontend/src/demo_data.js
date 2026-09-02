// ─────────────────────────────────────────
// DEMO_VANI_OUTPUT — mirrors POST /api/transcribe's response shape
// (previously imported by api.js but never defined anywhere in this
// file, so every demoMode=true call to apiTranscribe() returned
// `undefined` instead of usable fixture data)
// ─────────────────────────────────────────

export const DEMO_VANI_OUTPUT = {
  status: "success",
  transcript: "Ramesh aur Suresh ne aaj kaam kiya, 8 ghante, 700 rupay rate. Aur Mohan ne aadha din kiya.",
  payroll_entries: [
    { worker_name: "Ramesh Kumar", worker_id: "W001", days_worked: 1.0, rate_per_day: 700, gross_pay: 700 },
    { worker_name: "Suresh Yadav", worker_id: "W002", days_worked: 1.0, rate_per_day: 700, gross_pay: 700 },
    { worker_name: "Mohan Lal", worker_id: "W003", days_worked: 0.5, rate_per_day: 700, gross_pay: 350 }
  ],
  confidence: 0.92,
  readback_hindi: "Worker Ramesh Kumar, Suresh Yadav, Mohan Lal verified. Access accepted.",
  error_message: null,
  parsing_notes: "Demo fixture (offline mode)",
  attempt: "demo",
  verification: {
    all_verified: true,
    verified_count: 3,
    unverified_count: 0,
    unverified_names: [],
    details: [
      { input_name: "Ramesh", matched_to: "Ramesh Kumar", score: 100, status: "verified" },
      { input_name: "Suresh", matched_to: "Suresh Yadav", score: 100, status: "verified" },
      { input_name: "Mohan", matched_to: "Mohan Lal", score: 100, status: "verified" }
    ]
  }
};

// ─────────────────────────────────────────
// DEMO_HISAAB_OUTPUT — mirrors POST /api/process-payroll's response
// shape (see backend/agents/hisaab.py:process_payroll). Same missing-
// export issue as DEMO_VANI_OUTPUT above.
// ─────────────────────────────────────────

export const DEMO_HISAAB_OUTPUT = {
  status: "success",
  payroll_date: "2026-08-30",
  contractor: { contractor_id: "CONT_001", name: "Suresh Sharma", business_name: "Sharma Construction", state: "Delhi" },
  entries: [
    { worker_id: "W001", worker_name: "Ramesh Kumar", aadhaar_last4: "4521", days_worked: 1.0, rate_per_day: 700,
      gross_pay: 700, deductions: 0, net_pay: 700, wage_compliant: false,
      wage_warning: "Yeh rate minimum wage se kam hai. Delhi mein minimum ₹746 rupay hai.",
      minimum_wage: 746, phone_type: "feature_phone", delivery_method: "sms_payslip" },
    { worker_id: "W002", worker_name: "Suresh Yadav", aadhaar_last4: "7832", days_worked: 1.0, rate_per_day: 700,
      gross_pay: 700, deductions: 0, net_pay: 700, wage_compliant: false,
      wage_warning: "Yeh rate minimum wage se kam hai. Delhi mein minimum ₹746 rupay hai.",
      minimum_wage: 746, phone_type: "no_phone", delivery_method: "card_load" },
    { worker_id: "W003", worker_name: "Mohan Lal", aadhaar_last4: "3319", days_worked: 0.5, rate_per_day: 700,
      gross_pay: 350, deductions: 0, net_pay: 350, wage_compliant: true, wage_warning: null,
      minimum_wage: 746, phone_type: "smartphone", delivery_method: "whatsapp_payslip" }
  ],
  total_payout: 1750,
  worker_count: 3
};

// ─────────────────────────────────────────
// DEMO_PAISA_OUTPUT — mirrors the merged /api/execute-payments response
// (execute_all_payments + generate_all_payslips). Same missing-export
// issue as above.
// ─────────────────────────────────────────

export const DEMO_PAISA_OUTPUT = {
  payment_results: [
    { payment_id: "demo-pay-001", transaction_id: "TXN837462819", upi_reference: "PAYTM837462819",
      worker_id: "W001", worker_name: "Ramesh Kumar", amount: 700, status: "SUCCESS", attempts: 1,
      delivery_method: "sms_payslip", delivery_status: "SMS payslip sent to Ramesh Kumar ✓",
      message_hindi: "Ramesh Kumar ko ₹700 bhej diye gaye. UPI Ref: PAYTM837462819" },
    { payment_id: "demo-pay-002", transaction_id: "TXN291847562", upi_reference: "PAYTM291847562",
      worker_id: "W002", worker_name: "Suresh Yadav", amount: 700, status: "SUCCESS", attempts: 1,
      delivery_method: "card_load", delivery_status: "Loaded to RuPay card for Suresh Yadav ✓",
      message_hindi: "Suresh Yadav ko ₹700 bhej diye gaye. UPI Ref: PAYTM291847562" },
    { payment_id: "demo-pay-003", transaction_id: "TXN648291037", upi_reference: "PAYTM648291037",
      worker_id: "W003", worker_name: "Mohan Lal", amount: 350, status: "SUCCESS", attempts: 1,
      delivery_method: "whatsapp_payslip", delivery_status: "WhatsApp payslip sent to Mohan Lal ✓",
      message_hindi: "Mohan Lal ko ₹350 bhej diye gaye. UPI Ref: PAYTM648291037" }
  ],
  scores: {},
  total_paid: 1750,
  payment_status: "all_success",
  payslips: {
    W001: { pdf_url: null, whatsapp_text: null, sms_text: "KaamPay: Ramesh Kumar ko ₹700 bheja gaya. Ref: PAYTM837462819" },
    W002: { pdf_url: null, whatsapp_text: null, sms_text: "KaamPay: Suresh Yadav ko ₹700 bheja gaya. Ref: PAYTM291847562" },
    W003: { pdf_url: null, whatsapp_text: "KaamPay: Mohan Lal ko ₹350 bheja gaya. Ref: PAYTM648291037", sms_text: null }
  }
};

// ─────────────────────────────────────────
// DEMO_WORKER_HISTORY — mirrors get_worker_history()'s per-entry shape.
// Same missing-export issue as above; apiWorkerScore's demoMode branch
// referenced this directly.
// ─────────────────────────────────────────

export const DEMO_WORKER_HISTORY = {
  W001: [
    { date: "2026-08-30", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYTM837462819" },
    { date: "2026-08-29", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYTM736281940" },
    { date: "2026-08-28", days_worked: 0.5, gross_pay: 350, rate_per_day: 700, transaction_id: "PAYTM625104839" }
  ],
  W002: [
    { date: "2026-08-30", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYTM291847562" },
    { date: "2026-08-26", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYTM180736451" }
  ],
  W003: [
    { date: "2026-08-30", days_worked: 0.5, gross_pay: 350, rate_per_day: 700, transaction_id: "PAYTM648291037" },
    { date: "2026-08-29", days_worked: 1.0, gross_pay: 750, rate_per_day: 750, transaction_id: "PAYTM537180926" },
    { date: "2026-08-28", days_worked: 1.0, gross_pay: 700, rate_per_day: 700, transaction_id: "PAYTM426079815" }
  ]
};

export const DEMO_DATA = {

  transcript: "Ramesh aur Suresh ne aaj kaam kiya, " +
    "8 ghante, 700 rupay rate. Aur Mohan ne " +
    "aadha din kiya.",

  payroll_entries: [
    {
      worker_id: "W001",
      worker_name: "Ramesh Kumar",
      aadhaar_last4: "4521",
      days_worked: 1.0,
      rate_per_day: 700,
      gross_pay: 700,
      deductions: 0,
      net_pay: 700,
      wage_compliant: true,
      phone_type: "feature_phone",
      delivery_method: "sms_payslip"
    },
    {
      worker_id: "W002",
      worker_name: "Suresh Yadav",
      aadhaar_last4: "7832",
      days_worked: 1.0,
      rate_per_day: 700,
      gross_pay: 700,
      deductions: 0,
      net_pay: 700,
      wage_compliant: true,
      phone_type: "no_phone",
      delivery_method: "card_load"
    },
    {
      worker_id: "W003",
      worker_name: "Mohan Lal",
      aadhaar_last4: "3319",
      days_worked: 0.5,
      rate_per_day: 700,
      gross_pay: 350,
      deductions: 0,
      net_pay: 350,
      wage_compliant: true,
      phone_type: "smartphone",
      delivery_method: "whatsapp_payslip"
    }
  ],

  balance_check: {
    sufficient: true,
    available_balance: 15000,
    required: 1750,
    shortfall: 0
  },

  payment_results: [
    {
      worker_id: "W001",
      worker_name: "Ramesh Kumar",
      amount: 700,
      status: "SUCCESS",
      upi_reference: "PAYTM837462819",
      delivery: "SMS sent to +91 98765 XXXXX"
    },
    {
      worker_id: "W002",
      worker_name: "Suresh Yadav",
      amount: 700,
      status: "SUCCESS",
      upi_reference: "PAYTM291847562",
      delivery: "Loaded to card ending 8321"
    },
    {
      worker_id: "W003",
      worker_name: "Mohan Lal",
      amount: 350,
      status: "SUCCESS",
      upi_reference: "PAYTM648291037",
      delivery: "WhatsApp payslip sent"
    }
  ],

  kaam_scores: {
    "W001": {
      score: 487, band: "developing",
      days_in_system: 47,
      total_earned_90d: 28700,
      loan_eligible: "₹10,000",
      benefits: [
        "₹10,000 personal loan",
        "PMJJBY life insurance (₹330/year)",
        "Ration card linkage support"
      ],
      score_history: [
        310,320,335,350,362,378,390,
        405,418,430,445,451,460,470,
        475,480,483,485,487
      ]
    },
    "W002": {
      score: 312, band: "basic",
      days_in_system: 23,
      total_earned_90d: 14350,
      loan_eligible: "₹2,000",
      benefits: ["₹2,000 emergency loan"],
      score_history: [
        280,285,290,295,300,305,308,310,312
      ]
    },
    "W003": {
      score: 621, band: "established",
      days_in_system: 61,
      total_earned_90d: 36750,
      loan_eligible: "₹25,000",
      benefits: [
        "₹25,000 business loan",
        "PM Vishwakarma scheme",
        "PM Suraksha Bima insurance"
      ],
      score_history: [
        350,375,400,420,445,460,
        478,492,510,525,540,558,
        570,582,595,605,612,618,621
      ],
      loan_offer: {
        amount: 25000,
        rate: "14% p.a.",
        emi: 2380,
        tenure: 12,
        basis: "KaamScore 621 — Established band",
        verified_income: 36750
      }
    }
  },

  contractor: {
    name: "Suresh Sharma",
    business: "Sharma Construction",
    balance: 15000,
    total_workers: 3,
    monthly_total: 47300,
    today_total: 1750,
    pending_count: 1
  },

  insights: [
    {
      icon: "star",
      type: "positive",
      text_english: "Mohan Lal is your most consistent worker",
      text_hindi: "Mohan aapka sabse regular worker hai"
    },
    {
      icon: "trending_up",
      type: "warning",
      text_english: "Spending 12% higher than last week",
      text_hindi: "Is hafte spending 12% zyada hai"
    },
    {
      icon: "alert",
      type: "alert",
      text_english: "1 payment held — retry recommended",
      text_hindi: "1 payment pending hai"
    }
  ],

  // ── The four keys below were missing entirely — api.js's
  // apiContractorSummary / apiContractorWorkers / apiDailyTotals /
  // apiContractorInsights demoMode branches, and ContractorDashboard.jsx's
  // (now-removed orphan) direct destructure, all referenced these and
  // got `undefined`. Added additively; nothing above was changed.

  dashboard_summary: {
    today_total: 1750,
    today_workers: 3,
    month_total: 47300,
    pending_count: 1
  },

  dashboard_workers: [
    { worker_id: "W001", name: "Ramesh Kumar", job_type: "unskilled", kaam_score: 487, kaam_band: "developing",
      last_paid_date: "2026-08-30", days_since_last_payment: 0, total_days: 40.5, total_earned: 28700 },
    { worker_id: "W002", name: "Suresh Yadav", job_type: "unskilled", kaam_score: 312, kaam_band: "basic",
      last_paid_date: "2026-08-30", days_since_last_payment: 0, total_days: 20.0, total_earned: 14350 },
    { worker_id: "W003", name: "Mohan Lal", job_type: "semi_skilled", kaam_score: 621, kaam_band: "established",
      last_paid_date: "2026-08-30", days_since_last_payment: 0, total_days: 40.5, total_earned: 36750 }
  ],

  dashboard_daily_totals: [
    { date: "2026-08-17", total: 1900, count: 3 },
    { date: "2026-08-18", total: 1400, count: 2 },
    { date: "2026-08-19", total: 2100, count: 3 },
    { date: "2026-08-20", total: 0, count: 0 },
    { date: "2026-08-21", total: 2100, count: 3 },
    { date: "2026-08-22", total: 1750, count: 3 },
    { date: "2026-08-23", total: 1450, count: 2 },
    { date: "2026-08-24", total: 1900, count: 3 },
    { date: "2026-08-25", total: 1400, count: 2 },
    { date: "2026-08-26", total: 2100, count: 3 },
    { date: "2026-08-27", total: 0, count: 0 },
    { date: "2026-08-28", total: 1750, count: 3 },
    { date: "2026-08-29", total: 1450, count: 2 },
    { date: "2026-08-30", total: 1750, count: 3 }
  ],

  dashboard_insights: [
    { icon: "star", type: "positive", text_english: "Mohan Lal is your most consistent worker", text_hindi: "Mohan aapka sabse regular worker hai" },
    { icon: "trending_up", type: "warning", text_english: "Spending 12% higher than last week", text_hindi: "Is hafte spending 12% zyada hai" },
    { icon: "alert", type: "alert", text_english: "1 payment held — retry recommended", text_hindi: "1 payment pending hai" }
  ]
};
