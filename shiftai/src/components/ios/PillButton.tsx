"use client";

import type { ReactNode } from "react";

interface PillButtonProps {
  children: ReactNode;
  onPress: () => void;
  variant?: "filled" | "tinted" | "plain";
  full?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

export default function PillButton({
  children,
  onPress,
  variant = "filled",
  full = false,
  disabled = false,
  loading = false,
}: PillButtonProps) {
  const classes = [
    "pill-btn",
    `pill-btn--${variant}`,
    full ? "pill-btn--full" : null,
    loading ? "pill-btn--loading" : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={() => {
        if (!disabled && !loading) onPress();
      }}
    >
      {loading ? <span className="ios-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export { PillButton };
