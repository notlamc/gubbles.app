import type { ArtSpec } from "@/lib/game/types";

/**
 * Code-rendered preview artwork. Pure function: ArtSpec → SVG markup.
 * All interpolated values are enums or numbers from a validated ArtSpec, never
 * user text, so the output is safe to embed as a data: URI image.
 *
 * Each family has a distinct silhouette; element sets the backdrop motif,
 * variant sets pattern + hue shift, rarity adds glow, and the personal
 * signature nudges hue, eyes, mouth and cheeks.
 */

const hsl = (h: number, s: number, l: number, a = 1) =>
  a === 1 ? `hsl(${Math.round(((h % 360) + 360) % 360)} ${s}% ${l}%)` : `hsl(${Math.round(((h % 360) + 360) % 360)} ${s}% ${l}% / ${a})`;

interface Palette {
  body: string;
  bodyLight: string;
  bodyDark: string;
  belly: string;
  accent: string;
  accentDark: string;
  outline: string;
  bgInner: string;
  bgOuter: string;
}

function palette(spec: ArtSpec): Palette {
  const h = spec.hue;
  const a = spec.accentHue;
  const shadowy = spec.family === "nyxen";
  return {
    body: shadowy ? hsl(h, 32, 28) : hsl(h, 72, 62),
    bodyLight: shadowy ? hsl(h, 34, 44) : hsl(h, 80, 78),
    bodyDark: shadowy ? hsl(h, 38, 16) : hsl(h, 55, 42),
    belly: shadowy ? hsl(h, 28, 40) : hsl(h, 75, 86),
    accent: hsl(a, 88, 64),
    accentDark: hsl(a, 70, 44),
    outline: shadowy ? hsl(h, 45, 8) : hsl(h, 50, 22),
    bgInner: hsl(h + 15, 60, 34),
    bgOuter: hsl(h + 35, 55, 11),
  };
}

// ---------------------------------------------------------------------------
// Face
// ---------------------------------------------------------------------------

function eye(cx: number, cy: number, r: number, spec: ArtSpec, p: Palette): string {
  if (spec.eyes === "sleepy") {
    return `<path d="M${cx - r} ${cy} Q${cx} ${cy + r * 0.9} ${cx + r} ${cy}" fill="none" stroke="${p.outline}" stroke-width="${r * 0.32}" stroke-linecap="round"/>`;
  }
  const glow = spec.family === "nyxen";
  const iris = glow ? p.accent : p.outline;
  const pupilR = spec.eyes === "sparkle" ? r * 0.72 : r * 0.58;
  return [
    `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 1.1}" fill="${glow ? hsl(spec.accentHue, 90, 20) : "#fff"}" stroke="${p.outline}" stroke-width="${r * 0.14}"/>`,
    `<circle cx="${cx + r * 0.1}" cy="${cy + r * 0.12}" r="${pupilR}" fill="${iris}"/>`,
    glow ? `<circle cx="${cx + r * 0.1}" cy="${cy + r * 0.12}" r="${pupilR * 1.6}" fill="${p.accent}" opacity="0.25"/>` : "",
    `<circle cx="${cx - r * 0.18}" cy="${cy - r * 0.28}" r="${r * 0.26}" fill="#fff"/>`,
    spec.eyes === "sparkle" ? `<circle cx="${cx + r * 0.34}" cy="${cy + r * 0.38}" r="${r * 0.13}" fill="#fff"/>` : "",
  ].join("");
}

