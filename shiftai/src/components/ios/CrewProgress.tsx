"use client";

import { AlertCircle, Brain, Check, MapPin, Martini, Search, Star, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AgentKey, AgentStatus } from "@/src/lib/agents/types";

interface CrewProgressProps {
  steps: { key: AgentKey; label: string; status: AgentStatus }[];
}

const AGENT_ICON: Record<AgentKey, LucideIcon> = {
  scout: Search,
  venue: MapPin,
  menu: Martini,
  people: Users,
  reviews: Star,
  synthesis: Brain,
};

/* iOS Settings-style colored icon squares, one hue per agent */
const AGENT_COLOR: Record<AgentKey, string> = {
  scout: "#007aff", // blue
  venue: "#ff9500", // orange
  menu: "#af52de", // purple
  people: "#34c759", // green
  reviews: "#ffcc00", // yellow
  synthesis: "#5856d6", // indigo
};

function TrailingState({ status }: { status: AgentStatus }) {
  switch (status) {
    case "running":
      return <span className="crew__spinner" role="status" aria-label="Running" />;
    case "done":
      return (
        <span className="crew__check" aria-label="Done">
          <Check size={14} strokeWidth={3.2} aria-hidden="true" />
        </span>
      );
    case "error":
      return (
        <span className="crew__error" aria-label="Failed">
          <AlertCircle size={14} strokeWidth={2.6} aria-hidden="true" />
        </span>
      );
    default:
      return <span className="crew__dot" aria-label="Waiting" />;
  }
}

export default function CrewProgress({ steps }: CrewProgressProps) {
  return (
    <div className="crew" role="list" aria-label="Agent crew progress">
      {steps.map(({ key, label, status }) => {
        const Icon = AGENT_ICON[key];
        return (
          <div key={key} className={`crew__row crew__row--${status}`} role="listitem">
            <span className="crew__icon" style={{ background: AGENT_COLOR[key] }}>
              <Icon size={17} strokeWidth={2.1} aria-hidden="true" />
            </span>
            <span className="crew__label">{label}</span>
            <span className="crew__state">
              <TrailingState status={status} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { CrewProgress };
