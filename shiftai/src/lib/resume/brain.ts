/**
 * Manhattan bartender hiring intelligence — a static knowledge module.
 *
 * Every entry here traces to a REAL job listing or primary source read on
 * 2026-08-03. Sources and quotes are catalogued in `research/resume-intel.md`
 * (repo root). Nothing in this file is invented folklore; when a fact is an
 * industry-guidance claim rather than a listing quote, the research doc says
 * which article it came from.
 *
 * Consumers: `src/lib/resume/build.ts` (tailoring prompts), interview engine
 * (venue-aware questions). Pure data + one pure classifier — no I/O, no LLM.
 */

/* ── Venue taxonomy ──────────────────────────────── */

export type VenueType =
  | "fine-dining"
  | "cocktail-bar"
  | "hotel-bar"
  | "high-volume"
  | "neighborhood";

export interface VenueBrief {
  /** Human label for UI and prompts. */
  label: string;
  /** Lowercase keywords that map a VenueIntel.kind / listing text onto this type. */
  detect: readonly string[];
  /** What listings for this venue type actually screen for (quoted or paraphrased from real listings). */
  hiringSignals: readonly string[];
  /** Words these employers use themselves — mirror them in the resume. */
  vocabulary: readonly string[];
  /** Bullet templates with realistic quantification, in the shape managers scan for. */
  bulletPatterns: readonly string[];
  /** The angle the professional summary should take for this venue type. */
  summaryAngle: string;
  /** Requirements that appear in essentially every listing of this type. */
  mustHaves: readonly string[];
  /** Things that read wrong to THIS venue type specifically. */
  avoid: readonly string[];
}