function face(cx: number, cy: number, s: number, spec: ArtSpec, p: Palette): string {
  const eyeR = 17 * s;
  const gap = 34 * s;
  const mouthY = cy + 30 * s;
  let mouth: string;
  switch (spec.mouth) {
    case "grin":
      mouth = `<path d="M${cx - 16 * s} ${mouthY} Q${cx} ${mouthY + 18 * s} ${cx + 16 * s} ${mouthY}" fill="${hsl(350, 70, 45)}" stroke="${p.outline}" stroke-width="${3 * s}" stroke-linejoin="round"/>`;
      break;
    case "open":
      mouth = `<ellipse cx="${cx}" cy="${mouthY + 4 * s}" rx="${9 * s}" ry="${11 * s}" fill="${hsl(350, 60, 35)}" stroke="${p.outline}" stroke-width="${3 * s}"/><ellipse cx="${cx}" cy="${mouthY + 10 * s}" rx="${6 * s}" ry="${4 * s}" fill="${hsl(350, 80, 70)}"/>`;
      break;
    default:
      mouth = `<path d="M${cx - 14 * s} ${mouthY + 4 * s} Q${cx + 2 * s} ${mouthY + 12 * s} ${cx + 16 * s} ${mouthY - 4 * s}" fill="none" stroke="${p.outline}" stroke-width="${4 * s}" stroke-linecap="round"/>`;
  }
  const cheeks = spec.cheeks
    ? `<ellipse cx="${cx - gap - 10 * s}" cy="${cy + 22 * s}" rx="${11 * s}" ry="${7 * s}" fill="${hsl(345, 90, 70)}" opacity="0.55"/><ellipse cx="${cx + gap + 10 * s}" cy="${cy + 22 * s}" rx="${11 * s}" ry="${7 * s}" fill="${hsl(345, 90, 70)}" opacity="0.55"/>`
    : "";
  return cheeks + eye(cx - gap, cy, eyeR, spec, p) + eye(cx + gap, cy, eyeR, spec, p) + mouth;
}

// ---------------------------------------------------------------------------
// Families: back layer, body (also the pattern clip), front details, face anchor
// ---------------------------------------------------------------------------

interface Parts {
  back: string;
  body: string;
  front: string;
  face: [number, number, number];
}

function ripplekin(p: Palette): Parts {
  const fin = (x: number, y: number, rot: number) =>
    `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 0 C 20 -50, 70 -60, 90 -20 C 70 -10, 50 10, 0 0 Z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="4" opacity="0.92"/>`;
  return {
    back: fin(110, 190, 200) + fin(290, 190, -20) + fin(120, 280, 150) + fin(280, 280, 30) +
      `<circle cx="200" cy="330" r="14" fill="${p.bodyLight}" opacity="0.6"/>`,
    body: `<circle cx="200" cy="220" r="112"/>`,
    front:
      `<ellipse cx="160" cy="165" rx="38" ry="22" fill="#fff" opacity="0.45" transform="rotate(-25 160 165)"/>` +
      `<circle cx="252" cy="148" r="9" fill="#fff" opacity="0.6"/>` +
      `<circle cx="200" cy="220" r="112" fill="none" stroke="${p.outline}" stroke-width="6" opacity="0.8"/>`,
    face: [200, 215, 1.15],
  };
}

function flurri(p: Palette): Parts {
  const puff = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}"/>`;
  return {
    back:
      `<path d="M300 250 C 360 230, 370 170, 330 160 C 350 190, 320 215, 290 220 Z" fill="${p.bodyLight}" stroke="${p.outline}" stroke-width="5"/>` +
      `<ellipse cx="170" cy="330" rx="24" ry="14" fill="${p.bodyDark}"/><ellipse cx="235" cy="330" rx="24" ry="14" fill="${p.bodyDark}"/>`,
    body: `<g>${puff(200, 215, 100)}${puff(125, 235, 58)}${puff(275, 235, 58)}${puff(160, 150, 55)}${puff(240, 150, 55)}${puff(200, 290, 70)}</g>`,
    front:
      `<ellipse cx="98" cy="228" rx="26" ry="70" fill="${p.bodyDark}" stroke="${p.outline}" stroke-width="5" transform="rotate(14 98 228)"/>` +
      `<ellipse cx="302" cy="228" rx="26" ry="70" fill="${p.bodyDark}" stroke="${p.outline}" stroke-width="5" transform="rotate(-14 302 228)"/>` +
      `<ellipse cx="200" cy="232" rx="9" ry="6" fill="${p.outline}"/>` +
      `<ellipse cx="200" cy="305" rx="58" ry="30" fill="${p.belly}" opacity="0.7"/>`,
    face: [200, 205, 1.0],
  };
}

