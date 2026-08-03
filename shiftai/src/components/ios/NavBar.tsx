"use client";

import type { ReactNode } from "react";

interface NavBarProps {
  title: string;
  large?: boolean;
  right?: ReactNode;
}

export default function NavBar({ title, large = false, right }: NavBarProps) {
  if (large) {
    return (
      <header className="navbar navbar--large">
        <div className="navbar__bar">
          {right ? <div className="navbar__right">{right}</div> : null}
        </div>
        <h1 className="navbar__title-large">{title}</h1>
      </header>
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
