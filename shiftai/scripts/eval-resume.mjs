/**
 * Resume engine eval — builds resumes for 3 synthetic profile × venue-type
 * pairs, judge-scores each, prints the scores. Pass bar: every case >= 8.
 *
 * Run: npx tsx scripts/eval-resume.mjs
 * (tsx resolves the "@/*" tsconfig alias, so build.ts/judge.ts import as-is.)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env.local the way Next.js would (process env wins over file).
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const [, key, rawVal] = m;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawVal.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
} catch {
  /* no .env.local — rely on ambient env */
}

const { buildResume, detectVenueType } = await import("../src/lib/resume/build.ts");
const { judgeResume } = await import("../src/lib/resume/judge.ts");

/* ── synthetic AnalyzeResult factory ─────────────── */

function makeAnalysis({ title, venueName, kind, vibe, neighborhood, priceLevel, requirements, spiritsFocus, cocktails, serviceNotes }) {
  return {
    job: {
      url: null,
      source: "pasted text",
      title,
      role: "bartender",
      venueName,
      venueAddress: null,
      neighborhood,
      pay: "$11.35/hour plus tips",
      schedule: "Full time, nights/weekends/holidays",
      requirements,
      perks: [],
      redFlags: [],
      rawText: `${title} at ${venueName}. ${requirements.join(". ")}.`,
    },
    venue: {
      name: venueName,
      confidence: "high",
      kind,
      vibe,
      address: null,
      neighborhood,
      hospitalityGroup: null,
      priceLevel,
      links: [],
      summary: `${venueName} is a ${kind} in ${neighborhood}. ${vibe}`,
    },
    menu: {
      summary: `${spiritsFocus} program.`,
      signatureItems: [],
      cocktails,
      spiritsFocus,
      beerWine: null,
      talkingPoints: [],
    },
    people: null,
    reviews: {
      summary: "Strong service reputation.",
      rating: "4.5 on Google",
      praise: ["attentive bartenders"],
      complaints: [],
      serviceNotes,
      talkingPoints: [],
    },
    synthesis: {
      brief: "Solid fit.",
      fitScore: 80,
      walkInPlan: [],
      talkingPoints: [],
      questionsToAsk: [],
      redFlags: [],
    },
    analyzedAt: new Date().toISOString(),
  };
}

/* ── 3 synthetic cases ───────────────────────────── */

