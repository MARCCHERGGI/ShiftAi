"use client";

import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface RowProps {
  label: ReactNode;
  value?: ReactNode;
  icon?: ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}

export default function Row({ label, value, icon, chevron = false, onPress, children }: RowProps) {
  const content = (
    <>
      {icon ? <span className="row__icon">{icon}</span> : null}
      <span className="row__label">{label}</span>
      {value !== undefined && value !== null ? <span className="row__value">{value}</span> : null}
      {children ? <span className="row__children">{children}</span> : null}
      {chevron ? (
        <ChevronRight size={17} strokeWidth={2.4} className="row__chevron" aria-hidden="true" />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <button type="button" className="row row--press" onClick={onPress}>
        {content}
      </button>
    );
  }

  return <div className="row">{content}</div>;
}

export { Row };
