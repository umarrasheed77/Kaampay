import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { DEMO_DATA } from '../demo_data';

// Define Context and Initial Loading
const GlobalStateContext = createContext();

const loadInitialState = () => {
  try {
    const saved = localStorage.getItem('kaampay_v4_state');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load state", e);
  }
  
  // Seed initial fallback data
  return {
    workers: DEMO_DATA.payroll_entries.map(e => ({
      id: e.worker_id,
      name: e.worker_name,
      aadhaar_last4: e.aadhaar_last4,
      phone_type: e.phone_type,
      rate_per_day: e.rate_per_day || 700,
      kaam_score: DEMO_DATA.kaam_scores[e.worker_id]?.score || 350,
      joinedAt: Date.now()
    })),
    payroll_history: [...DEMO_DATA.payroll_entries],
    pending_payroll: [],
    recent_batch: [],
    // Add real pending dues natively mapped
    pending_dues: [
      { worker_id: "W_101", worker_name: "Ramesh Kumar", amount: 750, timestamp: Date.now() - 86400000, reason: "Network Error" }
    ],
    contractor: DEMO_DATA.contractor
  };
};

// Reducer for state transitions
const stateReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_WORKER':
      return {
        ...state,
        workers: [
          ...state.workers,
          {
            id: `W${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
            name: action.payload.name,
            aadhaar_last4: Math.floor(1000 + Math.random() * 9000).toString(),
            phone_type: 'smartphone',
            rate_per_day: 700,
            kaam_score: 350,
            joinedAt: Date.now()
          }
        ],
        contractor: {
          ...state.contractor,
          total_workers: state.contractor.total_workers + 1
        }
      };
    case 'ADD_PAYROLL':
      return {
        ...state,
        payroll_history: [
          ...state.payroll_history,
          {
            ...action.payload,        // worker_id, amount
            timestamp: Date.now()
          }
        ],
        contractor: {
          ...state.contractor,
          today_total: state.contractor.today_total + action.payload.amount,
          monthly_total: state.contractor.monthly_total + action.payload.amount
        }
      };
    case 'STAGE_PAYROLL':
      return {
        ...state,
        pending_payroll: Array.isArray(action.payload) ? action.payload : [action.payload] // Replacing queue with the latest requested payload
      };
    case 'CLEAR_PENDING_PAYROLL':
      return {
        ...state,
        pending_payroll: []
      };
    case 'PAY_FAILED_DUE':
      return {
        ...state,
        pending_dues: state.pending_dues.filter(d => d.worker_id !== action.payload.worker_id)
      };
    case 'SET_RECENT_BATCH':
      return {
        ...state,
        recent_batch: action.payload
      };
    case 'ADD_WALLET_BALANCE':
      return {
        ...state,
        contractor: {
          ...state.contractor,
          balance: state.contractor.balance + action.payload.amount
        }
      };
    case 'CLEAR_STATE':
      return loadInitialState(); // Reset back to DEMO_DATA but clear localStorage before
    default:
      return state;
  }
};

export const GlobalProvider = ({ children }) => {
  const [state, dispatch] = useReducer(stateReducer, {}, loadInitialState);

  // Persist to localStorage on change
  useEffect(() => {
    localStorage.setItem('kaampay_v4_state', JSON.stringify(state));
  }, [state]);

  const addWorker = (name) => {
    dispatch({ type: 'ADD_WORKER', payload: { name } });
  };

  const addPayroll = (worker_id, worker_name, amount) => {
    dispatch({ type: 'ADD_PAYROLL', payload: { worker_id, worker_name, amount, net_pay: amount } });
  };

  const stagePayroll = (payload) => {
    dispatch({ type: 'STAGE_PAYROLL', payload });
  };

  const clearPendingPayroll = () => {
    dispatch({ type: 'CLEAR_PENDING_PAYROLL' });
  };

  const payPendingDue = (worker_id) => {
    dispatch({ type: 'PAY_FAILED_DUE', payload: { worker_id } });
  };

  const setRecentBatch = (payload) => {
    dispatch({ type: 'SET_RECENT_BATCH', payload });
  };

  const addWalletBalance = (amount) => {
    dispatch({ type: 'ADD_WALLET_BALANCE', payload: { amount } });
  };

  // Robust Search Hook - Normalizes whitespace and lowercase for reliable exact phonetic match simulation
  const searchWorker = (transcript) => {
    if (!transcript) return null;
    const cleanSearch = transcript.trim().toLowerCase().replace(/\s+/g, '');
    const hit = state.workers.find(w => w.name.trim().toLowerCase().replace(/\s+/g, '') === cleanSearch);
    return hit || null;
  };

  return (
    <GlobalStateContext.Provider value={{ 
      state, dispatch, addWorker, addPayroll, stagePayroll, clearPendingPayroll, 
      payPendingDue, searchWorker, setRecentBatch, addWalletBalance
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => useContext(GlobalStateContext);
