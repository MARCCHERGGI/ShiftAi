"use client";

/**
 * Shift AI — single component vocabulary.
 * Every page imports from here. No bespoke component variations elsewhere.
 *
 * Inspired by: Linear (status donuts, list rows), Apple Sports (oversize
 * metric + sparkline), Cash App (signature ink hero card + ledger).
 */

import { ReactNode, forwardRef } from "react";

/* ─────────────────────────────────────────────────────────────────
   Brand mark — two offset pills (the "shift")
   ─────────────────────────────────────────────────────────────── */

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" width={size} height={size} aria-hidden>
      <rect x="6" y="7"  width="20" height="6" rx="3" fill="var(--accent)" />
      <rect x="2" y="15" width="20" height="6" rx="3" fill="var(--ink)" />
    </svg>
  );
}

export function BrandLockup() {
  return (
    <span className="inline-flex items-center gap-2 select-none">
      <BrandMark size={22} />
      <span
        className="font-bold"
        style={{ letterSpacing: "-0.03em", fontSize: 16 }}
      >
        Shift
      </span>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Buttons
   ─────────────────────────────────────────────────────────────── */

type BtnVariant = "primary" | "accent" | "ghost" | "outline" | "link";
type BtnSize = "sm" | "md" | "lg";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 font-semibold tracking-[-0.012em] transition-all duration-150 active:scale-[0.97] disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap select-none";

const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary:  "bg-[var(--ink)] text-white hover:bg-[#1a1a1a]",
  accent:   "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]",
  ghost:    "bg-[rgba(10,10,10,0.06)] text-[var(--ink)] hover:bg-[rgba(10,10,10,0.10)]",
  outline:  "bg-transparent text-[var(--ink)] border-[1.5px] border-[var(--ink)] hover:bg-[var(--ink)] hover:text-white",
  link:     "bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)] py-2",
};

const BTN_SIZES: Record<BtnSize, string> = {
  sm: "px-4 py-2.5 text-[14px] rounded-full",
  md: "px-5 py-3.5 text-[15px] rounded-full",
  lg: "px-6 py-[18px] text-[17px] rounded-full",
};

export const Button = forwardRef<
  HTMLButtonElement,
  {
    children: ReactNode;
    variant?: BtnVariant;
    size?: BtnSize;
    full?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    type?: "button" | "submit";
    className?: string;
    "aria-label"?: string;
  }
>(function Button(
  {
    children,
    variant = "primary",
    size = "lg",
    full = false,
    onClick,
    disabled,
    type = "button",
    className = "",
    "aria-label": ariaLabel,
  },
  ref
) {
  const w = full ? "w-full" : "";
  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${w} ${className}`}
      style={
        variant === "primary"
          ? { boxShadow: "0 12px 26px -10px rgba(10,10,10,0.30)" }
          : variant === "accent"
          ? { boxShadow: "0 12px 26px -10px rgba(180,83,9,0.50)" }
          : undefined
      }
    >
      {children}
    </button>
  );
});

/* ─────────────────────────────────────────────────────────────────
   Cards
   ─────────────────────────────────────────────────────────────── */

type CardSurface = "white" | "ink" | "accent" | "cream";

export function Card({
  children,
  surface = "white",
  pad = 24,
  className = "",
  onClick,
  href,
}: {
  children: ReactNode;
  surface?: CardSurface;
  pad?: number;
  className?: string;
  onClick?: () => void;
  href?: string;
}) {
  const bg =
    surface === "ink"    ? "var(--ink)"        :
    surface === "accent" ? "var(--accent)"     :
    surface === "cream"  ? "var(--bg-elevated)":
                           "#FFFFFF";
  const fg = surface === "ink" || surface === "accent" ? "#FFFFFF" : "var(--ink)";
  const shadow =
    surface === "ink"
      ? "0 24px 50px -20px rgba(10,10,10,0.45), inset 0 1px 0 rgba(255,255,255,0.06)"
      : surface === "accent"
      ? "0 24px 50px -20px rgba(180,83,9,0.55), inset 0 1px 0 rgba(255,255,255,0.18)"
      : "0 1px 0 rgba(10,10,10,0.04), 0 8px 24px -16px rgba(10,10,10,0.10)";

  const Tag: React.ElementType = href ? "a" : onClick ? "button" : "div";
  const interactive = href || onClick
    ? "cursor-pointer transition-transform active:scale-[0.985]"
    : "";

  return (
    <Tag
      href={href}
      onClick={onClick}
      className={`block w-full rounded-[20px] text-left ${interactive} ${className}`}
      style={{
        background: bg,
        color: fg,
        padding: pad,
        boxShadow: shadow,
      }}
    >
      {children}
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Stat — label + oversize tabular value + optional delta
   ─────────────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  unit,
  delta,
  size = 56,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { sign: "+" | "−"; value: string; tone?: "up" | "down" | "flat" };
  size?: number;
  tone?: "ink" | "accent" | "white" | "success" | "danger";
}) {
  const toneColor: Record<string, string> = {
    ink:     "var(--ink)",
    accent:  "var(--accent)",
    white:   "#FFFFFF",
    success: "var(--success)",
    danger:  "var(--danger)",
  };
  const labelColor = tone === "white" ? "rgba(255,255,255,0.6)" : "var(--ink-muted)";
  return (
    <div>
      <p
        className="caption uppercase"
        style={{ color: labelColor, letterSpacing: "0.14em", fontWeight: 600 }}
      >
        {label}
      </p>
      <p
        className="metric mt-1"
        style={{
          color: toneColor[tone],
          fontSize: size,
          lineHeight: 0.95,
        }}
      >
        {value}
        {unit && (
          <span
            className="ml-1 font-medium"
            style={{ fontSize: size * 0.32, color: "var(--ink-faint)" }}
          >
            {unit}
          </span>
        )}
      </p>
      {delta && (
        <p
          className="footnote mt-1.5"
          style={{
            color:
              delta.tone === "up"
                ? "var(--success)"
                : delta.tone === "down"
                ? "var(--danger)"
                : "var(--ink-faint)",
            fontWeight: 600,
          }}
        >
          {delta.sign} {delta.value}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Sparkline — pure SVG, accepts array of numbers
   ─────────────────────────────────────────────────────────────── */

export function Sparkline({
  data,
  width = 200,
  height = 56,
  color = "var(--accent)",
  fillTo,
  showDots = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillTo?: string;
  showDots?: boolean;
}) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height} aria-hidden>
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="var(--hairline-strong)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
      </svg>
    );
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = 4;
  const usableH = height - pad * 2;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + usableH - ((v - min) / range) * usableH;
    return [x, y] as const;
  });

  const linePath = points
    .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
    .join(" ");
  const fillPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg width={width} height={height} aria-hidden style={{ overflow: "visible" }}>
      {fillTo && (
        <>
          <defs>
            <linearGradient id={`spk-${color.replace(/\W/g, "")}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={fillTo} stopOpacity="0.35" />
              <stop offset="100%" stopColor={fillTo} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#spk-${color.replace(/\W/g, "")})`} />
        </>
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i === points.length - 1 ? 4 : 0}
          fill={color}
        />
      ))}
      {!showDots && (
        <circle cx={last[0]} cy={last[1]} r="3.5" fill={color} stroke="white" strokeWidth="2" />
      )}
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Score donut — Linear status circle, configurable fill %
   ─────────────────────────────────────────────────────────────── */

