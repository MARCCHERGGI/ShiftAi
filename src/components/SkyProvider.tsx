"use client";

import { useEffect } from "react";

/**
 * Sets data-sky on <html> based on current hour, like Apple Weather's
 * sky-aware gradient. Re-checks every 5 minutes so the page transitions
 * naturally without a refresh.
 */
function skyForHour(h: number): "dawn" | "day" | "evening" | "night" {
  if (h >= 5  && h < 11) return "dawn";
  if (h >= 11 && h < 17) return "day";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export default function SkyProvider() {
  useEffect(() => {
    const apply = () => {
      document.documentElement.dataset.sky = skyForHour(new Date().getHours());
    };
    apply();
    const id = setInterval(apply, 5 * 60_000);
    return () => clearInterval(id);
  }, []);
  return null;
}
