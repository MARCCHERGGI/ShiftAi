# Job-source research — Manhattan bartender listings (live-tested)

All fetches performed 2026-08-03 (~18:30–18:50 UTC) with plain `node` `fetch()` from this machine
(residential Spectrum-class IP, desktop Chrome UA, no cookies, no auth). Every count below is from a
real response body, not inferred.

**Combined current bartender/bar-role hits across working sources: 138 (CA) + 55 (CL) + 9 (Greenhouse) ≈ 200.**
Target was ≥15.

---

## 1. Culinary Agents — WINNER, primary source

`GET https://culinaryagents.com/search/jobs?search%5Bname%5D=Bartender&search%5Blocation%5D=New%20York%2C%20NY`

- 200, 335,187 bytes, server-rendered Rails HTML. Page `<title>`: "Bartender Jobs in New York, NY".
- Embedded JSON-LD `SearchResultsPage` → `numberOfItems: 140`, `itemListElement[].url` = clean job URLs.
- Pagination: **`&offset=24/48/...` (24 cards/page)**. `&page=2`, `&search[page]=2`, `&start=24` are all
  ignored (return page 1); `&offset=24` returned a different first id (711799). Harvest walk:

  | offset | cards | cumulative unique |
  |---|---|---|
  | 0 | 24 | 24 |
  | 24 | 24 | 48 |
  | 48 | 24 | 72 |
  | 72 | 24 | 96 |
  | 96 | 24 | 120 |
  | 120 | 19 | 139 |
  | 144 | 0 | stop |

- **139 unique cards, 138 bartender-titled, 108 with an explicit "…, New York, NY" street address.**
- Card anchor carries everything: `<a class="ca-single-job-card" data-entity="Festival Cafe"
  data-jobid="713145-821273" data-title="Day Bartender" href="/jobs/713145-Day-Bartender">`, plus
  sibling divs: pay `Part Time · Hourly ($25.00 - $35.00)`, group `Highlife Productions`, address
  `1155 2nd Avenue, New York, NY · Cafe`, and a "Posted today" freshness tag.
- Sample cards pulled: Festival Cafe (UES, $25–35/hr), Café Boulud (100 E 63rd, $16.50+tips),
  Clay (553 Manhattan Ave, $11.35+tips), The Rockaway Hotel ($17+tips).
- Detail page `GET https://culinaryagents.com/jobs/713145-Day-Bartender` → 200, 110,010 bytes, ONE
  JSON-LD block = full schema.org **JobPosting**: `datePosted: 2026-08-03`, `validThrough`,
  `employmentType: PART_TIME`, `experienceRequirements: "3 years"`,
  `hiringOrganization.name: "Festival Cafe"`, `baseSalary.value {min 25.00, max 35.00, HOUR}`,
  `jobLocation.address {1155 2nd Ave, New York, NY 10065}`, `geo {40.7618,-73.9638}`, `skills`,
  full HTML `description`. One fetch = complete listing.
- CDN: Cloudflare (`cf-cache-status: DYNAMIC`, `cf-ray: …-EWR`), no challenge served to plain fetch
  from residential. Datacenter (Vercel) behavior **untested → "unknown"**.

## 2. Greenhouse boards-api (public JSON, CloudFront, no auth — datacenter-safe)