const CASES = [
  {
    label: "Craft cocktail bar (aperitif-forward)",
    profile: {
      name: "Maya Reyes",
      email: "maya.reyes@gmail.com",
      phone: "(917) 555-0142",
      neighborhood: "East Village, Manhattan",
      role: "Bartender",
      yearsExperience: "6",
      workHistory: [
        {
          place: "Velvet Hour",
          role: "Head Bartender",
          time: "2022 – present",
          highlights:
            "60-seat craft cocktail bar in the East Village; run a 14-cocktail seasonal menu, serve 180-220 covers per Friday/Saturday shift; batch house cocktails for service; hold pour-cost variance under 3% with measured pours; trained 4 new bartenders on specs; contributed 5 drinks to the seasonal list",
        },
        {
          place: "Little Fern",
          role: "Bartender",
          time: "2019 – 2022",
          highlights:
            "Aperitivo-focused 40-seat bar; classics-heavy menu, dealer's choice orders every night; Toast POS; full bar mise en place, open and close solo on weeknights",
        },
      ],
      skills: [
        "Classic cocktails",
        "Batching",
        "Dealer's choice",
        "Toast POS",
        "Mise en place",
        "Amari & aperitifs",
        "Wine & sherry service",
      ],
      certs: ["TIPS", "NYC Food Handler's Certificate"],
      signatureDrinks: ["White Negroni riff with Salers", "Sherry cobbler"],
      languages: ["English", "Spanish"],
      summary:
        "Six years behind craft cocktail bars in Manhattan. Spec-disciplined, warm host, deep amaro and aperitif knowledge.",
    },
    analysis: makeAnalysis({
      title: "Bartender",
      venueName: "Sirena",
      kind: "craft cocktail bar",
      vibe: "Refined but approachable Mediterranean aperitif bar with a high-touch, guest-forward room.",
      neighborhood: "West Village",
      priceLevel: "$$$",
      requirements: [
        "2+ years bartending in a quality-driven restaurant or bar",
        "Strong fundamentals and attention to detail",
        "Knowledge of classic cocktails, wine, beer, and spirits",
        "Execute drinks with consistency, speed, and care",
        "NYC Food Handler Certificate or willingness to obtain",
      ],
      spiritsFocus: "aperitif-forward, Mediterranean",
      cocktails: ["Sirena Spritz", "Fino Martini", "Amalfi Sour"],
      serviceNotes: ["bartenders guide guests through the list", "high-touch service praised"],
    }),
  },
  {
    label: "High-volume rooftop",
    profile: {
      name: "Dre Thompson",
      email: "dre.thompson@outlook.com",
      phone: "(646) 555-0177",
      neighborhood: "Harlem, Manhattan",
      role: "Bartender",
      yearsExperience: "5",
      workHistory: [
        {
          place: "Skyline 47",
          role: "Bartender",
          time: "2021 – present",
          highlights:
            "450-capacity Midtown rooftop; serve 300+ guests per shift at a 110-drink-per-hour peak rate; ring $4K in personal sales on weekend nights; prep and batch for 600-cover event nights; Aloha POS with clean end-of-shift cash-outs; alcohol-awareness trained, zero incidents in 4 years",
        },
        {
          place: "The Garrison Sports Bar",
          role: "Bartender / Barback",
          time: "2019 – 2021",
          highlights:
            "High-volume sports bar, 24 taps; game-day rushes of 200+ guests; restocked and rotated product; upsold premium pours",
        },
      ],
      skills: [
        "High-volume service",
        "Speed & accuracy",
        "Aloha POS",
        "Batching & event prep",
        "Cash handling",
        "Crowd awareness & de-escalation",
        "Draft systems",
      ],
      certs: ["TIPS", "ATAP Alcohol Training Awareness Program"],
      signatureDrinks: ["Espresso martini at volume", "Batched Paloma"],
      languages: ["English"],
      summary:
        "Five years in high-volume NYC rooms. Built for peak service: speed with accuracy, clean rings, calm under a packed rail.",
    },
    analysis: makeAnalysis({
      title: "Bartender — Rooftop",
      venueName: "Vantage Rooftop",
      kind: "high-volume rooftop lounge",
      vibe: "Fast paced, high volume, high energy rooftop with an upscale after-work and weekend crowd.",
      neighborhood: "Midtown West",
      priceLevel: "$$$",
      requirements: [
        "3+ years in a high-volume, fast-paced NYC bar",
        "Speed, accuracy, and flair during peak hours",
        "Accurately handle cash, POS transactions, and tabs",
        "Portion control and product identification",
        "Recognize and acknowledge when guests are becoming intoxicated",
      ],
      spiritsFocus: "vodka and tequila-forward, batched cocktail program",
      cocktails: ["Frozen Spicy Marg", "Rooftop Spritz"],
      serviceNotes: ["fast service even when slammed", "bartenders keep the line moving"],
    }),
  },
  {
    label: "Hotel bar (union-caliber house)",
    profile: {
      name: "Sofia Marin",
      email: "sofia.marin@gmail.com",
      phone: "(212) 555-0189",
      neighborhood: "Astoria, Queens",
      role: "Bartender",
      yearsExperience: "8",
      workHistory: [
        {
          place: "The Wexley Hotel — Lobby Bar",
          role: "Bartender",
          time: "2020 – present",
          highlights:
            "70-seat lobby bar plus 120-cover dinner service; standard recipes and SOP-driven service; MICROS POS with room-charge, cash, and credit handling; card every guest appearing under 30 per house policy, zero compliance incidents in 5 years; serve international guests from breakfast service through late night, including holidays",
        },
        {
          place: "Brasserie Colette",
          role: "Bartender",
          time: "2017 – 2020",
          highlights:
            "French fine-dining brasserie; service bar pouring from printed tickets for a 90-seat dining room; 120-bottle wine list, guided pairings and digestifs; full bar mise en place daily",
        },
      ],
      skills: [
        "Classic cocktails",
        "Standard operating procedures",
        "MICROS POS",
        "Wine service",
        "Room-charge & cash handling",
        "Responsible alcohol service",
        "Service bar",
      ],
      certs: ["TIPS", "NYC Food Protection Certificate"],
      signatureDrinks: ["French 75", "Classic Martini service"],
      languages: ["English", "Greek"],
      summary:
        "Eight years across hotel and fine-dining bars. SOP-disciplined, compliance-clean, steady through breakfast-to-late-night hotel service.",
    },
    analysis: makeAnalysis({
      title: "Bartender — Hotel Bar",
      venueName: "Café Delano at The Delano Hotel",
      kind: "hotel lobby bar and café",
      vibe: "Storied boutique hotel bar serving guests, regulars, and tourists from morning espresso to late-night cocktails.",
      neighborhood: "Chelsea",
      priceLevel: "$$$",
      requirements: [
        "2+ years bartending in fine dining restaurants, cocktail bars, hotels, or equivalent",
        "TIPS Certification required",
        "Classic cocktail knowledge",
        "Checks identification of all customers who appear under 30",
        "Lift, carry, push, or pull up to 50 lbs",
      ],
      spiritsFocus: "classic cocktails, champagne service",
      cocktails: ["Delano Martini", "Chelsea 75"],
      serviceNotes: ["consistent drinks no matter who is behind the bar", "impeccable, warm service"],
    }),
  },
];