export const VENUE_TYPES: Record<VenueType, VenueBrief> = {
  "fine-dining": {
    label: "Fine dining",
    detect: [
      "fine dining",
      "michelin",
      "tasting menu",
      "prix fixe",
      "prix-fixe",
      "upscale",
      "elevated",
      "nyt starred",
      "white tablecloth",
      "brasserie",
      "steakhouse",
    ],
    hiringSignals: [
      // Café Boulud: "Previous experience in a fine dining environment"
      "Named fine-dining or Michelin/NYT-starred houses on the resume — Oiji Mi asks outright for 'experience in Michelin rated or NYT starred restaurants'",
      // Jean-Georges 220 CPS: "Advanced wine knowledge, including familiarity with classic and contemporary wine regions, varietals, and proper service standards"
      "Advanced wine knowledge — regions, varietals, proper service standards (Jean-Georges requirement, verbatim)",
      // Café Boulud: "Knowledge of and interest in fine cuisine and wines"
      "Food knowledge, not just drinks: fine-dining bartenders are quizzed on the menu and wine list",
      // Café Boulud: "Pour all drinks for bar guests and from printed tickets for servers"
      "Service-bar experience — pouring from printed tickets for the dining room, not just direct guests",
      // Café Boulud: "Impeccable grooming as defined by management and dress code"
      "Polish: grooming, demeanor, written/oral communication all appear as explicit requirements",
    ],
    vocabulary: [
      "fine dining",
      "steps of service",
      "wine service",
      "varietals",
      "mise en place",
      "service bar",
      "printed tickets",
      "prix fixe",
      "pooled tips",
      "impeccable grooming",
      "cocktail list development",
    ],
    bulletPatterns: [
      "Ran service bar for a [N]-seat dining room, pouring from printed tickets for [N] servers while holding a [N]-guest bar top (mirrors Café Boulud's stated duties)",
      "Guided guests through a [N]-bottle wine list; regularly sold above-average checks via wine and digestif pairings",
      "Prepared full bar mise en place daily; opened and closed the bar solo (mise en place is Café Boulud's own word)",
      "Contributed [N] cocktails to the seasonal list under the beverage director ('create cocktail list' is a listed duty)",
      "Maintained wine cellar organization and assisted monthly beverage inventory (both verbatim Oiji Mi / Café Boulud skills)",
    ],
    summaryAngle:
      "Polished service professional first, bartender second: lead with fine-dining houses worked, wine program depth, and calm formal-service execution. Name the caliber of past rooms (Michelin, NYT-starred, hotel fine dining) — these listings filter on pedigree.",
    mustHaves: [
      "2+ years in a fine-dining environment (Café Boulud, Jean-Georges, Oiji Mi all state 2-3 yr minimums)",
      "Wine knowledge stated concretely — regions, varietals, service standards",
      "Full-time / nights-weekends-holidays availability (Oiji Mi requires full-time availability)",
      "Team-service mindset — these are pooled-tip rooms (Café Boulud says 'pooled-tip service role')",
    ],
    avoid: [
      "Flair/party language — 'speed and flair' belongs at high-volume spots, reads wrong for a prix-fixe room",
      "Leading with club/nightlife volume numbers instead of service quality",
      "Omitting wine — every fine-dining listing read asks for it explicitly",
    ],
  },

  "cocktail-bar": {
    label: "Craft cocktail bar",
    detect: [
      "cocktail bar",
      "craft cocktail",
      "speakeasy",
      "mixology",
      "aperitif",
      "cocktail lounge",
      "cocktail den",
      "listening bar",
      "wine bar",
      "conservas",
    ],
    hiringSignals: [
      // Seirēn: "Experienced bartenders with strong fundamentals and attention to detail"
      "Strong classic-cocktail fundamentals — Seirēn: 'strong fundamentals and attention to detail'; Crane Club: 'comprehensive knowledge of classic cocktails required'",
      // Seirēn: "Ability to execute drinks with consistency, speed, and care"
      "Consistency under speed: 'execute drinks with consistency, speed, and care' (Seirēn, verbatim)",
      // Seirēn: "Comfort working in a high-touch, guest-forward environment"
      "Guest-forward warmth — hosting the bar top, guiding guests through the menu, not just producing drinks",
      // Seirēn: "(Mediterranean and aperitif-forward experience is a plus)"
      "Program-specific spirit knowledge as a differentiator (e.g. aperitif-forward, agave, whiskey) — mirror the venue's focus",
      "Quality-driven room pedigree: '2 years of bartending experience in a quality-driven restaurant or bar' (Seirēn)",
    ],
    vocabulary: [
      "classic cocktails",
      "specs",
      "fundamentals",
      "mise en place",
      "guest-forward",
      "high-touch",
      "consistency",
      "batching",
      "house cocktails",
      "spirit-forward",
      "menu development",
    ],
    bulletPatterns: [
      "Executed a [N]-cocktail menu to spec at [N] drinks/hour while hosting a [N]-seat bar top (consistency + speed + care, the Seirēn triad)",
      "Built and maintained full bar mise en place; batched house cocktails for service (batching appears verbatim at Pubkey)",
      "Served 180-220 covers per Friday/Saturday shift at a 90-seat craft cocktail bar (quantification format cited by hiring-manager guidance — swap in real numbers)",
      "Guided guests through a [spirit]-forward list; comfortable with dealer's-choice orders across classic templates",
      "Held pour-cost variance under [N]% through measured pours and tight specs",
    ],
    summaryAngle:
      "Craft credibility with warmth: classics-fluent, spec-disciplined, and genuinely hospitable. Name the cocktail rooms worked and the style of program (aperitivo, agave, tiki) matching this venue's focus — cocktail-bar listings emphasize fundamentals plus fit with 'a refined but approachable concept.'",
    mustHaves: [
      "2+ years in a quality-driven bar or restaurant (Seirēn's stated floor)",
      "Classic cocktail knowledge stated plainly (asked verbatim at Seirēn, Crane Club, Café Chelsea)",
      "NYC Food Handler's Certificate / alcohol-service compliance, or willingness to obtain (Seirēn lists both)",
      "Nights, weekends, holidays availability",
    ],
    avoid: [
      "'Mixologist' as a self-title without fundamentals evidence — listings say 'bartender' and test classics",
      "Pure volume bragging with no craft signal — these rooms filter on care, not just speed",
      "Listing 50 obscure ingredients instead of the venue-relevant program focus",
    ],
  },

  "hotel-bar": {
    label: "Hotel bar",
    detect: [
      "hotel",
      "rooftop bar",
      "lobby bar",
      "resort",
      "boutique hotel",
      "guest rooms",
      "room service",
    ],
    hiringSignals: [
      // Café Chelsea (Hotel Chelsea): "Minimum of 2+ years' experience bartending in fine dining restaurants, cocktail bars, hotels, or equivalent"
      "Cross-format pedigree — Hotel Chelsea's Café Chelsea accepts 'fine dining restaurants, cocktail bars, hotels, or equivalent'",
      // Café Chelsea: TIPS Certification required
      "Certifications up front: TIPS certification is a hard requirement at Café Chelsea; Harta wants food-safety and POS knowledge",
      // Harta: "Follow established recipes and standard operating procedures for consistent drink quality"
      "SOP discipline — hotels run on standard recipes and 'standard operating procedures for consistent drink quality' (Harta, verbatim)",
      // Café Chelsea: "Checks identification of all customers who appear under 30"
      "Compliance instincts: ID-checking and responsible-service language appears in the duties themselves",
      "All-day service range — hotel bars serve breakfast-to-late and every guest type; 'greet guests warmly and engage in professional and friendly conversation' (Harta)",
    ],
    vocabulary: [
      "standard operating procedures",
      "consistent beverage service",
      "TIPS certified",
      "responsible alcohol service",
      "guest experience",
      "impeccable hospitality",
      "classic cocktails",
      "cash and credit handling",
      "union house",
    ],
    bulletPatterns: [
      "Delivered consistent beverage service to standard recipes across a [N]-seat lobby bar and [N]-cover dinner service ('consistent beverage service' is Café Chelsea's phrase)",
      "TIPS-certified; zero compliance incidents across [N] years — carded all guests appearing under 30 per house policy (the policy is verbatim from Café Chelsea's duties)",
      "Handled cash, credit, and room-charge transactions on [POS] with end-of-shift accuracy",
      "Served international hotel guests, tourists, and regulars across day-to-night shifts, including holidays",
      "Suggested menu pairings and upsold signature cocktails, lifting average bar check by [N]%",
    ],
    summaryAngle:
      "Reliability and polish for a house with standards: certifications first (TIPS/ATAP, Food Handler), multi-format experience (restaurant + bar + hotel), compliance-clean record, comfort with SOP-driven service. For union (HTC) houses, steadiness and tenure read better than creativity.",
    mustHaves: [
      "TIPS (or equivalent ATAP) certification — hard-required at Café Chelsea, expected across hotel listings",
      "2+ years in fine dining, cocktail bars, or hotels",
      "Nights/weekends/holidays flexibility (stated verbatim at Café Chelsea)",
      "Physical: lift/carry up to 50 lbs appears in hotel listings",
    ],
    avoid: [
      "Dive-bar-only history with no polish signal — hotel listings ask for fine-dining-adjacent pedigree",
      "Ignoring certifications — the one venue type where certs are a stated gate, not a nice-to-have",
      "Job-hopping look: hotels (especially union HTC houses paying ~$40/hr) hire for tenure",
    ],
  },

  "high-volume": {
    label: "High-volume / club / rooftop",
    detect: [
      "high volume",
      "high-volume",
      "nightclub",
      "night club",
      "lounge",
      "sports bar",
      "rooftop",
      "beer hall",
      "event space",
      "music venue",
      "day club",
    ],
    hiringSignals: [
      // Legasea/Tao: "Minimum of three to five (3-5) years' experience in hospitality working in a high-volume bar"
      "Years in explicitly high-volume rooms — Tao's Legasea wants '3-5 years... in a high-volume bar'; a private Manhattan listing wants '3 years... in a high-volume, fast-paced NYC bar or restaurant'",
      // Private listing: "Prepare and serve a full range of ... beverages with speed, accuracy, and flair"
      "Speed with accuracy: 'speed, accuracy, and flair' and 'manage high-volume drink orders efficiently, especially during peak hours' (verbatim)",
      // Legasea: "Working knowledge of portion control and product identification"
      "Cost discipline at speed — portion control, product identification, liquor rotation (all verbatim Tao language)",
      // IGC: "Proven experience as a bartender in a high-volume, upscale setting"
      "Upscale-volume combo: groups like IGC (Refinery Rooftop, Parker & Quinn) want 'high-volume, upscale' — volume alone isn't enough in Manhattan",
      // Legasea: "Recognize and acknowledge when guests are becoming intoxicated"
      "Crowd control judgment: intoxication recognition and conflict resolution appear as duties",
    ],
    vocabulary: [
      "high-volume",
      "fast-paced",
      "peak service",
      "rings",
      "covers",
      "portion control",
      "speed rail",
      "batching",
      "upselling",
      "alcohol awareness",
      "POS accuracy",
    ],
    bulletPatterns: [
      "Rang $[N]K in personal sales per weekend shift at a [N]-capacity rooftop/club (sales-per-shift is the metric managers scan for, per hiring guidance)",
      "Served 300+ guests per shift at a [N]-drink-per-hour peak rate without sacrificing accuracy (format from published high-volume resume examples)",
      "Held liquor-cost variance under 3% via portion control and measured pours ('portion control' is verbatim Tao language)",
      "Batched and prepped for [N]-cover event nights; kept the speed rail and well fully stocked through double shifts",
      "Recognized and de-escalated intoxicated guests per alcohol-awareness training; zero incidents on record (duty verbatim from Legasea)",
    ],
    summaryAngle:
      "Numbers first: covers per shift, rings per night, years in named high-volume NYC rooms. These listings screen for proven throughput under pressure — 'fast paced, high volume, high energy' is their own self-description — plus enough polish for upscale crowds.",
    mustHaves: [
      "3+ years high-volume NYC experience (the floor stated in both Tao and private high-volume listings)",
      "POS fluency and clean cash handling — 'accurately handle cash, POS transactions, and tabs' (verbatim)",
      "Physical stamina: 50-75 lbs lift requirements appear across these listings (Crane Club says 75)",
      "Alcohol awareness training / responsible service (Tao requires certification + in-venue training)",
    ],
    avoid: [
      "Craft-only identity with no throughput numbers — a 10-minute stirred drink resume reads as a liability here",
      "No quantification: volume venues literally hire on volume; bullets without numbers waste the 6-second scan",
      "Leaving out late-night/weekend availability — these rooms live on Friday/Saturday nights",
    ],
  },

  neighborhood: {
    label: "Neighborhood bar / gastropub",
    detect: [
      "neighborhood",
      "gastropub",
      "gastro pub",
      "dive",
      "tavern",
      "pub",
      "local",
      "casual dining",
      "bistro",
      "cafe",
    ],
    hiringSignals: [
      // Pubkey: 4 years required, "High Volume Bartending", Toast POS listed as a named skill
      "Named POS experience — Pubkey (Washington Place gastropub) lists 'Toast POS' as a skill outright; exact-name matches matter",
      // Pubkey: "neighborhood staple", "welcoming atmosphere"
      "Regulars-building: 'neighborhood staple' and 'welcoming atmosphere' are the venue's own identity words — show you build repeat business",
      // IGC: "Build and grow relationships with clients and purveyors for repeat business"
      "Relationship language: 'build and grow relationships with clients... for repeat business' (IGC, verbatim)",
      // Pubkey duties: batching, weekly themed events, upselling
      "Range: batching, themed event nights, upselling, and food knowledge all in one job (Pubkey's duty list)",
      "Real tenure — neighborhood spots ask for surprising depth (Pubkey wants 4 years) because the bartender IS the venue",
    ],
    vocabulary: [
      "regulars",
      "repeat business",
      "neighborhood staple",
      "welcoming",
      "beer knowledge",
      "upselling",
      "Toast POS",
      "themed events",
      "batching",
      "all-around",
    ],
    bulletPatterns: [
      "Built a regulars base that drove [N]% of weeknight revenue; greeted returning guests by name and drink",
      "Ran solo weeknight shifts end-to-end on Toast POS — service, restock, cash-out, close (Toast named because listings name it)",
      "Drove beverage sales through upselling and themed event nights ('weekly themed events' is a verbatim Pubkey duty)",
      "Handled 55-70 covers per hour on solo weekend shifts averaging $2,400 per service (quantification format from published examples — use real numbers)",
      "Rotated draft lines and managed beer program across [N] taps; kept pours and inventory tight",
    ],
    summaryAngle:
      "The dependable all-rounder who becomes the face of the room: solo-shift capable, regulars-magnet, POS-fluent, equally good at a burger rush and a round of shots. Personality and reliability carry more weight than pedigree here — but Manhattan neighborhood spots still expect real years behind the stick.",
    mustHaves: [
      "Multi-year experience even for casual rooms (Pubkey's stated floor is 4 years)",
      "POS competence, ideally the venue's system by name (Toast dominates NYC independents)",
      "Customer engagement / service personality — listed as skills, not soft extras",
      "Food-safety awareness (food-menu venues list Food Handler knowledge)",
    ],
    avoid: [
      "Overly formal fine-dining tone — 'curated elevated experiences' reads wrong for a pub",
      "No personality signal: these hires are about who's behind the bar every Tuesday",
      "Ignoring food — most Manhattan neighborhood bars run full kitchens",
    ],
  },
};

