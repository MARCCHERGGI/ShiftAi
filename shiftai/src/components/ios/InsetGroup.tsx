"use client";

import type { ReactNode } from "react";

interface InsetGroupProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * iOS grouped-inset list section: uppercase header, white rounded
 * card holding `Row`s (hairline-separated), footnote footer.
 */
export default function InsetGroup({ header, footer, children }: InsetGroupProps) {
  return (
    <section className="inset-group">
      {header ? <div className="inset-group__header">{header}</div> : null}
      <div className="inset-group__card">{children}</div>
      {footer ? <div className="inset-group__footer">{footer}</div> : null}
    </section>
  );
}

export { InsetGroup };
