import { BaseKind, FLAVORS, WAFFLES, COFFEES, MATCHAS, TOPPINGS, VARIANT_BY_ID, TOPPING_BY_ID, DRINK_BY_ID, Variant, stockIdFor, PriceCat } from '../data/catalog';
import { Persona } from '../data/dialogue';
import { GameState } from './state';
import { chance, pick, pickWeighted, randi, shuffle } from '../core/util';

export interface OrderItem {
  base: BaseKind;
  variant: string;
  toppings: string[];
}

export interface HeldItem {
  base: BaseKind | 'drink';
  variant: string;
  toppings: string[];
  burnt: boolean;
}

/** Welche Grundsorten bevorzugen die Persönlichkeiten? */
const BASE_PREF: Record<Persona, Record<BaseKind, number>> = {
  naschkatze: { froyo: 5, waffle: 4, coffee: 1, matcha: 1 },
  gesund: { froyo: 3, waffle: 0.5, coffee: 1, matcha: 5 },
  hipster: { froyo: 2, waffle: 1, coffee: 3, matcha: 5 },
  oma: { froyo: 2, waffle: 5, coffee: 4, matcha: 0.5 },
  kind: { froyo: 6, waffle: 4, coffee: 0, matcha: 0.3 },
  business: { froyo: 2, waffle: 1, coffee: 5, matcha: 2 },
  tourist: { froyo: 5, waffle: 3, coffee: 2, matcha: 2 },
  influencer: { froyo: 4, waffle: 2, coffee: 2, matcha: 5 },
  student: { froyo: 4, waffle: 3, coffee: 3, matcha: 2 },
};

const TOPPING_COUNT: Record<Persona, [number, number]> = {
  naschkatze: [2, 4], gesund: [1, 2], hipster: [0, 2], oma: [0, 1], kind: [1, 3],
  business: [0, 1], tourist: [1, 2], influencer: [1, 3], student: [0, 2],
};

export function machineOwned(s: GameState, v: Variant): boolean {
  return s.equipment.includes(v.machine);
}

export function availableVariants(s: GameState, base: BaseKind): Variant[] {
  const list = base === 'froyo' ? FLAVORS : base === 'waffle' ? WAFFLES : base === 'coffee' ? COFFEES : MATCHAS;
  return list.filter((v) => machineOwned(s, v) && s.unlocked.includes(v.id));
}

export function availableToppings(s: GameState) {
  return TOPPINGS.filter((t) => s.unlocked.includes(t.id) && (!t.needs || s.equipment.includes(t.needs)));
}

function inStock(s: GameState, base: BaseKind, variant: string): boolean {
  return (s.stock[stockIdFor(base, variant)] ?? 0) > 0;
}

/** Erzeugt eine Bestellung passend zur Persönlichkeit. `onlyDrinks` für Nachbestellungen beim Kaffeeklatsch. */
export function generateOrder(s: GameState, persona: Persona, onlyDrinks = false): OrderItem | null {
  const bases: BaseKind[] = onlyDrinks ? ['coffee', 'matcha'] : ['froyo', 'waffle', 'coffee', 'matcha'];
  const options = bases.filter((b) => availableVariants(s, b).length > 0);
  if (!options.length) return null;
  // meist nur bestellen, was vorrätig ist – aber nicht immer (Kund:innen sehen das Lager nicht)
  const stocked = options.filter((b) => availableVariants(s, b).some((v) => inStock(s, b, v.id)));
  const pool = stocked.length && chance(0.92) ? stocked : options;
  const base = pickWeighted(pool, (b) => BASE_PREF[persona][b] + 0.05);
  let variants = availableVariants(s, base);
  const stockedV = variants.filter((v) => inStock(s, base, v.id));
  if (stockedV.length && chance(0.9)) variants = stockedV;
  let variant: Variant;
  if (persona === 'gesund') variant = pickWeighted(variants, (v) => (/natur|heidel|dinkel|hafer|kokos|matcha|espresso/.test(v.id) ? 4 : 1));
  else if (persona === 'naschkatze' || persona === 'kind') variant = pickWeighted(variants, (v) => (/schoko|erdbeer|mango|kakao|strawberry|belg/.test(v.id) ? 4 : 1));
  else if (persona === 'hipster') variant = pickWeighted(variants, (v) => (/hafer|kokos|pistazie|dinkel|matcha|espresso/.test(v.id) ? 4 : 1));
  else if (persona === 'influencer') variant = pickWeighted(variants, (v) => (/strawberry|mango|erdbeer|heidel|pistazie|latte/.test(v.id) ? 4 : 1));
  else variant = pick(variants);

  const toppings: string[] = [];
  if (base === 'froyo' || base === 'waffle') {
    const avail = availableToppings(s);
    const stockedT = avail.filter((t) => (s.stock['top_' + t.id] ?? 0) > 0);
    const tpool = stockedT.length && chance(0.9) ? stockedT : avail;
    let [mn, mx] = TOPPING_COUNT[persona];
    mx = Math.min(mx, tpool.length, 2 + Math.floor(avail.length / 5));
    mn = Math.min(mn, mx);
    const n = randi(mn, mx);
    const weighted = shuffle([...tpool]).sort((a, b) => {
      const w = (t: typeof a) => (persona === 'gesund' ? (t.fruit ? -2 : t.sweet ? 1 : 0) : persona === 'naschkatze' || persona === 'kind' ? (t.sweet ? -1 : 0) : 0) + Math.random();
      return w(a) - w(b);
    });
    for (const t of weighted.slice(0, n)) toppings.push(t.id);
  }
  return { base, variant: variant.id, toppings };
}