function brimmo(p: Palette): Parts {
  const spike = (x: number, y: number, s: number, rot: number) =>
    `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M-14 0 L0 -40 L14 0 Z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="4" stroke-linejoin="round"/>`;
  return {
    back:
      `<path d="M270 300 C 330 310, 360 280, 350 240 C 340 270, 310 280, 280 272 Z" fill="${p.body}" stroke="${p.outline}" stroke-width="5"/>` +
      `<path d="M120 220 C 70 180, 60 230, 80 250 C 95 235, 110 240, 125 250 Z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="4"/>` +
      `<path d="M280 220 C 330 180, 340 230, 320 250 C 305 235, 290 240, 275 250 Z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="4"/>` +
      spike(160, 110, 0.9, -30) + spike(200, 95, 1.1, 0) + spike(240, 110, 0.9, 30),
    body: `<g><ellipse cx="200" cy="270" rx="95" ry="80"/><circle cx="200" cy="175" r="78"/></g>`,
    front:
      `<ellipse cx="200" cy="285" rx="58" ry="52" fill="${p.belly}"/>` +
      `<path d="M165 270 h70 M160 292 h80 M168 314 h64" stroke="${p.bodyDark}" stroke-width="4" opacity="0.35"/>` +
      `<ellipse cx="148" cy="345" rx="26" ry="15" fill="${p.bodyDark}" stroke="${p.outline}" stroke-width="4"/>` +
      `<ellipse cx="252" cy="345" rx="26" ry="15" fill="${p.bodyDark}" stroke="${p.outline}" stroke-width="4"/>`,
    face: [200, 170, 1.0],
  };
}

function mosslet(p: Palette): Parts {
  const bump = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.bodyDark}" opacity="0.35"/>`;
  return {
    back:
      `<path d="M200 118 C 198 95, 200 80, 204 66" stroke="${hsl(110, 45, 30)}" stroke-width="7" fill="none" stroke-linecap="round"/>` +
      `<path d="M204 72 C 170 40, 130 60, 140 80 C 160 88, 190 84, 204 72 Z" fill="${hsl(105, 65, 50)}" stroke="${hsl(110, 45, 25)}" stroke-width="4"/>` +
      `<path d="M204 72 C 240 36, 280 58, 270 80 C 250 88, 220 86, 204 72 Z" fill="${hsl(95, 70, 55)}" stroke="${hsl(110, 45, 25)}" stroke-width="4"/>`,
    body: `<path d="M80 320 C 70 200, 130 118, 200 118 C 270 118, 330 200, 320 320 C 300 345, 100 345, 80 320 Z"/>`,
    front:
      bump(120, 250, 16) + bump(290, 240, 14) + bump(150, 170, 12) + bump(260, 165, 13) + bump(300, 300, 12) + bump(105, 300, 13) +
      `<ellipse cx="150" cy="342" rx="24" ry="11" fill="${p.bodyDark}"/><ellipse cx="250" cy="342" rx="24" ry="11" fill="${p.bodyDark}"/>` +
      `<path d="M80 320 C 70 200, 130 118, 200 118 C 270 118, 330 200, 320 320 C 300 345, 100 345, 80 320 Z" fill="none" stroke="${p.outline}" stroke-width="6"/>`,
    face: [200, 235, 1.05],
  };
}

