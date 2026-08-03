/**
 * ResumeDoc → single-page US-Letter PDF via pdf-lib.
 * Clean typographic hierarchy (Helvetica), ATS-friendly (real text, no tables),
 * guaranteed single page: content is measured first and the oldest experience
 * bullets are truncated until everything fits.
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import type { Profile, ResumeDoc } from "@/src/lib/agents/types";

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const MAX_HEIGHT = PAGE_H - MARGIN * 2;

const INK = rgb(0.07, 0.07, 0.09);
const DARK_GRAY = rgb(0.28, 0.28, 0.3);
const GRAY = rgb(0.45, 0.45, 0.47);
const RULE = rgb(0.78, 0.78, 0.8);

const BODY_SIZE = 10;
const BODY_LEADING = 13;
const BULLET_INDENT = 12;

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  oblique: PDFFont;
}

/* ── text sanitation (WinAnsi-safe) ──────────────── */

const CHAR_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": " - ",
  "…": "...",
  " ": " ",
  "•": "-",
  "⁃": "-",
  "→": "->",
};

function sanitize(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/[‘’“”–—… •⁃→]/g, (m) => CHAR_MAP[m] ?? "")
    .replace(/[^\x20-\x7E¡-ÿ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeDoc(doc: ResumeDoc): ResumeDoc {
  return {
    headline: sanitize(doc.headline),
    summary: sanitize(doc.summary),
    experience: (doc.experience ?? []).map((e) => ({
      place: sanitize(e.place),
      role: sanitize(e.role),
      time: sanitize(e.time),
      bullets: (e.bullets ?? []).map(sanitize).filter(Boolean),
    })),
    skills: (doc.skills ?? []).map(sanitize).filter(Boolean),
    certs: (doc.certs ?? []).map(sanitize).filter(Boolean),
    extras: (doc.extras ?? []).map(sanitize).filter(Boolean),
    tailoredTo: doc.tailoredTo ? sanitize(doc.tailoredTo) : null,
  };
}

/* ── text wrapping (measured, not guessed) ───────── */

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      // hard-split a single overlong token
      let piece = "";
      for (const ch of word) {
        if (piece && font.widthOfTextAtSize(piece + ch, size) > maxWidth) {
          lines.push(piece);
          piece = ch;
        } else {
          piece += ch;
        }
      }
      current = piece;
    } else {
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t.trimEnd()}...`;
}

/* ── layout (single code path: measure when page is null, draw otherwise) ── */

function renderResume(page: PDFPage | null, f: Fonts, doc: ResumeDoc, profile: Profile): number {
  let y = PAGE_H - MARGIN;

  const put = (text: string, font: PDFFont, size: number, x: number, color = INK) => {
    if (page && text) page.drawText(text, { x, y, size, font, color });
  };
  const down = (n: number) => {
    y -= n;
  };
  const lines = (
    text: string,
    font: PDFFont,
    size: number,
    x: number,
    width: number,
    color = INK,
    leading = BODY_LEADING,
  ) => {
    for (const ln of wrap(text, font, size, width)) {
      down(leading);
      put(ln, font, size, x, color);
    }
  };
  const section = (title: string) => {
    down(20);
    put(title, f.bold, 11, MARGIN);
    down(4);
    if (page) {
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.5,
        color: RULE,
      });
    }
    down(3);
  };
  const bullet = (text: string) => {
    const wrapped = wrap(text, f.regular, BODY_SIZE, CONTENT_W - BULLET_INDENT);
    wrapped.forEach((ln, i) => {
      down(BODY_LEADING);
      if (i === 0) put("•", f.regular, BODY_SIZE, MARGIN + 2);
      put(ln, f.regular, BODY_SIZE, MARGIN + BULLET_INDENT);
    });
  };

  /* header */
  const name = sanitize(profile.name) || "Bartender";
  down(22);
  put(name, f.bold, 22, MARGIN);

  const headline = doc.headline;
  if (headline) {
    down(15);
    put(truncateToWidth(headline, f.oblique, 10.5, CONTENT_W), f.oblique, 10.5, MARGIN, DARK_GRAY);
  }

  const contact = [profile.email, profile.phone, profile.neighborhood]
    .map(sanitize)
    .filter(Boolean)
    .join("   ·   ");
  if (contact) {
    down(13);
    put(truncateToWidth(contact, f.regular, 9, CONTENT_W), f.regular, 9, MARGIN, GRAY);
  }

  /* summary */
  if (doc.summary) {
    section("SUMMARY");
    lines(doc.summary, f.regular, BODY_SIZE, MARGIN, CONTENT_W);
  }

  /* experience */
  if (doc.experience.length > 0) {
    section("EXPERIENCE");
    doc.experience.forEach((exp, idx) => {
      down(idx === 0 ? 14 : 16);
      const time = exp.time;
      const timeW = time ? f.regular.widthOfTextAtSize(time, 9) : 0;
      const titleMax = CONTENT_W - timeW - (time ? 10 : 0);
      const place = exp.place;
      const placeW = f.bold.widthOfTextAtSize(place, 10.5);
      if (placeW >= titleMax) {
        put(truncateToWidth(place, f.bold, 10.5, titleMax), f.bold, 10.5, MARGIN);
      } else {
        put(place, f.bold, 10.5, MARGIN);
        if (exp.role) {
          const roleText = truncateToWidth(
            `  ·  ${exp.role}`,
            f.regular,
            10.5,
            titleMax - placeW,
          );
          put(roleText, f.regular, 10.5, MARGIN + placeW, DARK_GRAY);
        }
      }
      if (time) put(time, f.regular, 9, PAGE_W - MARGIN - timeW, GRAY);
      down(1);
      for (const b of exp.bullets) bullet(b);
    });
  }

  /* skills */
  if (doc.skills.length > 0) {
    section("SKILLS");
    lines(doc.skills.join("  ·  "), f.regular, BODY_SIZE, MARGIN, CONTENT_W);
  }

  /* certifications */
  if (doc.certs.length > 0) {
    section("CERTIFICATIONS");
    lines(doc.certs.join("  ·  "), f.regular, BODY_SIZE, MARGIN, CONTENT_W);
  }

  /* extras */
  if (doc.extras.length > 0) {
    section("ADDITIONAL");
    lines(doc.extras.join("  ·  "), f.regular, BODY_SIZE, MARGIN, CONTENT_W);
  }

  return PAGE_H - MARGIN - y;
}

/* ── overflow control: truncate oldest experience bullets first ── */

function shrinkOnce(doc: ResumeDoc): boolean {
  // Oldest experience = last entry. Remove its bullets first, then work forward.
  for (let i = doc.experience.length - 1; i >= 0; i--) {
    if (doc.experience[i].bullets.length > 0) {
      doc.experience[i].bullets.pop();
      return true;
    }
  }
  if (doc.extras.length > 0) {
    doc.extras.pop();
    return true;
  }
  if (doc.certs.length > 0) {
    doc.certs.pop();
    return true;
  }
  if (doc.skills.length > 0) {
    doc.skills.pop();
    return true;
  }
  if (doc.experience.length > 1) {
    doc.experience.pop();
    return true;
  }
  return false;
}

/* ── entry point ─────────────────────────────────── */

export async function resumePdf(doc: ResumeDoc, profile: Profile): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    oblique: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };

  const work = sanitizeDoc(doc);
  let guard = 0;
  while (renderResume(null, fonts, work, profile) > MAX_HEIGHT && guard++ < 300) {
    if (!shrinkOnce(work)) break;
  }

  const page = pdf.addPage([PAGE_W, PAGE_H]);
  renderResume(page, fonts, work, profile);

  const owner = sanitize(profile.name) || "Bartender";
  pdf.setTitle(`${owner} - Resume`);
  pdf.setAuthor(owner);
  pdf.setCreator("Shift AI");
  pdf.setProducer("Shift AI");

  return pdf.save();
}