export function ScoreDonut({
  pct,
  size = 28,
  color = "var(--accent)",
  trackColor = "rgba(10,10,10,0.08)",
  thickness = 3,
  label,
}: {
  pct: number; // 0-100
  size?: number;
  color?: string;
  trackColor?: string;
  thickness?: number;
  label?: string;
}) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 480ms cubic-bezier(0.32, 0.72, 0, 1)" }}
        />
      </svg>
      {label && (
        <span
          className="absolute metric"
          style={{ fontSize: size * 0.36, color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   List row — Linear style: leading slot · title/sub · trailing slot
   ─────────────────────────────────────────────────────────────── */

export function Row({
  leading,
  title,
  sub,
  trailing,
  onClick,
  href,
  divider = true,
  meta,
}: {
  leading?: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  href?: string;
  divider?: boolean;
  meta?: ReactNode;
}) {
  const Tag: React.ElementType = href ? "a" : onClick ? "button" : "div";
  const interactive = href || onClick;
  return (
    <Tag
      href={href}
      onClick={onClick}
      className="w-full text-left flex items-center gap-3.5 py-3.5 group"
      style={{
        borderBottom: divider ? "1px solid var(--hairline)" : "none",
        background: "transparent",
        cursor: interactive ? "pointer" : "default",
      }}
    >
      {leading && (
        <span className="flex-shrink-0 transition-transform group-active:scale-95">
          {leading}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block callout font-semibold truncate">{title}</span>
        {sub && (
          <span className="block footnote mt-0.5 truncate" style={{ color: "var(--ink-muted)" }}>
            {sub}
          </span>
        )}
      </span>
      {meta && (
        <span className="flex-shrink-0 caption tabular-nums" style={{ color: "var(--ink-faint)" }}>
          {meta}
        </span>
      )}
      {trailing && <span className="flex-shrink-0">{trailing}</span>}
    </Tag>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Avatar
   ─────────────────────────────────────────────────────────────── */

export function Avatar({
  initial,
  size = 36,
  surface = "ink",
  src,
}: {
  initial: string;
  size?: number;
  surface?: "ink" | "accent" | "cream";
  src?: string | null;
}) {
  const bg =
    surface === "accent" ? "var(--accent)" :
    surface === "cream"  ? "var(--bg-elevated)" :
                           "var(--ink)";
  const fg = surface === "cream" ? "var(--ink)" : "#FFFFFF";

  if (src) {
    /* eslint-disable-next-line @next/next/no-img-element */
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-bold"
      style={{
        width: size,
        height: size,
        background: bg,
        color: fg,
        fontSize: size * 0.42,
        letterSpacing: "-0.04em",
      }}
    >
      {initial}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Badges
   ─────────────────────────────────────────────────────────────── */

type BadgeTone = "neutral" | "accent" | "ink" | "success" | "danger";

export function Badge({
  children,
  tone = "neutral",
  dot,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  const map: Record<BadgeTone, { bg: string; fg: string; dotColor: string }> = {
    neutral: { bg: "rgba(10,10,10,0.06)",    fg: "var(--ink)",        dotColor: "var(--ink-muted)" },
    accent:  { bg: "var(--accent-soft)",     fg: "var(--accent-text)",dotColor: "var(--accent)" },
    ink:     { bg: "var(--ink)",             fg: "#FFFFFF",           dotColor: "rgba(255,255,255,0.7)" },
    success: { bg: "var(--success-soft)",    fg: "var(--success)",    dotColor: "var(--success)" },
    danger:  { bg: "var(--danger-soft)",     fg: "var(--danger)",     dotColor: "var(--danger)" },
  };
  const t = map[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium whitespace-nowrap"
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: t.dotColor }}
        />
      )}
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Empty state
   ─────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {icon && (
        <div
          className="mb-5 flex items-center justify-center rounded-full"
          style={{
            width: 72,
            height: 72,
            background: "var(--bg-elevated)",
            color: "var(--ink-faint)",
          }}
        >
          {icon}
        </div>
      )}
      <h3 className="title-3">{title}</h3>
      {body && (
        <p
          className="subhead mt-2 max-w-[28ch]"
          style={{ color: "var(--ink-muted)" }}
        >
          {body}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Section header (Linear/Notion grouping)
   ─────────────────────────────────────────────────────────────── */

export function SectionHeader({
  title,
  trailing,
  count,
}: {
  title: string;
  trailing?: ReactNode;
  count?: number;
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <span className="label inline-flex items-center gap-2">
        {title}
        {typeof count === "number" && (
          <span
            className="footnote"
            style={{ color: "var(--ink-faint)", letterSpacing: 0, textTransform: "none", fontWeight: 500 }}
          >
            {count}
          </span>
        )}
      </span>
      {trailing}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Loading skeleton (match final shape, not generic spinner)
   ─────────────────────────────────────────────────────────────── */

export function Skeleton({
  w = "100%",
  h = 14,
  r = 6,
  className = "",
}: {
  w?: string | number;
  h?: number;
  r?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block animate-[shimmer_1.6s_ease-in-out_infinite] ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background:
          "linear-gradient(90deg, rgba(10,10,10,0.06) 0%, rgba(10,10,10,0.10) 50%, rgba(10,10,10,0.06) 100%)",
        backgroundSize: "200% 100%",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────
   Micro-icons (custom geometric — replaces lucide on key surfaces)
   ─────────────────────────────────────────────────────────────── */

const I = (props: { children: ReactNode; size?: number }) => (
  <svg
    viewBox="0 0 24 24"
    width={props.size ?? 16}
    height={props.size ?? 16}
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {props.children}
  </svg>
);

export const Icon = {
  ArrowRight: (p: { size?: number }) => <I size={p.size}><><path d="M5 12h14M13 6l6 6-6 6" /></></I>,
  ArrowLeft:  (p: { size?: number }) => <I size={p.size}><><path d="M19 12H5M11 6l-6 6 6 6" /></></I>,
  Plus:       (p: { size?: number }) => <I size={p.size}><><path d="M12 5v14M5 12h14" /></></I>,
  Sparkle:    (p: { size?: number }) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="currentColor">
      <path d="M12 2.5 13.9 9 20 11l-6.1 2L12 19.5 10.1 13 4 11l6.1-2z" />
    </svg>
  ),
  Trash:      (p: { size?: number }) => <I size={p.size}><><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M5 6l1 14a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-14M10 11v6M14 11v6" /></></I>,
  Check:      (p: { size?: number }) => <I size={p.size}><><path d="M5 12.5 10 17l9-10" /></></I>,
  ChevronDown:(p: { size?: number }) => <I size={p.size}><><path d="m6 9 6 6 6-6" /></></I>,
  Send:       (p: { size?: number }) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 16} height={p.size ?? 16} fill="currentColor">
      <path d="M2.8 21 22 12 2.8 3 2.9 10.5 16 12 2.9 13.5z" />
    </svg>
  ),
  Retry:      (p: { size?: number }) => <I size={p.size}><><path d="M4 12a8 8 0 1 0 2.8-6.1M3 4v5h5" /></></I>,
  Download:   (p: { size?: number }) => <I size={p.size}><><path d="M12 3v13M6 11l6 6 6-6M5 20h14" /></></I>,
};
