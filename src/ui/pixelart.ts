import { BaseKind, Topping, TOPPING_BY_ID, VARIANT_BY_ID, DRINK_BY_ID } from '../data/catalog';

/**
 * Pixel-Art für Produkte und Bestellungen, komplett per Code gezeichnet:
 * Grundprodukt (Becher, Waffel, Tasse, Glas, Flasche) + Toppings modular obendrauf.
 * Raster 22×22 inkl. Rand für die automatische Kontur; Anzeige in ganzzahligen Vielfachen (44 px).
 */

const N = 22;
const OUTLINE = 0x3b2a35;
type Grid = (number | null)[][];
type Pt = [number, number];

/** Fläche, auf der Toppings landen: alle Pixel + Oberkanten (für Soßen) + Stelle für Sahne */
interface Surface { pts: Pt[]; tops: { y: number; x0: number; x1: number }[]; peak: Pt }

const cache = new Map<string, string>();

// ------------------------------------------------------------ Grundwerkzeug

function newGrid(): Grid {
  return Array.from({ length: N }, () => Array<number | null>(N).fill(null));
}

function px(g: Grid, x: number, y: number, c: number): void {
  if (x >= 0 && y >= 0 && x < N && y < N) g[y][x] = c;
}

function rect(g: Grid, x: number, y: number, w: number, h: number, c: number): void {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(g, i, j, c);
}

/** f < 1 dunkler, f > 1 heller */
function shade(c: number, f: number): number {
  let r = (c >> 16) & 255, gr = (c >> 8) & 255, b = c & 255;
  if (f < 1) { r *= f; gr *= f; b *= f; }
  else { const k = f - 1; r += (255 - r) * k; gr += (255 - gr) * k; b += (255 - b) * k; }
  return (Math.round(r) << 16) | (Math.round(gr) << 8) | Math.round(b);
}

/** Helligkeit 0..1 – helle Farben brauchen eine dunklere Schattierung */
function lum(c: number): number {
  return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
}

/** reproduzierbarer Zufall, damit dieselbe Bestellung immer gleich aussieht */
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => {
    h ^= h << 13; h ^= h >>> 17; h ^= h << 5;
    return ((h >>> 0) % 10007) / 10007;
  };
}

function outline(g: Grid): void {
  const add: Pt[] = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y][x] !== null) continue;
    if ((g[y - 1]?.[x] ?? null) !== null || (g[y + 1]?.[x] ?? null) !== null || (g[y][x - 1] ?? null) !== null || (g[y][x + 1] ?? null) !== null) add.push([x, y]);
  }
  for (const [x, y] of add) g[y][x] = OUTLINE;
}

function toUrl(g: Grid): string {
  const cv = document.createElement('canvas');
  cv.width = N;
  cv.height = N;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const c = g[y][x];
    if (c === null) continue;
    ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
    ctx.fillRect(x, y, 1, 1);
  }
  return cv.toDataURL();
}

function cached(key: string, draw: () => Grid): string {
  let u = cache.get(key);
  if (!u) { const g = draw(); outline(g); u = toUrl(g); cache.set(key, u); }
  return u;
}

// ------------------------------------------------------------ Grundprodukte

function drawFroyo(g: Grid, color: number): Surface {
  // Becher
  const cup = 0xfde8ee, stripe = 0xf28cab;
  for (let y = 13; y <= 19; y++) {
    const ins = Math.floor((y - 13) / 2);
    const x0 = 5 + ins, x1 = 16 - ins;
    const c = y === 15 || y === 16 ? stripe : cup;
    for (let x = x0; x <= x1; x++) px(g, x, y, x >= x1 - 1 ? shade(c, 0.88) : c);
  }
  // Swirl in Stufen
  const dark = shade(color, lum(color) > 0.8 ? 0.84 : 0.78), light = shade(color, 1.3);
  const tiers: [number, number, number][] = [[11, 4, 17], [9, 6, 15], [7, 8, 13], [5, 10, 12]];
  const pts: Pt[] = [];
  for (const [y, x0, x1] of tiers) {
    for (let j = y; j <= y + 1; j++) for (let x = x0; x <= x1; x++) {
      const c = x >= x1 - 1 ? dark : j === y && x < x0 + 3 ? light : color;
      px(g, x, j, c);
      if (x > x0 && x < x1) pts.push([x, j]);
    }
  }
  px(g, 11, 4, light);
  return { pts, tops: tiers.map(([y, x0, x1]) => ({ y, x0, x1 })), peak: [11, 4] };
}

