'use client';

import { useEffect, useRef, useState } from 'react';

// Scroll-in reveal: adds .in when the element enters the viewport.
export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: React.ReactNode;
  delay?: 0 | 1 | 2 | 3;
  as?: 'div' | 'section' | 'span';
  className?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const T = Tag as React.ElementType;
  return (
    <T ref={ref} className={`rv ${delay ? `d${delay}` : ''} ${seen ? 'in' : ''} ${className}`}>
      {children}
    </T>
  );
}

// Odometer count-up, fires once in view.
export function Counter({
  value,
  decimals = 0,
  duration = 1300,
}: {
  value: number;
  decimals?: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          setN(value * (1 - Math.pow(1 - p, 4)));
          if (p < 1) requestAnimationFrame(tick);
          else setN(value);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref}>
      {n.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}

// Percentage bar that fills when scrolled into view (CSS handles the motion).
export function BarRow({ label, pct }: { label: string; pct: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`bar-row ${seen ? 'seen' : ''}`}
      style={{ ['--w' as string]: `${Math.min(100, pct)}%` }}
    >
      <span className="mono">{label}</span>
      <span className="track"><i /></span>
      <span className="pct"><Counter value={pct} />%</span>
    </div>
  );
}