/* ── Manhattan market facts ──────────────────────── */

export interface ManhattanFacts {
  /** POS systems that appear in NYC listings and market data, most-relevant first. */
  pos: readonly { name: string; where: string }[];
  /** Certifications with their actual legal/hiring status in NYC. */
  certs: readonly { name: string; status: string }[];
  /** Wage structure — explains the numbers bartenders see in listings. */
  wages: readonly string[];
  /** Union context for hotel bars. */
  union: readonly string[];
  /** How Manhattan resumes quantify — the norms managers benchmark against. */
  quantificationNorms: readonly string[];
}

export const MANHATTAN_FACTS: ManhattanFacts = {
  pos: [
    {
      name: "Toast",
      where:
        "Dominant among NYC independent restaurants and bars (~24% national restaurant POS share, concentrated in independents); named verbatim as a required skill in Manhattan listings (e.g. Pubkey)",
    },
    {
      name: "Oracle MICROS / Simphony",
      where: "Hotels and enterprise groups — 'powers everything from hotel restaurants to major stadium concessions'",
    },
    {
      name: "NCR Aloha",
      where: "Legacy enterprise chains and older established venues",
    },
    {
      name: "SpotOn",
      where: "Restaurant-focused challenger gaining NYC independents",
    },
    {
      name: "Square",
      where: "Smallest venues, cafés, and pop-ups (~28% share across small businesses broadly)",
    },
  ],
  certs: [
    {
      name: "ATAP (Alcohol Training Awareness Program)",
      status:
        "NY's 'bartending license' — not legally mandatory to pour, but widely required by employers because valid ATAP certification can reduce SLA penalties against the venue by up to 25%",
    },
    {
      name: "TIPS",
      status:
        "The best-known ATAP-approved training provider; listings say 'TIPS Certification required' (Café Chelsea) or 'TIPS Certification preferred' — on a resume, TIPS and ATAP cover the same requirement",
    },
    {
      name: "NYC Food Handler's Certificate / Food Protection Certificate",
      status:
        "NYC DOHMH-issued; the Food Protection Certificate is legally required for supervisors under NYC Health Code, and the NYS food handler certificate is NOT valid in NYC. Bartender listings ask for it by name (Seirēn, private listings)",
    },
  ],
  wages: [
    "NYC minimum wage is $17.00/hr as of Jan 1, 2026",
    "Tipped food-service workers: $11.35/hr cash wage + $5.65/hr tip credit — which is why Manhattan listings post '$11.35/hour plus tips' (that exact figure appears across Culinary Agents listings)",
    "Some venues post full minimum ($16.50-$17.00/hr) plus tips instead of taking the tip credit (Café Boulud $16.50, Harta and Crane Club $17.00)",
    "Real earnings live in tips: one Manhattan gastropub listing estimates $1,200/week in tips on top of the cash wage",
    "Outliers exist: fine-dining service bar posts up to $30/hr (Jean-Georges 220 CPS, part-time)",
  ],
  union: [
    "The Hotel and Gaming Trades Council (HTC) has ~300 NYC hotels under contract — roughly 75% of the city's hotel industry",
    "Union hotel workers earn nearly $40/hr on average — about double non-union hotel pay — with free family healthcare and pension",
    "Route in: register with HTC's Hiring Enforcement Office at hotelworkers.org/hire (or in person at 709 8th Ave), and apply to hotels directly — union houses reward tenure and clean service records",
  ],
  quantificationNorms: [
    "Covers per shift: '180 to 220 covers per Friday and Saturday shift at a 90-seat craft cocktail bar' is the canonical example format",
    "Guests + revenue: '300+ guests per shift and averaging $12,000 in nightly bar revenue with a 120-drink-per-hour peak rate'",
    "Solo-shift economics: '55-70 covers per hour on solo weekend shifts averaging $2,400 per service'",
    "Cost control: 'held variance under 3 percent on liquor cost through measured pours'",
    "Speed: 'under 90-second average preparation time' at 100+ cocktails per shift",
    "Managers benchmark these against their own room — numbers must be plausible for the venue size claimed",
  ],
};