function drawWaffle(g: Grid, color: number, id: string): Surface {
  // Teller
  rect(g, 3, 17, 16, 1, 0xf4f1ec);
  rect(g, 2, 18, 18, 1, 0xe2ddd5);
  // Waffel mit Gitter
  const ridge = shade(color, 1.18), pocket = shade(color, 0.82);
  const y0 = id === 'belgisch' ? 6 : 7;
  const pts: Pt[] = [];
  for (let y = y0; y <= 16; y++) for (let x = 4; x <= 17; x++) {
    if ((x === 4 || x === 17) && (y === y0 || y === 16)) continue;
    const onRidge = (x - 4) % 3 === 0 || (y - y0) % 3 === 0;
    px(g, x, y, y === 16 ? shade(color, 0.7) : onRidge ? ridge : pocket);
    if (x > 4 && x < 17 && y > y0 && y < 15) pts.push([x, y]);
  }
  const tops = [];
  for (let y = y0 + 2; y <= 14; y += 3) tops.push({ y, x0: 4, x1: 17 });
  return { pts, tops, peak: [11, y0 - 1] };
}

function drawCoffee(g: Grid, id: string, color: number): void {
  const china = 0xfaf7f2, china2 = 0xe4ddd3;
  if (id === 'espresso') {
    rect(g, 4, 18, 14, 1, china);
    rect(g, 6, 19, 10, 1, china2);
    rect(g, 7, 12, 7, 6, china);
    rect(g, 13, 12, 1, 6, china2);
    rect(g, 8, 12, 5, 1, 0xb8794a);
    px(g, 14, 13, china); px(g, 15, 13, china); px(g, 15, 14, china); px(g, 15, 15, china); px(g, 14, 15, china);
    // Dampf
    px(g, 9, 9, 0xe8e8e8); px(g, 10, 8, 0xe8e8e8); px(g, 11, 9, 0xe8e8e8); px(g, 12, 8, 0xe8e8e8);
    return;
  }
  if (id === 'latte') {
    // hohes Glas mit Schichten
    for (let y = 4; y <= 18; y++) {
      const c = y <= 7 ? 0xfdf9f1 : y <= 11 ? 0xb98552 : y <= 13 ? shade(0xb98552, 1.35) : 0xf6efe2;
      rect(g, 7, y, 8, 1, c);
      px(g, 7, y, 0xe6f2f6);
      px(g, 14, y, 0xd2e4ea);
    }
    rect(g, 8, 19, 6, 1, 0xd2e4ea);
    for (let y = 0; y <= 4; y++) px(g, 13, y, 0xb8c0c8);
    return;
  }
  // Tasse (Cappuccino) bzw. Becher (Kakao)
  const kakao = id === 'kakao';
  const body = kakao ? 0xe8606f : china;
  rect(g, 4, 18, 14, 1, kakao ? 0xd04e5c : china);
  if (!kakao) rect(g, 6, 19, 10, 1, china2);
  rect(g, 5, 10, 10, 8, body);
  rect(g, 14, 10, 1, 8, shade(body, 0.88));
  if (kakao) rect(g, 5, 14, 10, 1, 0xffffff);
  // Henkel
  rect(g, 15, 11, 2, 1, body); rect(g, 16, 12, 1, 3, body); rect(g, 15, 15, 2, 1, body);
  // Oberfläche
  rect(g, 6, 10, 8, 1, kakao ? color : 0xf3e3c8);
  if (kakao) { px(g, 7, 9, 0xffffff); px(g, 8, 9, 0xfde0ec); px(g, 11, 9, 0xffffff); }
  else { px(g, 9, 10, color); px(g, 10, 10, color); }
  px(g, 8, 7, 0xe8e8e8); px(g, 9, 6, 0xe8e8e8); px(g, 11, 7, 0xe8e8e8); px(g, 12, 6, 0xe8e8e8);
}

function drawMatcha(g: Grid, color: number, layer: number): void {
  for (let y = 4; y <= 18; y++) {
    const c = y <= 10 ? (y === 4 ? shade(color, 1.25) : color) : layer;
    rect(g, 6, y, 10, 1, c);
    px(g, 6, y, shade(c, 1.35));
    px(g, 15, y, shade(c, 0.85));
  }
  rect(g, 7, 19, 8, 1, 0xd2e4ea);
  // Eiswürfel
  rect(g, 8, 6, 2, 2, shade(color, 1.55));
  rect(g, 11, 8, 2, 2, shade(color, 1.55));
  // Strohhalm
  for (let y = 0; y <= 5; y++) px(g, 13, y, 0xf28cab);
  px(g, 14, 0, 0xf28cab);
}