function shardling(p: Palette): Parts {
  const crystal = (x: number, y: number, h: number, rot: number) =>
    `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M-16 0 L-10 ${-h} L0 ${-h - 22} L10 ${-h} L16 0 Z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="4" stroke-linejoin="round"/><path d="M0 ${-h - 22} L0 0" stroke="#fff" stroke-width="3" opacity="0.5"/><path d="M-10 ${-h} L-4 -4" stroke="#fff" stroke-width="2" opacity="0.35"/></g>`;
  return {
    back: crystal(130, 175, 55, -35) + crystal(170, 140, 80, -12) + crystal(215, 130, 95, 6) + crystal(262, 150, 70, 28) + crystal(290, 190, 45, 48),
    body: `<path d="M95 300 C 80 240, 110 175, 170 160 C 230 145, 300 170, 315 235 C 330 300, 300 340, 200 342 C 130 344, 102 330, 95 300 Z"/>`,
    front:
      `<path d="M140 200 l20 -8 l10 14 Z M270 285 l18 -6 l6 16 Z M120 290 l14 4 l-6 14 Z" fill="${p.bodyDark}" opacity="0.5"/>` +
      `<ellipse cx="160" cy="346" rx="26" ry="11" fill="${p.bodyDark}"/><ellipse cx="248" cy="346" rx="26" ry="11" fill="${p.bodyDark}"/>` +
      `<path d="M95 300 C 80 240, 110 175, 170 160 C 230 145, 300 170, 315 235 C 330 300, 300 340, 200 342 C 130 344, 102 330, 95 300 Z" fill="none" stroke="${p.outline}" stroke-width="6" stroke-linejoin="round"/>`,
    face: [205, 255, 0.95],
  };
}

function nyxen(p: Palette): Parts {
  return {
    back:
      `<path d="M250 300 C 330 320, 370 250, 340 190 C 330 230, 300 250, 262 262 Z" fill="${p.body}" stroke="${p.outline}" stroke-width="5"/>` +
      `<path d="M335 200 C 350 180, 345 160, 330 150" stroke="${p.accent}" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.8"/>` +
      `<path d="M128 150 L110 50 L185 118 Z" fill="${p.body}" stroke="${p.outline}" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M272 150 L290 50 L215 118 Z" fill="${p.body}" stroke="${p.outline}" stroke-width="5" stroke-linejoin="round"/>` +
      `<path d="M132 138 L122 78 L168 120 Z M268 138 L278 78 L232 120 Z" fill="${p.accentDark}" opacity="0.6"/>`,
    body: `<g><ellipse cx="200" cy="290" rx="72" ry="60"/><path d="M110 170 C 110 110, 290 110, 290 170 C 290 230, 245 250, 200 250 C 155 250, 110 230, 110 170 Z"/></g>`,
    front:
      `<path d="M150 215 C 175 245, 225 245, 250 215 C 235 250, 165 250, 150 215 Z" fill="${p.belly}" opacity="0.8"/>` +
      `<ellipse cx="170" cy="345" rx="20" ry="10" fill="${p.bodyDark}"/><ellipse cx="230" cy="345" rx="20" ry="10" fill="${p.bodyDark}"/>` +
      `<circle cx="140" cy="300" r="4" fill="${p.accent}" opacity="0.6"/><circle cx="262" cy="276" r="3" fill="${p.accent}" opacity="0.6"/><circle cx="120" cy="250" r="2.5" fill="${p.accent}" opacity="0.6"/>`,
    face: [200, 180, 0.9],
  };
}

const FAMILY_PARTS: Record<ArtSpec["family"], (p: Palette) => Parts> = { ripplekin, flurri, brimmo, mosslet, shardling, nyxen };

// ---------------------------------------------------------------------------
// Backdrop and patterns
// ---------------------------------------------------------------------------

