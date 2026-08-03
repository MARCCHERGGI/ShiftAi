"use client";

import { useTheme } from "@/src/components/ThemeProvider";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav
      className="fixed w-full top-0 z-50"
      style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-lg mx-auto flex justify-between items-center px-5 h-12">
        <span
          className="text-base font-bold"
          style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
        >
          shift
          <span style={{ color: "var(--accent)" }}>ai</span>
        </span>

        {mounted && (
          <button
            onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