/* ── Recruiter rules (ordered — most important first) ── */

export const RECRUITER_RULES: readonly string[] = [
  "Win the 6-8 second scan: managers look for exactly three things — volume served (covers/sales), specific skills (POS systems, certifications, cocktail range), and tone (working bartender vs. tourist). All three must surface in the top third of the page.",
  "One page, always. 'Never submit a two-page résumé' — a second page signals inability to prioritize.",
  "Professional experience comes first and carries the decision: where you worked, what you were responsible for, how long you stayed. The whole review 'usually takes less than a minute.'",
  "Every experience bullet = action verb + specific task + quantified metric + context. 'Served customers' loses to 'served 180-220 covers per Friday/Saturday shift at a 90-seat cocktail bar.'",
  "Name POS systems exactly (Toast, Aloha, MICROS, SpotOn) — hospitality ATS and human scanners both match on exact tool names.",
  "Mirror the venue's own vocabulary: a listing that says 'guest-forward' and 'classic cocktails' should get a resume that says 'guest-forward' and 'classic cocktails' — Manhattan listings quoted in this module supply the phrasebook per venue type.",
  "Certifications get their own line and the right names for NYC: TIPS/ATAP and NYC Food Handler's / Food Protection Certificate (a NYS-only cert is not valid in NYC).",
  "Tailor the skills section to the venue type — wine depth for fine dining, throughput for volume rooms, regulars-building for neighborhood spots. One generic resume loses to five tailored ones.",
  "Match stated minimums explicitly: Manhattan listings state hard floors (2 yrs fine dining, 3-5 yrs high-volume, 4 yrs even at a gastropub). Put years-in-format in the summary line.",
  "State availability plainly — nights, weekends, holidays appears as a requirement in nearly every listing read; full-time availability is itself a qualification at fine-dining rooms.",
  "Professional contact details: a party-handle email gets the resume rejected before the first bullet is read. firstname.lastname@ format.",
  "Zero typos. 'Spelling mistakes, formatting errors, and typos' are cited by bar-industry guidance as elimination-level errors in a detail-obsessed trade.",
  "In-person still works in hospitality: hand-delivering a resume during off-peak hours shrinks the competition — the printed copy must be flawless.",
];

