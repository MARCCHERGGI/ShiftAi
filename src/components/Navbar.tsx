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
    <nav className="fixed w-full top-0 z-50 backdrop-blur-lg bg-white/80 dark:bg-[#0f0f14]/80 border-b border-gray-200/50 dark:border-gray-800/50">
      <div className="max-w-lg mx-auto flex justify-between items-center px-5 py-3">
        <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
          ShiftAI
        </span>

        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
        )}
      </div>
    </nav>
  );
}
