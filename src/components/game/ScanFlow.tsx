"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { api, type ApiError } from "@/lib/client/api";
import type { DiscoveryView } from "@/lib/discovery/service";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

type Phase = "idle" | "locating" | "scanning";

interface LocationFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

type LocationProblem = { title: string; body: string };

function locationProblem(err: GeolocationPositionError | "unsupported" | "insecure"): LocationProblem {
  if (err === "unsupported") return { title: "Location isn't available", body: "This browser doesn't support location. Try a recent mobile browser." };
  if (err === "insecure") {
    return { title: "Location needs a secure connection", body: "Browsers only share location over HTTPS (or on localhost). Open Gubbles via https:// and try again." };
  }
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return {
        title: "Location permission was denied",
        body: "Gubbles needs an approximate location for each discovery. Allow location for this site in your browser settings, then try again.",
      };
    case err.TIMEOUT:
      return { title: "Location took too long", body: "We couldn't get a fix in time. Step outside or near a window and try again." };
    default:
      return { title: "Location unavailable", body: "Your device couldn't work out where you are right now. Try again in a moment." };
  }
}

/** Friendly hints for server error codes. */
const ERROR_TIPS: Partial<Record<string, string>> = {
  QR_NOT_FOUND: "Fill the frame with the code, keep it in focus, and avoid glare.",
  QR_MULTIPLE: "Crop or reframe the photo so exactly one code is visible.",
  IMAGE_TOO_LARGE: "Try a smaller photo (under 5 MB).",
  IMAGE_UNSUPPORTED: "PNG, JPEG and WebP images work best.",
  LOCATION_IMPRECISE: "Turn on precise location or move somewhere with better signal.",
  LOCATION_STALE: "Tap the button again to share a fresh location.",
  DAILY_DISCOVERY_CAP: "You can still re-scan codes you already found today.",
};

function getPosition(): Promise<LocationFix> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && !window.isSecureContext) return reject("insecure");
    if (!("geolocation" in navigator)) return reject("unsupported");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Math.round(pos.timestamp),
        }),
      reject,
      // Fresh fix for every discovery: never reuse a cached position.
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
}

const SCAN_LINES = ["Reading the code…", "Sniffing the neighbourhood…", "Checking under the leaves…", "Something is wiggling…"];

