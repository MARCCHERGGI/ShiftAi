"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ROOT = new Set(["/", "/jobs", "/interview", "/resume-builder", "/profile"]);

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isRoot = ROOT.has(pathname);

  return (
    <header className={`top-bar ${scrolled ? "is-scrolled" : ""}`}>
      <div className="top-bar__row">
        <div>
          {!isRoot ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="top-bar__back"
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 6-6 6 6 6" />
              </svg>
              <span>Back</span>
            </button>
          ) : null}
        </div>
        <div />
      </div>
    </header>
  );
}