function backdrop(spec: ArtSpec, p: Palette): string {
  const light = hsl(spec.hue + 30, 80, 80, 0.35);
  let motif = "";
  switch (spec.element) {
    case "tide":
      motif = [[60, 90, 14], [340, 70, 10], [320, 340, 18], [50, 320, 9], [95, 200, 6], [360, 200, 7]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${light}" stroke-width="3"/>`).join("");
      break;
    case "gale":
      motif = `<path d="M20 90 C 80 60, 140 110, 200 80 S 320 60, 380 90" fill="none" stroke="${light}" stroke-width="5" stroke-linecap="round"/><path d="M40 350 C 110 320, 170 370, 250 340 S 340 330, 380 350" fill="none" stroke="${light}" stroke-width="4" stroke-linecap="round"/>`;
      break;
    case "ember":
      motif = [[70, 80], [330, 110], [60, 300], [345, 320], [300, 50], [110, 360]]
        .map(([x, y], i) => `<path transform="translate(${x} ${y}) scale(${0.8 + (i % 3) * 0.3})" d="M0 -12 C 8 -2, 8 6, 0 12 C -8 6, -8 -2, 0 -12 Z" fill="${hsl(30 + i * 5, 95, 65, 0.55)}"/>`).join("");
      break;
    case "grove":
      motif = [[60, 80, -30], [340, 90, 40], [50, 330, 20], [350, 320, -50]]
        .map(([x, y, r]) => `<path transform="translate(${x} ${y}) rotate(${r})" d="M0 -18 C 14 -8, 14 8, 0 18 C -14 8, -14 -8, 0 -18 Z" fill="${hsl(110, 55, 55, 0.4)}"/>`).join("");
      break;
  }
  const rays =
    spec.rarity === "epic" || spec.rarity === "mythic"
      ? `<g opacity="${spec.rarity === "mythic" ? 0.35 : 0.2}">${Array.from({ length: 12 }, (_, i) => `<path d="M200 220 L${200 + 300 * Math.cos((i * Math.PI) / 6)} ${220 + 300 * Math.sin((i * Math.PI) / 6)} L${200 + 300 * Math.cos((i * Math.PI) / 6 + 0.12)} ${220 + 300 * Math.sin((i * Math.PI) / 6 + 0.12)} Z" fill="${hsl(spec.accentHue, 90, 80)}"/>`).join("")}</g>`
      : "";
  return (
    `<defs><radialGradient id="bg" cx="50%" cy="45%" r="70%"><stop offset="0%" stop-color="${p.bgInner}"/><stop offset="100%" stop-color="${p.bgOuter}"/></radialGradient>` +
    `<radialGradient id="shine" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="${p.bodyLight}"/><stop offset="70%" stop-color="${p.body}"/><stop offset="100%" stop-color="${p.bodyDark}"/></radialGradient></defs>` +
    `<rect width="400" height="400" fill="url(#bg)"/>${rays}${motif}` +
    `<ellipse cx="200" cy="352" rx="120" ry="16" fill="#000" opacity="0.25"/>`
  );
}

function pattern(spec: ArtSpec, p: Palette): string {
  switch (spec.pattern) {
    case "spots":
      return [[150, 190, 12], [250, 200, 10], [180, 290, 14], [270, 290, 11], [130, 260, 9], [220, 150, 8]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${p.bodyDark}" opacity="0.4"/>`).join("");
    case "bands":
      return [150, 205, 260, 315].map((y) => `<rect x="0" y="${y}" width="400" height="16" fill="${p.bodyDark}" opacity="0.28" transform="rotate(-8 200 ${y})"/>`).join("");
    case "stars":
      return [[140, 180], [265, 170], [300, 280], [120, 300], [210, 320]]
        .map(([x, y]) => `<path transform="translate(${x} ${y})" d="M0 -9 L2.5 -2.5 L9 0 L2.5 2.5 L0 9 L-2.5 2.5 L-9 0 L-2.5 -2.5 Z" fill="#fff" opacity="0.7"/>`).join("");
    default:
      return "";
  }
}

export function renderCreatureSvg(spec: ArtSpec): string {
  const p = palette(spec);
  const parts = FAMILY_PARTS[spec.family](p);
  const [fx, fy, fs] = parts.face;
  const translucent = spec.family === "ripplekin" ? ` opacity="0.9"` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">` +
    backdrop(spec, p) +
    `<clipPath id="bodyclip">${parts.body}</clipPath>` +
    parts.back +
    `<g fill="url(#shine)" stroke="${p.outline}" stroke-width="6" stroke-linejoin="round"${translucent}>${parts.body}</g>` +
    `<g clip-path="url(#bodyclip)">${pattern(spec, p)}</g>` +
    parts.front +
    face(fx, fy, fs, spec, p) +
    `</svg>`
  );
}

export function creatureSvgDataUri(spec: ArtSpec): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderCreatureSvg(spec))}`;
}
