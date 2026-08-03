"use client";

import type { CSSProperties, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
}

export default function Card({ children, padded = true, className, style }: CardProps) {
  const classes = ["card", padded ? "card--padded" : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
}

export { Card };
