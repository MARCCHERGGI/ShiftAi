"use client";

import { useEffect, useRef, useState } from "react";

interface ScoreRingProps {
  score: number;
}

const SIZE = 148;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const COUNT_MS = 1100;

function ringColor(score: number): string {
  if (score >= 70) return "#34c759"; // systemGreen
  if (score >= 40) return "#ff9500"; // systemOrange
  return "#ff3b30"; // systemRed
}

export default function ScoreRing({ score }: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const [displayed, setDisplayed] = useState(0);
  const [offset, setOffset] = useState(CIRCUMFERENCE);
  const raf = useRef<number>(0);

  useEffect(() => {
    /* kick the CSS-transitioned stroke on the next frame so it animates in */
    const kick = requestAnimationFrame(() => {
      setOffset(CIRCUMFERENCE * (1 - clamped / 100));
    });

    /* count the number up with an ease-out curve */
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / COUNT_MS, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(eased * clamped));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(kick);
      cancelAnimationFrame(raf.current);
    };
  }, [clamped]);

  const color = ringColor(clamped);

  return (
    <div
      className="ring"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`Score ${clamped} of 100`}
    >
      <svg className="ring__svg" width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          className="ring__track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE}
        />
        <circle
          className="ring__progress"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ring__center">
        <span className="ring__number">{displayed}</span>
        <span className="ring__caption">of 100</span>
      </div>
    </div>
  );
}

export { ScoreRing };