/* ── run ─────────────────────────────────────────── */

const PASS_BAR = 8;
const results = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Retry a call when every provider was rate-limited; honor the longest suggested wait. */
async function withRetry(label, fn, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = String(err?.message ?? err);
      const rateLimited = /429|rate.?limit/i.test(msg);
      if (!rateLimited || i >= attempts) throw err;
      const waits = [...msg.matchAll(/try again in (\d+(?:\.\d+)?)s/gi)].map((m) => Number(m[1]));
      const waitS = Math.min(Math.max(waits.length ? Math.max(...waits) : 60, 10) + 5, 120);
      console.log(`  ${label}: rate-limited, retrying in ${waitS.toFixed(0)}s (attempt ${i + 1}/${attempts})`);
      await sleep(waitS * 1000);
    }
  }
}

for (const c of CASES) {
  const t0 = Date.now();
  process.stdout.write(`\n=== ${c.label} — ${c.profile.name} → ${c.analysis.venue.name} ===\n`);
  const venueType = detectVenueType(c.analysis);
  process.stdout.write(`detected venue type: ${venueType}\n`);
  try {
    const resume = await withRetry("build", () => buildResume(c.profile, c.analysis));
    const judged = await withRetry("judge", () => judgeResume(resume, c.profile, c.analysis));
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`headline: ${resume.headline}`);
    console.log(`summary:  ${resume.summary}`);
    for (const exp of resume.experience) {
      console.log(`  ${exp.place} · ${exp.role} (${exp.time})`);
      for (const b of exp.bullets) console.log(`    • ${b}`);
    }
    console.log(`skills: ${resume.skills.join(", ")}`);
    console.log(`certs:  ${resume.certs.join(", ")}`);
    console.log(
      `SCORE ${judged.score}/10  [relevance ${judged.breakdown.relevance} · quant ${judged.breakdown.quantification} · venueFit ${judged.breakdown.venueFit} · ats ${judged.breakdown.atsSafety} · honesty ${judged.breakdown.honesty}]  (${secs}s)`,
    );
    if (judged.fixes.length) {
      console.log("fixes:");
      for (const f of judged.fixes) console.log(`  - ${f}`);
    }
    results.push({ label: c.label, score: judged.score, breakdown: judged.breakdown });
  } catch (err) {
    console.error(`CASE FAILED: ${err?.message ?? err}`);
    results.push({ label: c.label, score: 0, breakdown: null });
  }
}

console.log("\n───────── EVAL SUMMARY ─────────");
let allPass = true;
for (const r of results) {
  const mark = r.score >= PASS_BAR ? "PASS" : "FAIL";
  if (r.score < PASS_BAR) allPass = false;
  console.log(`${mark}  ${r.score}/10  ${r.label}`);
}
console.log(allPass ? "\nALL CASES >= 8 — engine passes." : "\nBELOW BAR — iterate on the prompt.");
process.exit(allPass ? 0 : 1);
