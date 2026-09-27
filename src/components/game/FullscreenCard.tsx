"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

/**
 * Full-screen inspection view with a subtle tilt + moving foil for shiny cards.
 * Motion is off when the user prefers reduced motion (and can be toggled).
 * Uses <dialog> for focus management and Escape-to-close.
 */
export function FullscreenCard({ children, shiny, label }: { children: ReactNode; shiny: boolean; label: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "calm";
    // Default motion from the user's preference once mounted.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (calm) setMotion(false);
  }, []);

  function onMove(e: React.PointerEvent) {
    const el = tiltRef.current;
    if (!el || !motion) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 14).toFixed(2)}deg`);
    el.style.setProperty("--fx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--fy", `${(y + 0.5) * 100}%`);
  }

  function reset() {
    const el = tiltRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <>
      <button type="button" className={buttonClass("secondary")} onClick={() => dialogRef.current?.showModal()}>
        <Icon.Expand className="h-4 w-4" /> Full-screen view
      </button>
      <dialog
        ref={dialogRef}
        aria-label={label}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-night-950/90 backdrop:backdrop-blur"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <div className="flex h-full flex-col items-center justify-center gap-4 p-4" onClick={(e) => e.target === e.currentTarget && dialogRef.current?.close()}>
          <div
            ref={tiltRef}
            onPointerMove={onMove}
            onPointerLeave={reset}
            className="relative w-full max-w-[420px] transition-transform duration-200 ease-out"
            style={{ transform: motion ? "perspective(1000px) rotateX(var(--rx,0)) rotateY(var(--ry,0))" : undefined }}
          >
            {children}
            {shiny && motion ? (
              <div
                aria-hidden="true"
                className="foil pointer-events-none absolute inset-0 rounded-card opacity-60"
                style={{ backgroundPosition: "var(--fx,50%) var(--fy,50%)" }}
              />
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-pressed={motion} onClick={() => { setMotion((m) => !m); reset(); }} className={buttonClass("ghost", "sm")}>
              {motion ? "Turn off tilt & shine" : "Turn on tilt & shine"}
            </button>
            <button type="button" autoFocus onClick={() => dialogRef.current?.close()} className={buttonClass("secondary", "sm")}>
              <Icon.X className="h-4 w-4" /> Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