export function ScanFlow() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [locError, setLocError] = useState<LocationProblem | null>(null);
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lineIdx, setLineIdx] = useState(0);
  const pickerId = useId();
  const cameraId = useId();
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // Object URLs are created from the chosen file and revoked on change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (phase !== "scanning") return;
    const t = setInterval(() => setLineIdx((i) => (i + 1) % SCAN_LINES.length), 1100);
    return () => clearInterval(t);
  }, [phase]);

  const choose = useCallback((f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type) && !/\.(png|jpe?g|webp)$/i.test(f.name)) {
      setError({ code: "IMAGE_UNSUPPORTED", message: "That doesn't look like a PNG, JPEG or WebP image.", status: 0 });
      return;
    }
    if (f.size > MAX_BYTES) {
      setError({ code: "IMAGE_TOO_LARGE", message: "That image is over 5 MB.", status: 0 });
      return;
    }
    setFile(f);
  }, []);

  async function reveal() {
    if (!file) return;
    setError(null);
    setLocError(null);
    setPhase("locating");
    let pos: LocationFix;
    try {
      pos = await getPosition();
    } catch (e) {
      setLocError(locationProblem(e as GeolocationPositionError | "unsupported" | "insecure"));
      setPhase("idle");
      return;
    }
    setFix(pos);
    setPhase("scanning");
    const form = new FormData();
    form.set("image", file);
    form.set("location", JSON.stringify(pos));
    const res = await api<{ discovery: DiscoveryView }>("/discoveries", { form });
    if (!res.ok) {
      setError(res.error);
      setPhase("idle");
      return;
    }
    const d = res.data.discovery;
    const flags = new URLSearchParams({ reveal: d.reused ? "0" : "1" });
    if (d.reused) flags.set("reused", "1");
    if (d.locationLocked) flags.set("locked", "1");
    router.push(`/discoveries/${d.id}?${flags}`);
  }

  const busy = phase !== "idle";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* Image picker */}
      <section aria-labelledby="pick-title" className="panel p-5 sm:p-6">
        <h2 id="pick-title" className="font-display text-xl font-bold">1. Snap or pick a QR code</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files?.[0]);
          }}
          className={`relative mt-4 grid min-h-64 place-items-center overflow-hidden rounded-3xl border-2 border-dashed transition ${
            dragging ? "border-sun-300 bg-sun-400/10" : "border-white/15 bg-night-950/50"
          }`}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Your selected QR code photo" className={`max-h-80 w-auto rounded-2xl object-contain p-3 transition ${phase === "scanning" ? "brightness-75" : ""}`} />
              {phase === "scanning" ? (
                <div className="pointer-events-none absolute inset-3 overflow-hidden rounded-2xl" aria-hidden="true">
                  <div className="absolute inset-x-0 top-0 h-full animate-scan">
                    <div className="h-1.5 w-full rounded-full bg-lagoon-300 shadow-[0_0_24px_6px_rgb(125_211_252/0.7)]" />
                  </div>
                  <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-2xl border-l-4 border-t-4 border-lagoon-300" />
                  <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-2xl border-r-4 border-t-4 border-lagoon-300" />
                  <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-2xl border-b-4 border-l-4 border-lagoon-300" />
                  <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-2xl border-b-4 border-r-4 border-lagoon-300" />
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Icon.Upload className="h-10 w-10 text-lagoon-300" />
              <p className="font-display text-lg font-bold">Drop a photo of a QR code here</p>
              <p className="text-sm text-muted">PNG, JPEG or WebP · up to 5 MB · one code per photo</p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          {/* Mobile camera capture hint; falls back to a normal picker on desktop. */}
          <label htmlFor={cameraId} className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-white/15 bg-night-800/80 px-5 font-display font-semibold hover:bg-night-700 focus-within:outline focus-within:outline-3 focus-within:outline-sun-300 sm:hidden ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <Icon.Camera className="h-5 w-5" /> Take a photo
            <input id={cameraId} type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => choose(e.target.files?.[0])} />
          </label>
          <label htmlFor={pickerId} className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border border-white/15 bg-night-800/80 px-5 font-display font-semibold hover:bg-night-700 focus-within:outline focus-within:outline-3 focus-within:outline-sun-300 ${busy ? "pointer-events-none opacity-50" : ""}`}>
            <Icon.Upload className="h-5 w-5" /> {file ? "Choose a different image" : "Choose an image"}
            <input id={pickerId} data-testid="qr-file" type="file" accept={ACCEPT} className="sr-only" disabled={busy} onChange={(e) => choose(e.target.files?.[0])} />
          </label>
        </div>
        <p className="mt-3 text-xs text-faint">
          We only read the code&apos;s contents to identify it. We never open links inside codes, and your photo isn&apos;t kept.
        </p>
      </section>

      {/* Location + reveal */}
      <section aria-labelledby="loc-title" className="panel flex flex-col p-5 sm:p-6">
        <h2 id="loc-title" className="font-display text-xl font-bold">2. Share where you are</h2>
        <p className="mt-2 text-sm text-muted">
          The neighbourhood you&apos;re in helps decide your Gubble&apos;s element and look. We ask for a fresh location for every discovery,
          round it to an area about 1 km across, and don&apos;t store the exact point.
        </p>
        <p className="mt-2 text-xs text-faint">
          Browser locations can&apos;t be verified by our server, so they&apos;re treated as unverified claims — not proof you were there.
        </p>

        {fix ? (
          <p className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-night-950/60 px-3 py-2 text-sm">
            <Icon.Pin className="h-4 w-4 text-coral-400" />
            Using ≈ {fix.latitude.toFixed(2)}, {fix.longitude.toFixed(2)} (±{Math.round(fix.accuracy)} m)
          </p>
        ) : null}

        <div className="mt-auto space-y-4 pt-6">
          {locError ? (
            <Notice tone="warning" title={locError.title}>
              {locError.body}
            </Notice>
          ) : null}
          {error ? (
            <Notice tone="error" title={error.message}>
              {ERROR_TIPS[error.code] ?? (error.code === "ACCOUNT_NOT_CONFIRMED" ? "Head to your profile to confirm your email and phone." : null)}
            </Notice>
          ) : null}
          <Button size="lg" className="w-full" onClick={reveal} disabled={!file} loading={busy}>
            {phase === "locating" ? "Getting your location…" : phase === "scanning" ? "Scanning…" : (
              <>
                <Icon.Pin className="h-5 w-5" /> Share location &amp; reveal
              </>
            )}
          </Button>
          <p ref={statusRef} aria-live="polite" className="min-h-5 text-center text-sm font-bold text-lagoon-300">
            {phase === "scanning" ? SCAN_LINES[lineIdx] : !file ? "Pick an image to begin." : ""}
          </p>
        </div>
      </section>
    </div>
  );
}