export function priceCat(base: BaseKind | 'drink'): PriceCat {
  return base;
}

export function orderPrice(s: GameState, o: OrderItem): number {
  return s.prices[o.base] + o.toppings.length * s.prices.topping;
}

export function fairPriceOf(o: OrderItem, fair: Record<PriceCat, number>): number {
  return fair[o.base] + o.toppings.length * fair.topping;
}

export function itemName(base: BaseKind | 'drink', variant: string): string {
  if (base === 'drink') return DRINK_BY_ID.get(variant)?.name ?? variant;
  const v = VARIANT_BY_ID.get(variant);
  if (!v) return variant;
  if (base === 'froyo') return 'Frozen Yogurt ' + v.name;
  if (base === 'waffle') return v.name;
  return v.name;
}

export function describeOrder(o: OrderItem | HeldItem): string {
  let t = itemName(o.base, o.variant);
  if ('burnt' in o && o.burnt) t = 'Verbrannte ' + t;
  if (o.toppings.length) t += ' mit ' + joinDe(o.toppings.map((id) => TOPPING_BY_ID.get(id)?.name ?? id));
  return t;
}

export function joinDe(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return parts.slice(0, -1).join(', ') + ' & ' + parts[parts.length - 1];
}

/** 1 = perfekt, 0 = völlig falsch */
export function matchScore(h: HeldItem, o: OrderItem): number {
  if (h.base !== o.base) return 0;
  let s = h.variant === o.variant ? 0.6 : 0.25;
  const want = new Set(o.toppings);
  const have = new Set(h.toppings);
  let ok = 0, bad = 0;
  for (const t of have) (want.has(t) ? ok++ : bad++);
  const missing = o.toppings.length - ok;
  if (!want.size && !have.size) s += 0.4;
  else s += 0.4 * Math.max(0, (ok - bad * 0.7 - missing * 0.7) / Math.max(1, want.size));
  if (h.burnt) s -= 0.5;
  return Math.max(0, s);
}

export function exactMatch(h: HeldItem, o: OrderItem): boolean {
  if (h.burnt || h.base !== o.base || h.variant !== o.variant) return false;
  if (h.toppings.length !== o.toppings.length) return false;
  const want = new Set(o.toppings);
  return h.toppings.every((t) => want.has(t)) && new Set(h.toppings).size === h.toppings.length;
}

/** Fehlerhafte Version einer Bestellung (für ungeschicktes Personal) */
export function botchOrder(s: GameState, o: OrderItem): OrderItem {
  const c: OrderItem = { base: o.base, variant: o.variant, toppings: [...o.toppings] };
  const avail = availableToppings(s);
  if (c.toppings.length && chance(0.5)) c.toppings.pop();
  else if (avail.length) c.toppings.push(pick(avail).id);
  else c.variant = pick(availableVariants(s, o.base)).id;
  return c;
}
