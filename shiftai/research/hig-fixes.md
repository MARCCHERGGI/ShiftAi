# HIG Fixes — Shift AI polish pass (single source of truth)

Audited against Apple HIG (Layout, Typography, Navigation bars, Tab bars, Segmented controls, Buttons, Empty states) + the rendered desktop screenshots (`shot-prep.png`, `shot-jobs.png`) + every file in `src/components/ios/`, `src/app/globals.css`, `layout.tsx`, and all five pages.

Conventions used below: all values are px (1pt = 1px @1x web). iOS system colors referenced by existing tokens in `globals.css` (`--ios-blue: #007AFF`, `--ios-gray: #8E8E93`, etc.). Every fix says WHICH file and WHAT exact change.

---

## 1. App column — the #1 structural fix (globals.css + TabBar clamp)

**Problem (both screenshots):** content stretches edge-to-edge to 1366px. The large title sits in a phantom 680px centered box (`.navbar__title-large` has `max-width: 680px; margin-inline: auto`) while sections below are full-width — which is why the title *reads* as centered/floating. Controls (segmented control, text field, filled button) at 1334px wide are grotesque vs. iOS.

**Fix — single app column, 430px (iPhone Pro Max width), edge-to-edge under 520px:**

1.1 `src/app/globals.css` — add after the PAGE FRAME section:

```css
:root {
  --app-w: 430px; /* column width on desktop */
}

/* Desktop: app canvas floats on a slightly darker page bg */
@media (min-width: 520px) {
  body {
    background: #e2e2e7; /* distinct page bg so the column reads as an app canvas */
  }
  main {
    max-width: var(--app-w);
    margin: 0 auto;
    background: var(--bg-grouped); /* #F2F2F7 */
    min-height: 100dvh;
    box-shadow: 0 0 0 0.5px var(--separator-opaque), 0 0 40px rgba(0, 0, 0, 0.06);
  }
  /* tab bar lives OUTSIDE main (layout.tsx) — clamp it to the same column */
  .tabbar {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: var(--app-w);
    border-left: 0.5px solid var(--separator-opaque);
    border-right: 0.5px solid var(--separator-opaque);
  }
}
```

1.2 Below 520px: no change — everything stays edge-to-edge (mobile is already correct-width).

1.3 `.navbar__title-large` (globals.css line ~340): DELETE `max-width: 680px; width: 100%; margin-inline: auto;` — the column now constrains it; the title must sit at the 16px leading margin of the column.

1.4 `.tabbar__inner` (globals.css line ~368): change `max-width: 680px` → `max-width: var(--app-w)`.

1.5 `.ios-page` (globals.css line ~270): change `max-width: 680px` → delete the max-width (column handles it). Note: no page currently uses `.ios-page` — builders should either use it or delete it; do not leave two competing width systems.

1.6 `body` keeps `background: var(--bg-grouped)` as the base rule (mobile), and `theme-color` stays `#F2F2F7` (see §10).

---

## 2. Large title — alignment + collapse behavior (NavBar.tsx + globals.css)

**Problem:** title appears centered (see §1 root cause); large NavBar has no collapse-to-inline behavior; the `right` accessory in large mode is absolutely positioned at `bottom: 4px` of an 18px-tall bar, so the 44px refresh button on Jobs overflows upward and renders clipped at the top edge of the viewport (visible in `shot-jobs.png`, top-right blue sliver).

**iOS spec:** large title = 34px / 700 / -0.4px tracking / 41px line-height, LEFT-aligned at the 16px leading margin. On scroll, the large title scrolls away and a 44px inline bar (17px / 600 centered title, translucent blur, hairline bottom border) fades in.

2.1 `src/components/ios/NavBar.tsx` — rewrite the `large` branch to render BOTH bars:

