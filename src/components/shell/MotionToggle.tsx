"use client";

import { useEffect, useState } from "react";

const KEY = "gubbles:motion";

/** In-app "calm motion" preference layered on top of prefers-reduced-motion. */
export function MotionToggle({ className = "" }: { className?: string }) {
  const [calm, setCalm] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(KEY);
    } catch {}
    const isCalm = stored === "calm";
    document.documentElement.dataset.motion = isCalm ? "calm" : "full";
    // Sync from storage after mount (localStorage is unavailable during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCalm(isCalm);
  }, []);

  function toggle() {
    const next = !calm;
    setCalm(next);
    document.documentElement.dataset.motion = next ? "calm" : "full";
    try {
      localStorage.setItem(KEY, next ? "calm" : "full");
    } catch {}
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={calm} className={`rounded-pill px-3 py-1.5 text-xs font-bold text-muted hover:bg-white/5 hover:text-ink ${className}`}>
      {calm ? "Calm motion: on" : "Calm motion: off"}
    </button>
  );
}
