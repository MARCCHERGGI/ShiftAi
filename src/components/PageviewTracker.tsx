"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { trackEvent } from "@/src/lib/track";

export default function PageviewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    trackEvent("page_view", { path: pathname });
  }, [pathname]);

  return null;
}
