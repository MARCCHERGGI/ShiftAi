"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const EXIT_MS = 320;

export default function Sheet({ open, onClose, title, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);

  /* keep the sheet in the tree during the slide-down exit animation */
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  /* lock body scroll while presented */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  /* dismiss on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div className={open ? "sheet" : "sheet sheet--closing"}>
      <div className="sheet__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__grabber" aria-hidden="true" />
        {title ? <div className="sheet__title">{title}</div> : null}
        <div className="sheet__content">{children}</div>
      </div>
    </div>
  );
}

export { Sheet };