function drawBottle(g: Grid, color: number): void {
  rect(g, 9, 1, 4, 2, 0xd94a5a);
  rect(g, 9, 3, 4, 3, shade(color, 1.25));
  for (let y = 6; y <= 19; y++) {
    const c = y >= 11 && y <= 14 ? (y === 12 || y === 13 ? 0xfffaf0 : shade(color, 0.8)) : color;
    rect(g, 7, y, 8, 1, c);
    if (y < 11 || y > 14) { px(g, 8, y, shade(c, 1.35)); px(g, 14, y, shade(c, 0.82)); }
  }
}

// ------------------------------------------------------------ Toppings

const SHAPE_ORDER: Record<Topping['shape'], number> = { sauce: 0, blob: 1, chunk: 2, sprinkle: 3, dust: 4 };

/** zufällige Punkte der Fläche (optional: Platz für 2×2) */
function spots(s: Surface, n: number, r: () => number, big = false): Pt[] {
  const set = new Set(s.pts.map(([x, y]) => x + ',' + y));
  const pool = big ? s.pts.filter(([x, y]) => set.has(x + 1 + ',' + y) && set.has(x + ',' + (y + 1)) && set.has(x + 1 + ',' + (y + 1))) : [...s.pts];
  const out: Pt[] = [];
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out;
}

/** Kleinteile einer Topping-Sorte (Frucht-Details wie Blatt, Kerne) */
function piece(g: Grid, t: Topping, x: number, y: number, k: number): void {
  const c2 = t.color2 ?? shade(t.color, 0.75);
  switch (t.id) {
    case 'erdbeeren':
      rect(g, x, y, 2, 2, t.color); px(g, x, y, 0x5fb04a); return;
    case 'kiwi':
      rect(g, x, y, 2, 2, t.color); px(g, x + 1, y + 1, 0x2a2a1a); return;
    case 'banane':
      rect(g, x, y, 2, 2, t.color); px(g, x + 1, y, shade(t.color, 0.85)); return;
    case 'blaubeeren':
      rect(g, x, y, 2, 2, t.color); px(g, x, y, shade(t.color, 1.5)); return;
    case 'marshmallow':
      rect(g, x, y, 2, 2, k % 2 ? t.color : c2); return;
    case 'gummibaer':
      rect(g, x, y, 2, 2, k % 2 ? t.color : c2); px(g, x, y, shade(k % 2 ? t.color : c2, 1.3)); return;
  }
  rect(g, x, y, 2, 1, k % 2 ? t.color : shade(t.color, 0.82));
  if (t.shape === 'chunk') px(g, x, y + 1, shade(t.color, 0.75));
}

function applyToppings(g: Grid, s: Surface, ids: string[], seed: string): void {
  const list = ids.map((id) => TOPPING_BY_ID.get(id)).filter((t): t is Topping => !!t)
    .sort((a, b) => SHAPE_ORDER[a.shape] - SHAPE_ORDER[b.shape]);
  let sauces = 0;
  for (const t of list) {
    const r = rng(seed + t.id);
    if (t.shape === 'sauce') {
      const k = sauces++;
      for (const top of s.tops) {
        const y = top.y + (k % 2);
        for (let x = top.x0 + 1; x < top.x1; x++) {
          if ((x + k) % 4 === 3 && k > 0) continue;
          px(g, x, y, x % 5 === 0 ? shade(t.color, 1.3) : t.color);
        }
        // Tropfen
        const dx = top.x0 + 2 + Math.floor(r() * Math.max(1, top.x1 - top.x0 - 3));
        px(g, dx, y + 1, t.color);
        if (r() < 0.5) px(g, dx, y + 2, t.color);
      }
    } else if (t.id === 'sahne') {
      // Sahnehaube oben drauf
      const [cx, cy] = s.peak;
      rect(g, cx - 3, cy, 7, 2, t.color);
      rect(g, cx - 2, cy - 2, 5, 2, t.color);
      rect(g, cx - 1, cy - 3, 2, 1, t.color);
      px(g, cx + 2, cy, 0xe9e1d2); px(g, cx + 3, cy + 1, 0xe9e1d2); px(g, cx + 2, cy - 1, 0xe9e1d2);
    } else if (t.shape === 'chunk' || t.shape === 'blob') {
      spots(s, 4, r, true).forEach(([x, y], k) => piece(g, t, x, y, k));
    } else if (t.shape === 'sprinkle') {
      spots(s, 9, r).forEach(([x, y], k) => px(g, x, y, k % 2 && t.color2 !== undefined ? t.color2 : lum(t.color) > 0.85 ? shade(t.color, 0.9) : t.color));
    } else {
      spots(s, 12, r).forEach(([x, y]) => px(g, x, y, t.color));
    }
  }
}

