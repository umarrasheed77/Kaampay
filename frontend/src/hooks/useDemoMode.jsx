import React, { createContext, useContext, useState } from 'react';

const DemoModeContext = createContext();

export function DemoModeProvider({ children }) {
  const [demoMode, setDemoMode] = useState(true);

  return (
    <DemoModeContext.Provider value={{ demoMode, setDemoMode }}>
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  return useContext(DemoModeContext);
}
