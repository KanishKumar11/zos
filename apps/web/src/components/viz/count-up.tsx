// CountUp — numbers that roll up when they first appear or change. Honours reduced motion.
'use client';

import { animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

export function CountUp({
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  duration = 0.9,
  className,
}: {
  value: number;
  format?: (v: number) => string;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const from = useRef(reduce ? value : 0);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.2, 0.7, 0.2, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, duration, reduce]);

  return <span className={className}>{format(shown)}</span>;
}
