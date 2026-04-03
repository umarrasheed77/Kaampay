import { useState, useEffect } from 'react';

export default function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    let v = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      v = Math.min(v + step, target);
      setVal(Math.floor(v));
      if (v >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);

  return val;
}