```tsx
// structure (large mode):
<header className="navbar navbar--large-wrap">
  {/* sticky 44px inline bar — always in the tree, title hidden until collapsed */}
  <div className={collapsed ? "navbar__inlinebar navbar__inlinebar--visible" : "navbar__inlinebar"}>
    <div className="navbar__title-inline">{title}</div>
    {right ? <div className="navbar__right">{right}</div> : null}
  </div>
  {/* sentinel + large title scroll away in normal flow */}
  <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
  <h1 className="navbar__title-large">{title}</h1>
</header>
```

Collapse detection: `IntersectionObserver` on the 1px sentinel with `rootMargin: "-44px 0px 0px 0px"` — when the sentinel leaves the viewport top, set `collapsed = true`. No scroll listeners.

2.2 `src/app/globals.css` — replace `.navbar--large .navbar__bar` block with:

```css
.navbar__inlinebar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  min-height: 44px;
  padding: env(safe-area-inset-top, 0px) 16px 0;
  background: transparent;
  border-bottom: 0.5px solid transparent;
  transition: background var(--dur-2) var(--ease-spring);
}
.navbar__inlinebar .navbar__title-inline {
  opacity: 0;
  transition: opacity var(--dur-2) var(--ease-spring);
}
.navbar__inlinebar--visible {
  background: var(--navbar-bg);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  backdrop-filter: blur(20px) saturate(180%);
  border-bottom-color: var(--separator);
}
.navbar__inlinebar--visible .navbar__title-inline {
  opacity: 1;
}
```

CAUTION: `position: sticky` only works if the sticky element's scroll container is the page — the inline bar must be a direct child of `header` which is a direct child of `main` (it is, in all five pages). Keep it that way.

2.3 `.navbar__title-large` final form (after 1.3):

```css
.navbar__title-large {
  font-size: 34px;
  font-weight: 700;
  letter-spacing: -0.4px;
  line-height: 41px;
  margin: 0;
  padding: 2px 16px 8px; /* left-aligned at the 16px leading margin */
}
```

2.4 The `right` accessory in large mode now lives inside `.navbar__inlinebar` (44px tall → the 44×44 refresh button fits; no more clipping). `.navbar--large .navbar__right { bottom: 4px }` rule: DELETE.

2.5 `src/app/jobs/page.tsx` — no change to the `right` prop API; the refresh button (already 44×44, correct) just moves with the NavBar rewrite. Keep icon 19px `RefreshCw`.

---

## 3. Buttons — disabled/pressed/loading states (globals.css + PillButton.tsx)

**Problem (shot-prep.png):** the disabled filled button renders as a washed light-blue slab with a visible lighter band — caused by `.pill-btn:disabled { opacity: 0.4 }` applying whole-node opacity over the blue fill (compositing seam with the box-shadow + subpixel band under the label). iOS never dims a filled button with whole-button opacity; disabled filled buttons use a **gray fill + tertiary label**.

3.1 `src/app/globals.css` — replace the `.pill-btn:disabled` block:

```css
/* DELETE:  .pill-btn:disabled { opacity: 0.4; cursor: default; } */

.pill-btn:disabled { cursor: default; }

.pill-btn--filled:disabled:not(.pill-btn--loading) {
  background: rgba(118, 118, 128, 0.12); /* quaternarySystemFill */
  color: rgba(60, 60, 67, 0.3);          /* tertiaryLabel */
}
.pill-btn--tinted:disabled:not(.pill-btn--loading) {
  background: rgba(118, 118, 128, 0.12);
  color: rgba(60, 60, 67, 0.3);
}
.pill-btn--plain:disabled:not(.pill-btn--loading) {
  color: rgba(60, 60, 67, 0.3);
}
```

