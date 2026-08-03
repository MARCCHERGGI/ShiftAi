"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, MessageSquare, FileText } from "lucide-react";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/jobs", icon: Search, label: "Jobs" },
  { href: "/interview", icon: MessageSquare, label: "Interview" },
  { href: "/resume-builder", icon: FileText, label: "Resume" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="max-w-lg mx-auto flex justify-around items-center h-14 px-4">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-1 py-1 px-3"
            >
              <Icon
                className="w-5 h-5 transition-colors"
                strokeWidth={isActive ? 2.2 : 1.5}
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-tertiary)",
                }}
              />
              <span
                className="text-[10px] transition-colors"
                style={{
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "var(--accent)" : "var(--text-tertiary)",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
