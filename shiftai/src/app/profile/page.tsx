"use client";

/**
 * Profile — grouped inset form for the Profile type.
 * Autosaves to localStorage (LS_PROFILE) on every change with a "Saved" toast.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import type { Profile } from "@/src/lib/agents/types";
import { emptyProfile, loadProfile, saveProfile } from "@/src/lib/store";

import NavBar from "@/src/components/ios/NavBar";
import Card from "@/src/components/ios/Card";
import InsetGroup from "@/src/components/ios/InsetGroup";
import PillButton from "@/src/components/ios/PillButton";
import TextField from "@/src/components/ios/TextField";

type ArrayField = "skills" | "certs" | "signatureDrinks" | "languages";

const ARRAY_FIELDS: { key: ArrayField; label: string; placeholder: string }[] = [
  { key: "skills", label: "Skills", placeholder: "Toast POS, high-volume, craft cocktails" },
  { key: "certs", label: "Certifications", placeholder: "TIPS, NYC Food Protection" },
  { key: "signatureDrinks", label: "Signature drinks", placeholder: "Smoked paloma, dirty gibson" },
  { key: "languages", label: "Languages", placeholder: "English, Spanish" },
];

function joinList(items: string[]): string {
  return items.join(", ");
}

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [arrayText, setArrayText] = useState<Record<ArrayField, string>>({
    skills: "",
    certs: "",
    signatureDrinks: "",
    languages: "",
  });
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const stored = loadProfile();
    if (stored) {
      setProfile(stored);
      setArrayText({
        skills: joinList(stored.skills),
        certs: joinList(stored.certs),
        signatureDrinks: joinList(stored.signatureDrinks),
        languages: joinList(stored.languages),
      });
    }
    setLoaded(true);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const scheduleSave = useCallback((next: Profile) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (saveProfile(next)) {
        setToast(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(false), 1400);
      }
    }, 500);
  }, []);

  const update = useCallback(
    (patch: Partial<Profile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const updateArray = useCallback(
    (key: ArrayField, raw: string) => {
      setArrayText((prev) => ({ ...prev, [key]: raw }));
      update({ [key]: splitList(raw) } as Partial<Profile>);
    },
    [update],
  );

  const updateJob = useCallback(
    (index: number, patch: Partial<Profile["workHistory"][number]>) => {
      setProfile((prev) => {
        const workHistory = prev.workHistory.map((job, i) =>
          i === index ? { ...job, ...patch } : job,
        );
        const next = { ...prev, workHistory };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  const addJob = useCallback(() => {
    setProfile((prev) => {
      const next = {
        ...prev,
        workHistory: [
          ...prev.workHistory,
          { place: "", role: "", time: "", highlights: "" },
        ],
      };
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const removeJob = useCallback(
    (index: number) => {
      setProfile((prev) => {
        const next = {
          ...prev,
          workHistory: prev.workHistory.filter((_, i) => i !== index),
        };
        scheduleSave(next);
        return next;
      });
    },
    [scheduleSave],
  );

  if (!loaded) {
    return (
      <main>
        <NavBar title="Profile" large />
      </main>
    );
  }

  return (
    <main>
      <NavBar title="Profile" large />

      <p
        style={{
          fontSize: 15,
          lineHeight: 1.4,
          color: "var(--sys-gray, #8E8E93)",
          margin: "4px 20px 21px",
        }}
      >
        Everything here feeds your resume and interview prep. Saves as you type.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 35, padding: "0 16px" }}>
      <InsetGroup header="Basics">
        <TextField label="Name" value={profile.name} onChange={(v) => update({ name: v })} placeholder="Marco Hergi" />
        <TextField label="Email" value={profile.email} onChange={(v) => update({ email: v })} placeholder="you@email.com" />
        <TextField label="Phone" value={profile.phone} onChange={(v) => update({ phone: v })} placeholder="(917) 555-0123" />
        <TextField
          label="Neighborhood"
          value={profile.neighborhood}
          onChange={(v) => update({ neighborhood: v })}
          placeholder="East Village"
        />
      </InsetGroup>

      <InsetGroup header="The role">
        <TextField label="Target role" value={profile.role} onChange={(v) => update({ role: v })} placeholder="Bartender" />
        <TextField
          label="Years behind the bar"
          value={profile.yearsExperience}
          onChange={(v) => update({ yearsExperience: v })}
          placeholder="4"
        />
      </InsetGroup>

      {/* Work history lives OUTSIDE an inset group — white cards on the
          grouped background stay visible (no white-in-white nesting). */}
      <section>
        <div className="inset-group__header">Work history</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {profile.workHistory.map((job, i) => (
            <Card key={i}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.07em",
                    textTransform: "uppercase",
                    color: "var(--sys-gray, #8E8E93)",
                  }}
                >
                  Job {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeJob(i)}
                  aria-label={`Remove job ${i + 1}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    border: "none",
                    background: "transparent",
                    color: "#FF3B30",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "6px 4px",
                  }}
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                  Remove
                </button>
              </div>
              <TextField label="Place" value={job.place} onChange={(v) => updateJob(i, { place: v })} placeholder="Death & Co" />
              <TextField label="Role" value={job.role} onChange={(v) => updateJob(i, { role: v })} placeholder="Bartender" />
              <TextField label="When" value={job.time} onChange={(v) => updateJob(i, { time: v })} placeholder="2023 – 2025" />
              <TextField
                label="Highlights"
                value={job.highlights}
                onChange={(v) => updateJob(i, { highlights: v })}
                placeholder="Ran a 300-cover Saturday bar solo; built the fall cocktail list…"
                multiline
              />
            </Card>
          ))}
          <PillButton onPress={addJob} variant="tinted" full>
            <Plus size={15} strokeWidth={2.4} />
            Add a job
          </PillButton>
        </div>
        <div className="inset-group__footer">
          Your most recent gigs first. Highlights become resume bullets.
        </div>
      </section>

      <InsetGroup header="Skills & extras" footer="Separate items with commas.">
        {ARRAY_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            value={arrayText[f.key]}
            onChange={(v) => updateArray(f.key, v)}
            placeholder={f.placeholder}
          />
        ))}
      </InsetGroup>

      <InsetGroup header="About you" footer="One or two honest sentences. The resume summary builds from this.">
        <TextField
          value={profile.summary}
          onChange={(v) => update({ summary: v })}
          placeholder="Ten years behind NYC bars, from dive shifts to craft programs…"
          multiline
        />
      </InsetGroup>
      </div>

      {/* Saved toast */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)",
          display: "flex",
          justifyContent: "center",
          pointerEvents: "none",
          zIndex: 50,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#FFFFFF",
            background: "rgba(60,60,67,0.82)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 999,
            padding: "7px 16px",
            opacity: toast ? 1 : 0,
            transform: toast ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 220ms ease, transform 220ms ease",
          }}
        >
          Saved
        </span>
      </div>
    </main>
  );
}