3.2 **Loading keeps full tint.** `PillButton` sets the `disabled` attribute when `loading` — the `:not(.pill-btn--loading)` guard above ensures a loading filled button stays `#007AFF` with the white spinner (iOS behavior: an in-flight action button doesn't gray out).

3.3 Spinner-in-loading tint (already correct): white spinner on filled, blue on tinted/plain — keep.

3.4 Press states (already correct): filled → `#0062CC` bg + `scale(0.97)`; keep. Add the missing tinted press state:

```css
.pill-btn--tinted:active:not(:disabled) { background: rgba(0, 122, 255, 0.24); }
.pill-btn--plain:active:not(:disabled) { opacity: 0.4; } /* iOS plain buttons dim the label on press */
```

3.5 Metrics (already correct, do not churn): 50px min-height, radius 14, 17px/600 label — matches UIButton `.large` + `.filled`.

3.6 Icon spacing bug — every call site passes icons with `style={{ marginRight: 6, verticalAlign: -3 }}` while `.pill-btn` is flex with `gap: 8px` → actual gap is 14px. Fix at call sites (`page.tsx` lines ~300-305, `jobs/page.tsx` ~300, `resume/page.tsx` ~132/154, `interview/page.tsx` ~212/401, `profile/page.tsx` ~249): DELETE the `marginRight`/`verticalAlign` inline styles; flex alignment + `gap: 8px` handles it. (Optionally reduce `.pill-btn` gap to 6px — iOS icon-label spacing is ~6.)

---

## 4. Segmented control (globals.css — verify only, mostly compliant)

Measured iOS 13+ metrics: height 32, track padding 2, track radius ≈8.91→9, thumb radius ≈6.93→7, label 13px (unselected medium 500, selected semibold 600), thumb shadow `0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)`.

**Current `.seg` block already matches all of these** (32px / 2px / 9px / 7px / 13px 500→600 / correct thumb shadow / press-dim 0.55 on unselected). If the polish brief's "7px outer / 5px inner" is preferred, change `.seg { border-radius: 9px }` → `7px` and `.seg__thumb { border-radius: 7px }` → `5px` — but 9/7 is the closer match to UISegmentedControl; **recommendation: leave as-is.**

4.1 One real fix: the control currently spans the full 1334px (fixed by §1). Inside the 430px column, full-width is correct for a 2-option mode switch. No code change.

4.2 A11y fix, `src/components/ios/SegmentedControl.tsx`: `role="tablist"`/`role="tab"` is wrong semantics for a value picker (it controls no tabpanel). Use `role="radiogroup"` + `role="radio"` / `aria-checked`. Two-line change.

---

## 5. Text fields (globals.css + Profile flattening)

5.1 Standalone field metric: `.textfield__input` padding `12px 14px` + 22px line-height = 46px. iOS field height is 44. Change padding to `11px 16px` (44px total, and 16px horizontal padding matches list-row leading).

5.2 Focus ring (keep): web needs a visible focus state; the current `0 0 0 3.5px rgba(0,122,255,0.25)` ring is right. Do not remove for "iOS purity."

5.3 **Profile page double-carding (real defect):** `profile/page.tsx` renders `TextField`s directly inside `InsetGroup` — each field paints its own white card + hairline shadow *inside* the white inset card → white-on-white with floating shadows, not an iOS grouped form. Fix in `globals.css` (no component API change):

```css
/* fields nested in an inset group become flat rows */
.inset-group__card .textfield { gap: 2px; padding: 8px 16px; }
.inset-group__card .textfield + .textfield { position: relative; }
.inset-group__card .textfield + .textfield::before {
  content: "";
  position: absolute;
  top: 0; left: 16px; right: 0;
  height: 0.5px;
  background: var(--separator);
}
.inset-group__card .textfield__label { padding-left: 0; font-size: 12px; }
.inset-group__card .textfield__input {
  box-shadow: none;
  border-radius: 0;
  background: transparent;
  padding: 0 0 4px;
}
.inset-group__card .textfield__input:focus { box-shadow: none; }
/* focused row indicator instead */
.inset-group__card .textfield:focus-within .textfield__label { color: var(--ios-blue); }
```

5.4 **Profile work-history nesting (real defect):** `Card` (white) is nested inside `.inset-group__card` (white) with 12px gaps — invisible card edges. Fix in `profile/page.tsx`: move the work-history block OUT of `InsetGroup`. Render header text with the same `.inset-group__header` class, then the job `Card`s directly in the section (white on `#F2F2F7` — visible again), then the "Add a job" tinted button. Keep the footer line as `.inset-group__footer`.

5.5 `TextField` label `text-transform: uppercase` inside forms: iOS grouped forms use sentence-case 13px labels; uppercase is for SECTION headers only. In §5.3 the nested label drops to 12px — also remove `text-transform: uppercase` from `.textfield__label` (keep it on `.inset-group__header`).

---

## 6. Tab bar (globals.css + TabBar.tsx — minor fixes only)

Already correct: fixed bottom, 49px + `env(safe-area-inset-bottom)`, translucent `rgba(249,249,249,0.82)` + `blur(20px) saturate(180%)`, 0.5px hairline top border, 10px/500 labels, active `#007AFF`, 5 tabs, `aria-current`.

6.1 Inactive color: `.tabbar__item { color: #999999 }` → `color: var(--ios-gray)` (`#8E8E93`, systemGray — the exact iOS inactive tab tint).

6.2 Icon weight: `strokeWidth={active ? 2.2 : 1.8}` makes icons visually jump on selection (iOS changes color/fill, never stroke weight). `src/components/ios/TabBar.tsx` line 46: use constant `strokeWidth={2}` (lucide at 24px/2 ≈ SF Symbols medium). Keep size 24.

6.3 `.tabbar__inner` max-width → `var(--app-w)` (§1.4).

6.4 `.tabbar__item:active { transform: scale(0.92) }` — iOS tab items do not scale on press; they have no press effect beyond the tap. DELETE the transform (keep for taste if Marco likes it — flag: non-HIG).

---

## 7. Empty states — icon + title + description + action (Jobs, Prep, Resume)

**HIG pattern:** centered composition — SF-style icon (48-64px, tertiary gray), title (20px/600), description (15px secondary, ≤2 lines, centered, max-width ~280px), optional action button. Vertically placed in the upper-middle of the free area.

7.1 Add once to `globals.css`:

```css
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 56px 32px 24px;
}
.empty__icon { color: var(--ios-gray3); margin-bottom: 16px; }
.empty__title { font-size: 20px; font-weight: 600; letter-spacing: -0.45px; margin: 0; color: var(--label); }
.empty__desc { font-size: 15px; line-height: 20px; letter-spacing: -0.23px; margin: 6px 0 0; color: var(--label-2); max-width: 280px; }
.empty__action { margin-top: 16px; }
```

7.2 `src/app/jobs/page.tsx` (lines ~138-147) — replace the plain-text card:

```tsx
<div className="empty">
  <Martini size={56} strokeWidth={1.5} className="empty__icon" />
  <h3 className="empty__title">No verified listings right now</h3>
  <p className="empty__desc">
    Craigslist re-scrapes hourly. Every listing that passes the scam filter shows up here.
  </p>
  <div className="empty__action">
    <PillButton onPress={() => void load()} variant="tinted">Refresh now</PillButton>
  </div>
</div>
```

(import `Martini` from lucide-react; drop the bare `Card`.)

7.3 `src/app/page.tsx` — **the vast undesigned Prep void** (shot-prep.png: ~470px of blank #F2F2F7 below the button). When `!running && !result && !error`, render a "How it works" inset group under the form (fills the space with structure, teaches the product):

```tsx
<section style={{ paddingTop: 35 }}>
  <InsetGroup header="How it works" footer="Six agents, ~40 seconds. Your walk-in play saves on this phone.">
    <Row icon={<Link2 size={17} color="#007AFF" />} label="Paste any bartender job link" />
    <Row icon={<Search size={17} color="#FF9500" />} label="The crew researches the venue live" />
    <Row icon={<FileText size={17} color="#AF52DE" />} label="Walk in with a plan, resume, and answers" />
  </InsetGroup>
</section>
```

Use the CrewProgress-style colored icon squares (29×29, radius 7) if the builder wants full Settings-style rows — both compliant.

7.4 `src/app/resume/page.tsx` (lines ~160-170) — the "your resume shows up here" placeholder card → same `.empty` pattern: `FileText` 56/1.5 icon, title "No resume yet", desc "Generate builds a one-page, ATS-friendly resume from your profile — tailored to the venue when you've run a prep."

7.5 `src/app/interview/page.tsx` idle card is a call-to-action card with icon+title+desc+button — already effectively the HIG pattern in card form; compliant, don't churn.

---

## 8. Spacing rhythm (all pages — normalize to one scale)

Target rhythm: **16px screen margins · 35px between sections · 8px intra-card element gap · 7px header-to-card · 6px card-to-footer**.

8.1 Current section paddings are ad-hoc per page (`paddingTop: 16`, `8`, `14`, `18`, `12`…). Normalize: every `<section>` after the first gets `paddingTop: 35` when it starts a new logical group (e.g., Prep: form → results; Jobs: meta → list; Resume: button → preview), and `paddingTop: 16` when it continues the same group. Concretely:
- `page.tsx`: MenuGroup/PeopleGroup/ReviewsGroup sections currently `paddingTop: 16/8/8` → all `35` (they are separate inset-group sections; iOS grouped-table section gap is 35).
- `resume/page.tsx`: preview section `16` → `35`; Download button section stays `14→16`.
- `interview/page.tsx`: FinalReport `18` → `35`.
- `profile/page.tsx`: `InsetGroup`s stack with no gap at all right now — wrap the groups in a container `style={{ display: "flex", flexDirection: "column", gap: 35, padding: "0 16px" }}` (NOTE: InsetGroups on Profile currently render full-bleed — they're NOT wrapped in a padded section at all, so cards touch the viewport edge on mobile; this wrapper fixes both).
- Optionally: add `.stack-sections { display:flex; flex-direction:column; gap:35px; }` to globals.css and use it everywhere instead of per-section padding.

8.2 Double bottom padding: `body` already reserves `calc(49px + safe-area + 24px)` for the tab bar AND every page's `<main>` adds `paddingBottom: 96` → ~169px dead space. DELETE the inline `paddingBottom: 96/110` from all five pages; keep the body rule. (Profile keeps +14 extra via its last section if needed for the toast.)

8.3 Intra-card: `card--padded` is 16px — correct. Inside cards, keep vertical gaps at 8px (current mix of 6/8/10 is close; only change while touching a file anyway).

---

## 9. Install coach mark (new — nothing exists today)

There is no A2HS affordance anywhere (grep confirms). iOS Safari cannot `beforeinstallprompt`, so the coach mark is the ONLY install path on iOS.

9.1 New file `src/components/ios/InstallCoach.tsx` (`"use client"`):
- Show conditions (all must hold): `!window.matchMedia("(display-mode: standalone)").matches` && `!("standalone" in navigator && (navigator as any).standalone)` && iOS Safari UA (`/iPhone|iPad/.test(ua)`) && `localStorage.getItem("shiftai.installCoachDismissed") !== "1"`.
- Trigger: after first `crew_complete` (listen to a custom event or check `LS_ANALYSIS` on mount) OR 25s after first mount — whichever comes first. Never on first paint.
- **Placement:** fixed, centered in the app column, anchored ABOVE the tab bar: `position: fixed; left: 50%; transform: translateX(-50%); bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px); width: min(calc(100% - 32px), calc(var(--app-w) - 32px)); z-index: 60;` — a white card (radius 14, `--shadow-float`), 12px padding, with: share-icon glyph (`Share` from lucide, 20px, #007AFF), 13px/400 text "Add Shift AI to your Home Screen: tap ⬆︎ Share, then 'Add to Home Screen'", and a 28×28 X dismiss button (44px hit area via padding).
- Dismiss → `localStorage.setItem("shiftai.installCoachDismissed", "1")`, animate out with `ios-fade-out`.
- On Android/desktop Chrome: listen for `beforeinstallprompt`, `preventDefault()`, show the same card with a "Install" tinted button that calls `prompt()`.
- Fire `trackEvent("install_coach_shown")` / `("install_coach_dismissed")` / `("install_accepted")`.

9.2 `src/app/layout.tsx`: render `<InstallCoach />` after `<TabBar />`.

---

## 10. Status bar / theme color (layout.tsx — one addition)

Compliant today: `themeColor: "#F2F2F7"`, `viewport-fit=cover`, `apple-mobile-web-app-capable` via `appleWebApp.capable`, `statusBarStyle: "default"` (correct for a light `#F2F2F7` app — black status text), manifest `background_color`/`theme_color` both `#F2F2F7`, maskable + any icons present.

10.1 Add to `viewport` export: nothing — but NOTE: `userScalable: false, maximumScale: 1` is an accessibility tradeoff (blocks pinch-zoom). It matches native-app behavior and prevents input-focus auto-zoom; **keep**, since all body text is ≥15px. (Alternative if Lighthouse a11y matters: `maximumScale: 5` + set every input font-size ≥16px to suppress iOS zoom — inputs are already 17px, so this swap is safe. Recommended but optional.)

10.2 With §1's desktop canvas, do NOT change themeColor — it only affects mobile/standalone chrome where the canvas is still `#F2F2F7`.

---

## 11. Real defects found beyond the brief

11.1 **Broken spinner animation on Jobs (visible bug):** `jobs/page.tsx` lines 200 and 343 use `style={{ animation: "spin 1s linear infinite" }}` but NO `@keyframes spin` exists in any loaded stylesheet (only `ios-spin`, `jobs-spin`, `sa-spin`). The `Loader2` icons render frozen. Fix: change both to `animation: "ios-spin 1s linear infinite"` (or swap the elements to `className="jobs-spin"`).

11.2 **Interview chat bubbles:** 16px font → **17px** (iOS Messages body is 17px). `interview/page.tsx` `bubbleBase.fontSize: 16 → 17`. Bubble radius 18 + tail-corner 6, 82% max-width, `#E9E9EB` received / `#007AFF` sent — all correct, keep.

11.3 **Interview answer field placement:** the composer (TextField + Send) scrolls with content. Acceptable for v1; if polishing further, pin it: `position: sticky; bottom: calc(var(--tabbar-h) + env(safe-area-inset-bottom) + 8px)` with a `--bg-grouped` background and top hairline. Optional — not a violation.

11.4 **`main` element semantics:** all five pages correctly use one `<main>`; keep, since §1 styles the `main` selector directly.

11.5 **Legacy dead CSS:** `walkin.css` + `listings.css` are still imported in `layout.tsx` but the ported screens now use ios components + inline styles; the legacy-compat classes in `globals.css` (`.jobs-shell`, `.jobs-header`, `.jobs-feed`, `.cgpt-sheet*`…) are largely unreferenced (the Stripe upsell sheet was NOT ported to `jobs/page.tsx` — it's gone entirely; confirm intent with the war plan before deleting the CSS). Do not delete in this pass; just don't build on them.

11.6 **Prep restored-state caption** (`Your last prep, saved …`) is `textAlign: center` — with the left-aligned title system, make it left-aligned, `margin: "16px 20px 0"`, 13px footnote gray. Minor.

11.7 **`ScorePill` amber `#B8860B` on `rgba(255,204,0,0.18)`** — passes contrast, fine; but iOS semantic would be `#FF9500` (systemOrange) darkened to `#C93400`-ish for text. Optional.

11.8 **Row press state** uses `--ios-gray5` (`#E5E5EA`) — iOS row highlight is `#D1D1D6` (systemGray4). Change `.row--press:active { background: var(--ios-gray4); }`. One line.

11.9 **InsetGroup on Profile has no horizontal padding** — covered by §8.1's wrapper; without it, inset cards are flush to the screen edge (violates the 16px margin rule on mobile).

11.10 **`.navbar__bar` in large mode** becomes unused after §2 — delete the `min-height: 0; padding-top: 18px; justify-content: flex-end` rules with the rewrite.

---

## 12. Already compliant — DO NOT churn

- **Type scale** (`.ios-large-title` 34/700/-0.4/41, title1-3, headline/body 17/-0.43/22, subhead 15, footnote 13, caption 12) — exact HIG values, including tracking. Leave every token alone.
- **Color tokens**: full iOS system palette, semantic labels (`rgba(60,60,67,…)` secondary/tertiary/quaternary), separators (0.29 hairline / `#C6C6C8` opaque), fills — all exact.
- **Tab bar structure**: 49px + safe-area, translucency recipe, hairline, 10px/500 labels, 5 tabs, active tint, `aria-current`, tracking events.
- **Segmented control metrics**: 32px / 2px padding / 9px track / 7px thumb radius / 13px 500→600 / exact iOS thumb shadow / press dim. (See §4 — only the ARIA roles change.)
- **Card system**: white, radius 18 (PLAN allows 16-20), 0.5px hairline shadow instead of drop shadows — correct iOS depth model.
- **Inset groups + rows**: 13px uppercase headers with 7px gap, 13px footers, 44px min rows, 17px labels, left-inset 16px hairline separators between rows, gray values, `#C7C7CC` chevrons — textbook grouped table view.
- **Filled/tinted/plain button anatomy**: 50px, radius 14, 17/600, press scale + darken; tinted `rgba(0,122,255,0.15)` fill.
- **Crew progress rows**: 29×29 radius-7 colored icon squares = iOS Settings icon spec; spinner/check/error states with pop animation; desaturated idle.
- **ScoreRing**: rounded-cap ring, semantic green/orange/red at 70/40 thresholds, tabular numerals, `role="meter"` + aria values, ease-out count-up.
- **Sheet**: grabber 36×5, radius 20 top corners, `#F2F2F7` panel, backdrop 0.4, spring up/down animations, body scroll lock, Escape dismiss.
- **Motion system**: `cubic-bezier(0.32,0.72,0,1)` spring, 160/320/500ms tiers, `prefers-reduced-motion` kill switch.
- **PWA shell**: manifest (standalone, portrait, id/scope/start_url, 192/512/maskable), SW registration (prod-only, after load), apple-touch-icon, OG/Twitter meta.
- **Chat bubbles**: iMessage geometry + colors (only the 16→17px font fix in §11.2).
- **Saved toast on Profile**: bottom-anchored above tab bar, blur pill, `aria-live="polite"` — HIG-consistent feedback.
- **Focus rings on fields** — keep for keyboard a11y.
- **Interview idle card, FirstLoad skeleton on Jobs, error cards with recovery guidance ("switch to Paste text")** — good HIG "recovery suggestion" patterns, keep the copy.

---

## Suggested execution order for the builder

1. §1 app column (transforms every screenshot instantly)
2. §2 NavBar rewrite (title left + collapse + unclips Jobs refresh)
3. §3 button states (kills the washed band)
4. §8 spacing normalize + §8.2 double padding
5. §7 empty states (Jobs, Prep void, Resume)
6. §5 Profile form flattening (biggest remaining screen-level defect)
7. §6 tab bar minors, §11 defect list (11.1 spinner fix is 30 seconds — do it first, actually)
8. §9 InstallCoach (new component, isolated)
9. §10 optional a11y zoom swap

Verify after: re-shoot both screenshots at 1366×768 AND 390×844; check column, left title, collapse on scroll, disabled button gray, Jobs empty state composition, spinning refresh loader.