/** Topping einzeln: Schälchen mit Häufchen */
function drawToppingBowl(g: Grid, t: Topping): void {
  const r = rng('bowl' + t.id);
  // Häufchen
  const heap: [number, number, number][] = [[12, 4, 17], [11, 4, 17], [10, 5, 16], [9, 6, 15], [8, 7, 14], [7, 9, 12]];
  const sauce = t.shape === 'sauce';
  const c2 = t.color2 ?? shade(t.color, lum(t.color) > 0.85 ? 0.88 : 0.75);
  for (const [y, x0, x1] of heap) {
    if (sauce && y < 11) continue;
    for (let x = x0; x <= x1; x++) {
      const v = r();
      const c = sauce ? (x === x0 + 2 && y === 11 ? shade(t.color, 1.4) : t.color)
        : t.shape === 'dust' ? (v < 0.25 ? 0xece6dc : t.color)
          : v < 0.45 ? t.color : v < 0.8 ? c2 : shade(t.color, 1.25);
      px(g, x, y, c);
    }
  }
  if (t.shape === 'chunk' || t.shape === 'blob') {
    const pts: Pt[] = [[5, 11], [8, 9], [11, 10], [14, 11], [10, 7], [7, 11], [13, 8]];
    pts.forEach(([x, y], k) => piece(g, t, x, y, k));
  }
  if (t.id === 'sahne') { rect(g, 9, 6, 4, 2, t.color); rect(g, 10, 5, 2, 1, t.color); px(g, 12, 7, 0xe9e1d2); }
  // Schale
  const bowl = 0xf4ece0;
  for (let y = 13; y <= 18; y++) {
    const ins = Math.floor((y - 13) * 0.8);
    for (let x = 3 + ins; x <= 18 - ins; x++) px(g, x, y, y === 15 ? 0x7fd6b4 : x >= 17 - ins ? shade(bowl, 0.88) : bowl);
  }
  if (sauce) { px(g, 6, 13, t.color); px(g, 6, 14, t.color); px(g, 14, 13, t.color); }
}

// ------------------------------------------------------------ öffentlich

export interface ProductLike { base: BaseKind | 'drink'; variant: string; toppings: string[] }

/** Bild-URL für ein Produkt (Basis + Toppings) */
export function productUrl(p: ProductLike): string {
  const tops = [...p.toppings].sort();
  const key = `${p.base}|${p.variant}|${tops.join(',')}`;
  return cached(key, () => {
    const g = newGrid();
    if (p.base === 'drink') { drawBottle(g, DRINK_BY_ID.get(p.variant)?.color ?? 0xcccccc); return g; }
    const v = VARIANT_BY_ID.get(p.variant);
    const color = v?.color ?? 0xcccccc;
    if (p.base === 'froyo') applyToppings(g, drawFroyo(g, color), tops, key);
    else if (p.base === 'waffle') applyToppings(g, drawWaffle(g, color, p.variant), tops, key);
    else if (p.base === 'coffee') drawCoffee(g, p.variant, color);
    else drawMatcha(g, color, v?.layer ?? 0xf4f1e6);
    return g;
  });
}

export function toppingUrl(id: string): string {
  return cached('top|' + id, () => {
    const g = newGrid();
    const t = TOPPING_BY_ID.get(id);
    if (t) drawToppingBowl(g, t);
    return g;
  });
}

const img = (src: string, cls: string, alt: string) =>
  `<img class="px ${cls}" src="${src}" alt="${alt.replace(/"/g, '&quot;')}" draggable="false">`;

/** Produkt als <img> (cls z.B. 'px-s', 'px-l'); `burnt` färbt es dunkel */
export function productImg(p: ProductLike & { burnt?: boolean }, cls = '', alt = ''): string {
  return img(productUrl(p), cls + (p.burnt ? ' burnt' : ''), alt);
}

export function toppingImg(id: string, cls = ''): string {
  return img(toppingUrl(id), cls, TOPPING_BY_ID.get(id)?.name ?? id);
}

/** Komplette Bestellung als Bild: Produkt (+ Getränk) */
export function orderImg(p: ProductLike, drink: string | null = null, cls = '', alt = ''): string {
  const main = productImg(p, cls, alt);
  if (!drink) return main;
  return `<span class="px-combo">${main}<span class="px-plus">+</span>${productImg({ base: 'drink', variant: drink, toppings: [] }, cls)}</span>`;
}
