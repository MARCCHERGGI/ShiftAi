"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, List, FileText, Mic, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { trackEvent } from "@/src/lib/track";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/", label: "Prep", icon: Sparkles },
  { href: "/jobs", label: "Jobs", icon: List },
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/interview", label: "Interview", icon: Mic },
  { href: "/profile", label: "Profile", icon: User },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Main tabs">
      <div className="tabbar__inner">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={active ? "tabbar__item tabbar__item--active" : "tabbar__item"}
              aria-current={active ? "page" : undefined}
              onClick={() => trackEvent("tab_nav", { tab: label.toLowerCase() })}
            >
              <Icon size={24} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
              <span className="tabbar__label">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { TabBar };