Method: slug-guessed ~50 NYC hospitality groups + Google `site:job-boards.greenhouse.io bartender` searches.
Most NYC restaurant groups (MFG, Tao, USHG, Momofuku, Gerber, NoHo Hosp., Standard, Ace…) are **NOT on
Greenhouse** — 404 on every guessed slug. They hire through Culinary Agents (see #1). Hits:

| slug | URL | total jobs | NY bar roles today |
|---|---|---|---|
| `550` | boards-api.greenhouse.io/v1/boards/550/jobs | 28 | **4** — Barback, Bartender, Cocktail Server (COTE 550), Drink Runner. ⚠ `location.name` is literally `"550"` (= 550 Madison Ave, Midtown) |
| `cotenyc` | boards-api.greenhouse.io/v1/boards/cotenyc/jobs | 12 | **2** — Barback, Bartender (+Bar Manager). e.g. https://job-boards.greenhouse.io/cotenyc/jobs/4017141008 |
| `mossnewyorkllc` | boards-api.greenhouse.io/v1/boards/mossnewyorkllc/jobs | 13 | **1** — Bartender @ New York, NY 10036 (job 4118684009) |
| `sohohouseco` | boards-api.greenhouse.io/v1/boards/sohohouseco/jobs | 371 (global — MUST filter location) | **2** — Bar Captain (Soho House NY, 29-35 9th Ave), Seasonal Bartender (Dumbo House) |

Also probed, 200 but 0 bar roles today: `blankstreet` (85 jobs, coffee), `ghmuso` (US Open board, 0 jobs
now — seasonal), `sweetgreen`. Misses (404): majorfoodgroup, taogroup(+hospitality), gerbergroup,
nohohospitality(+group), momofuku, ushg, unionsquarehospitalitygroup, rh, sohohouse, standardhotels,
thestandard, acehotel(+group), elevenmadisonpark, makeitnicenyc, crafthospitality, jeangeorges,
starrrestaurants, deathandcompany, dantenyc, employeesonly, qualitybranded, catchhospitalitygroup,
cipriani, brooklynbowl, livenation, hardrock, mgmresorts, bowlero, resortsworldnyc, wynn, + ~15 more.

Lever (`api.lever.co/v0/postings/{slug}?mode=json`): 16 hospitality slugs probed — **all 404**. NYC
hospitality does not use Lever. Ashby (`api.ashbyhq.com/posting-api/job-board/{slug}`): 7 slugs probed —
**all 404**; Google `site:jobs.ashbyhq.com bartender` → zero hospitality results. Skip both.

## 3. Craigslist — works residential, 403 from datacenter (degraded)

`GET https://newyork.craigslist.org/search/mnh/fbh?query=bartender` → 200, 57,510 bytes from this machine.

- **88 results, 55 bartender-titled** (`mnh` = Manhattan, `fbh` = food/bev/hosp).
- ⚠ **Markup changed vs. what `src/lib/craigslist.ts` expects.** Post links are now
  `https://www.craigslist.org/view/d/{slug}/{base62Id}` (e.g.
  `/view/d/new-york-mixologist-bartender/cyQx2DL2BuPyYftHrBFNVP`) — the old
  `newyork.craigslist.org/mnh/fbh/d/…/{digits}.html` regex in `parseIndex()` matched **0** links.
  New recipe: `<li class="cl-static-search-result" title="{title}"><a href="{url}">` + inner
  `div.title` / `div.location`. Detail pages still have `#postingbody`, `.mapaddress`,
  `compensation:` — `parseDetail()` survives.
- **Bonus JSON API the CL SPA itself uses**:
  `GET https://sapi.craigslist.org/web/v8/postings/search/full?batch=3-0-360-0-0&cc=US&lang=en&query=bartender&searchPath=fbh`
  → 200, **216 items NYC-wide** with venue name + pay AT INDEX LEVEL, as tagged tuples:
  `[6203852, …, [6,"brooklyn-bartender-server-cook-needed"], [7,"$17-$20hr"], [12,"Bartenders that wait tables…"], [8,"Hidden Rivers BK"], "BARTENDER/SERVER & COOK NEEDED - …"]`
  (tag 6=slug, 7=pay, 8=venue, 12=role blurb, 13=base62 id, last element=title).
- Both craigslist.org and sapi assumed datacenter-blocked (known 403 from Vercel) → `datacenterSafe: false`.

## 4. Dead / not fetchable — tested and excluded

| source | evidence | verdict |
|---|---|---|
| **Poached** (poachedjobs.com) | Search page = 2KB Ember SPA shell, 0 job links. Client JS (3.2MB, fetched) exposes `/api/v1/jobs`, but `GET /api/v1/jobs?limit=3` → **401**, `/api/v1/session` → 401, cookie replay → still 401, `/api/v1/feeds/jobs` → 404. Needs authenticated session (Cognito). | Auth-walled SPA — skip |
| **Harri** (harri.com) | Search page = 4KB JS shell. `gateway.harri.com/searchengine/api/v1/search/jobs` → **403 Forbidden**, `core/api/v1/jobs/search` → **401**. Needs app token. | Auth-walled — skip |
| **Instawork** | `/professional-jobs/new-york-ny/bartender` → **404**; gig marketplace is app/auth-gated. | Skip |
| **Culintro** (culintro.com) | Root → 200 but 511 bytes of Indonesian placeholder ("coba saja dulu / web terkuat") — **domain is dead/squatted**. | Dead |
| **StarChefs jobfinder** | `starchefs.com/jobfinder` and `/jobfinder/search?...` → **404** (soft-404 121KB shell). | Dead path — skip |

## Recommended architecture for the Jobs tab

1. **Culinary Agents** search (offset walk, ~6 fetches) = primary feed: 138 bartender listings with
   venue + pay + address from the card alone; detail JSON-LD on demand for the "Prep this job" flow.
2. **Greenhouse 4-slug sweep** (4 parallel JSON fetches, datacenter-safe, zero risk) = premium-venue
   garnish: COTE/550 Madison, Moss, Soho House.
3. **Craigslist** = keep the existing verified-listings pipeline but (a) fix `parseIndex()` for the
   `/view/d/{slug}/{base62}` markup, (b) treat it as degraded-when-403 (Vercel) — it already has a
   cache; a future residential relay or the sapi endpoint via proxy can revive it.
4. Refresh cadence: CA daily (listings tagged "Posted today"), Greenhouse every 6–12h, CL hourly where
   reachable.
