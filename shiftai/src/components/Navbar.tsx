"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/src/components/ThemeProvider";
import { Moon, Sun } from "lucide-react"; // For theme icons
import { useEffect, useState } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration errors by ensuring theme is applied on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="fixed w-full top-0 shadow-md bg-white dark:bg-gray-900 transition-all z-50 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-6xl mx-auto flex justify-between items-center p-4">
        {/* 🔹 Brand Logo */}
        <Link href="/" className="text-xl font-bold hover:text-primary transition">
          ShiftAI
        </Link>

        {/* 🔹 Navigation Links */}
        <div className="hidden md:flex space-x-6">
          <NavLink href="/" text="Home" active={pathname === "/"} />
          <NavLink href="/interview" text="Interview" active={pathname === "/interview"} />
          <NavLink href="/feedback" text="Feedback" active={pathname === "/feedback"} />
          <NavLink href="/profile" text="Profile" active={pathname === "/profile"} />
        </div>

        {/* 🔹 Theme Toggle Button */}
        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-yellow-400" />
            ) : (
              <Moon className="w-5 h-5 text-gray-900" />
            )}
          </button>
        )}
      </div>
    </nav>
  );
}

// ✅ Reusable NavLink Component
function NavLink({
  href,
  text,
  active,
}: {
  href: string;
  text: string;
  active: boolean;
}) {
  return (
    <Link href={href}>
      <span
        className={`hover:text-primary transition ${
          active ? "text-primary font-semibold" : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {text}
      </span>
    </Link>
  );
}