/* ── Instant-rejection triggers ──────────────────── */

export const REJECTION_TRIGGERS: readonly string[] = [
  "Unprofessional email address (the cited example: partymike420@) — rejected before the first bullet",
  "Two or more pages — signals inability to prioritize",
  "Typos, spelling mistakes, or formatting errors — fatal in a detail-driven trade",
  "Wrong or missing contact information",
  "Zero numbers anywhere — no covers, no sales, no seats, no years — fails the volume check in the initial scan",
  "Generic duties prose ('responsible for serving customers') instead of quantified achievement bullets",
  "Missing the listing's stated experience minimum with no compensating signal",
  "No POS systems named when the listing names one",
  "Claiming certifications with wrong-jurisdiction names (NYS food handler cert is not valid in NYC)",
  "Tone mismatch: nightlife bravado sent to a Michelin room, or fine-dining formality sent to a dive — reads as 'tourist,' not working bartender",
  "Implausible metrics a manager can't benchmark (1,000 covers solo at a 40-seat bar) — numbers get sanity-checked against the room",
];

/* ── Classifier ──────────────────────────────────── */

/**
 * Map a venue description (VenueIntel.kind / vibe / listing text) to a VenueType.
 * Longest-keyword match wins so "craft cocktail bar in a hotel" resolves by the
 * most specific signal; returns null when nothing matches (caller falls back to
 * un-tailored generation).
 */
export function matchVenueType(description: string): VenueType | null {
  const text = description.toLowerCase();
  let best: { type: VenueType; len: number } | null = null;
  for (const type of Object.keys(VENUE_TYPES) as VenueType[]) {
    for (const kw of VENUE_TYPES[type].detect) {
      if (text.includes(kw) && (!best || kw.length > best.len)) {
        best = { type, len: kw.length };
      }
    }
  }
  return best?.type ?? null;
}
