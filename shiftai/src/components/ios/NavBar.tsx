"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface NavBarProps {
  title: string;
  large?: boolean;
  right?: ReactNode;
}

/**
 * iOS navigation bar.
 *
 * Large mode renders BOTH bars as direct children of <main> (fragment, so
 * `position: sticky` spans the whole page, not just a header wrapper):
 *   - a sticky 44px inline bar — transparent at rest, blur + centered
 *     17px title once the large title scrolls under it
 *   - a 1px sentinel + the 34px left-aligned large title in normal flow
 * Collapse detection is an IntersectionObserver on the sentinel — no
 * scroll listeners. The `right` accessory lives inside the 44px inline
 * bar, so 44×44 accessories fit without clipping.
 */
export default function NavBar({ title, large = false, right }: NavBarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!large) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { rootMargin: "-44px 0px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [large]);

  if (large) {
    return (
      <>
        <header
          className={
            collapsed ? "navbar__inlinebar navbar__inlinebar--visible" : "navbar__inlinebar"
          }
        >
          <div className="navbar__title-inline">{title}</div>
          {right ? <div className="navbar__right">{right}</div> : null}
        </header>
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
        <h1 className="navbar__title-large">{title}</h1>
      </>
    );
  }

  return (
    <header className="navbar navbar--inline">
      <div className="navbar__bar">
        <div className="navbar__title-inline">{title}</div>
        {right ? <div className="navbar__right">{right}</div> : null}
      </div>
    </header>
  );
}

export { NavBar };
