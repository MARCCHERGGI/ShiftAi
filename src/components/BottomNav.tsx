"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const I = (p: { children: React.ReactNode; active?: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22"
    fill={p.active ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth={p.active ? 0 : 1.7}
    strokeLinecap="round" strokeLinejoin="round">
    {p.children}
  </svg>
);

const items = [
  { href: "/", label: "Home",
    Icon: (a: boolean) => <I active={a}><><path d="M3.5 11.5 12 4l8.5 7.5V20a1 1 0 0 1-1 1h-4v-6h-7v6h-4a1 1 0 0 1-1-1z" /></></I> },
  { href: "/jobs", label: "Jobs",
    Icon: (a: boolean) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill={a ? "currentColor" : "none"} stroke="currentColor" strokeWidth={a ? 0 : 1.7} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10.5" cy="10.5" r="6" />
        <path d="m20 20-4.4-4.4" stroke="currentColor" strokeWidth={1.7} />
      </svg>
    ) },
  { href: "/interview", label: "Interview",
    Icon: (a: boolean) => <I active={a}><><path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></></I> },
  { href: "/resume-builder", label: "Resume",
    Icon: (a: boolean) => <I active={a}><><path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" stroke="currentColor" strokeWidth={1.7} fill="none" /></></I> },
  { href: "/profile", label: "You",
    Icon: (a: boolean) => <I active={a}><><circle cx="12" cy="8" r="3.6" /><path d="M4 20c0-3.7 3.6-6.5 8-6.5s8 2.8 8 6.5" /></></I> },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tab-bar-wrap" aria-label="Primary">
      <div className="tab-bar">
        {items.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className="tab-item">
              <span className="tab-item__icon">{Icon(active)}</span>
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
