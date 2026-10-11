import { Appearance, defaultPlayer } from '../entities/appearance';
import { FAIR_PRICE, PriceCat, stockDefs } from '../data/catalog';

export interface PlacedItem { uid: number; type: string; x: number; z: number; rot: number }
export interface Loan { id: number; principal: number; remaining: number; daily: number; daysLeft: number; rate: number }
export type StaffRole = 'kasse' | 'kueche';
export interface StaffMember {
  id: number;
  name: string;
  role: StaffRole;
  skill: number;
  wage: number;
  trait: string;
  appearance: Appearance;
}
export interface Review { stars: number; text: string; name: string; day: number }

export interface Settings {
  pixel: number;
  music: number;
  sfx: number;
  musicSource: 'generativ' | 'datei';
  shadows: boolean;
}

export interface GameState {
  version: number;
  shopName: string;
  money: number;
  day: number;
  level: number;
  stock: Record<string, number>;
  unlocked: string[];
  equipment: string[];
  placed: PlacedItem[];
  inventory: string[];
  prices: Record<PriceCat, number>;
  theme: { wall: string; floor: string; awning: string; lights: boolean };
  ownedThemes: string[];
  loans: Loan[];
  staff: StaffMember[];
  player: Appearance;
  reviews: Review[];
  stats: { served: number; revenue: number; tips: number; thieves: number; wrong: number };
  nextUid: number;
  settings: Settings;
  tutorialDone: boolean;
}

const SAVE_KEY = 'froyo-corner-save-v1';

export function newState(): GameState {
  const stock: Record<string, number> = {};
  for (const d of stockDefs()) stock[d.id] = 0;
  stock['froyo_natur'] = 25;
  stock['froyo_erdbeere'] = 25;
  stock['top_schokostreusel'] = 40;
  stock['top_bunte'] = 40;
  stock['top_schokosauce'] = 40;
  return {
    version: 1,
    shopName: 'Froyo Corner',
    money: 500,
    day: 1,
    level: 0,
    stock,
    unlocked: ['natur', 'erdbeere', 'schokostreusel', 'bunte', 'schokosauce'],
    equipment: ['zapfer'],
    placed: [
      { uid: 1, type: 'bistrotisch', x: -3.5, z: -2.0, rot: 0 },
      { uid: 2, type: 'hocker', x: -3.5, z: -1.15, rot: Math.PI },
      { uid: 3, type: 'hocker', x: -3.5, z: -2.85, rot: 0 },
      { uid: 4, type: 'plant', x: -5.4, z: -0.6, rot: 0 },
    ],
    inventory: [],
    prices: { ...FAIR_PRICE },
    theme: { wall: 'wall_creme', floor: 'floor_holz', awning: 'awning_rosa', lights: false },
    ownedThemes: ['wall_creme', 'floor_holz', 'awning_rosa'],
    loans: [],
    staff: [],
    player: defaultPlayer(),
    reviews: [
      { stars: 4, text: 'Neuer Laden, sieht nett aus!', name: 'Nachbarin', day: 0 },
      { stars: 3, text: 'Mal schauen…', name: 'Herr Kowalski', day: 0 },
    ],
    stats: { served: 0, revenue: 0, tips: 0, thieves: 0, wrong: 0 },
    nextUid: 10,
    settings: { pixel: 2, music: 0.5, sfx: 0.7, musicSource: 'generativ', shadows: true },
    tutorialDone: false,
  };
}

export function saveState(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* Speichern nicht möglich (z.B. privater Modus) */
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    const base = newState();
    // fehlende Felder aus neuen Versionen ergänzen
    const merged = { ...base, ...parsed } as GameState;
    merged.stock = { ...base.stock, ...parsed.stock };
    merged.settings = { ...base.settings, ...parsed.settings };
    merged.stats = { ...base.stats, ...parsed.stats };
    merged.prices = { ...base.prices, ...parsed.prices };
    merged.theme = { ...base.theme, ...parsed.theme };
    return merged;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* egal */
  }
}

export function avgRating(s: GameState): number {
  const recent = s.reviews.slice(-25);
  if (!recent.length) return 3.5;
  return recent.reduce((a, r) => a + r.stars, 0) / recent.length;
}
