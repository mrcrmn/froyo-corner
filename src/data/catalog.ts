export type BaseKind = 'froyo' | 'waffle' | 'coffee' | 'matcha';
export type PriceCat = 'froyo' | 'waffle' | 'coffee' | 'matcha' | 'topping' | 'drink';

export interface Variant {
  id: string;
  name: string;
  base: BaseKind;
  color: number;
  /** benötigte Ausstattung */
  needs: string;
  /** Kosten zum Freischalten (0 = automatisch mit der Ausstattung) */
  unlockCost: number;
  /** Welche Maschine stellt es her */
  machine: string;
  /** Zweite Schichtfarbe (Matcha-Drinks) */
  layer?: number;
}

export interface Topping {
  id: string;
  name: string;
  color: number;
  color2?: number;
  sweet: boolean;
  fruit: boolean;
  needs?: string;
  unlockCost: number;
  shape: 'sprinkle' | 'sauce' | 'chunk' | 'dust' | 'blob';
}

export interface Drink {
  id: string;
  name: string;
  color: number;
  unlockCost: number;
}

export interface Equipment {
  id: string;
  name: string;
  desc: string;
  price: number;
  requires?: string;
}

export interface Placeable {
  id: string;
  name: string;
  price: number;
  cozy: number;
  cat: 'sitz' | 'tisch' | 'deko';
  w: number;
  d: number;
  blocking: boolean;
  seat?: boolean;
  desc: string;
  minLevel?: number;
}

export interface ThemeOption {
  id: string;
  kind: 'wall' | 'floor' | 'awning';
  name: string;
  price: number;
  cozy: number;
  colors: number[];
}

export const FLAVORS: Variant[] = [
  { id: 'natur', name: 'Natur', base: 'froyo', color: 0xf8f3e8, needs: 'zapfer', unlockCost: 0, machine: 'zapfer' },
  { id: 'erdbeere', name: 'Erdbeere', base: 'froyo', color: 0xf6a2b8, needs: 'zapfer', unlockCost: 0, machine: 'zapfer' },
  { id: 'vanille', name: 'Vanille', base: 'froyo', color: 0xfbe7a8, needs: 'zapfer', unlockCost: 180, machine: 'zapfer' },
  { id: 'mango', name: 'Mango', base: 'froyo', color: 0xffc456, needs: 'eismaschine', unlockCost: 0, machine: 'eismaschine' },
  { id: 'schoko', name: 'Schoko', base: 'froyo', color: 0x8c5a3c, needs: 'eismaschine', unlockCost: 0, machine: 'eismaschine' },
  { id: 'pistazie', name: 'Pistazie', base: 'froyo', color: 0xb8d99a, needs: 'eismaschine', unlockCost: 320, machine: 'eismaschine' },
  { id: 'heidelbeere', name: 'Heidelbeere', base: 'froyo', color: 0x9583c9, needs: 'eismaschine', unlockCost: 300, machine: 'eismaschine' },
  { id: 'matcha', name: 'Matcha', base: 'froyo', color: 0x9cc66f, needs: 'eismaschine', unlockCost: 420, machine: 'eismaschine' },
];

export const WAFFLES: Variant[] = [
  { id: 'klassisch', name: 'Klassische Waffel', base: 'waffle', color: 0xe9b86c, needs: 'waffeleisen', unlockCost: 0, machine: 'waffeleisen' },
  { id: 'belgisch', name: 'Belgische Waffel', base: 'waffle', color: 0xd99645, needs: 'waffeleisen', unlockCost: 260, machine: 'waffeleisen' },
  { id: 'dinkel', name: 'Dinkelwaffel', base: 'waffle', color: 0xc29a6a, needs: 'waffeleisen', unlockCost: 220, machine: 'waffeleisen' },
  { id: 'schokowaffel', name: 'Schoko-Waffel', base: 'waffle', color: 0x7a4a2e, needs: 'waffeleisen', unlockCost: 340, machine: 'waffeleisen' },
];

export const COFFEES: Variant[] = [
  { id: 'espresso', name: 'Espresso', base: 'coffee', color: 0x3b2416, needs: 'kaffeemaschine', unlockCost: 0, machine: 'kaffeemaschine' },
  { id: 'cappuccino', name: 'Cappuccino', base: 'coffee', color: 0xc89a6e, needs: 'kaffeemaschine', unlockCost: 0, machine: 'kaffeemaschine' },
  { id: 'latte', name: 'Latte Macchiato', base: 'coffee', color: 0xe6cfae, needs: 'kaffeemaschine', unlockCost: 150, machine: 'kaffeemaschine' },
  { id: 'kakao', name: 'Heiße Schokolade', base: 'coffee', color: 0x7b4b2f, needs: 'kaffeemaschine', unlockCost: 180, machine: 'kaffeemaschine' },
];

export const MATCHAS: Variant[] = [
  { id: 'matchalatte', name: 'Matcha Latte', base: 'matcha', color: 0x8fbf5a, layer: 0xf4f1e6, needs: 'matchabar', unlockCost: 0, machine: 'matchabar' },
  { id: 'kokosmatcha', name: 'Kokosmilch-Matcha', base: 'matcha', color: 0x86b852, layer: 0xfdfbf4, needs: 'matchabar', unlockCost: 0, machine: 'matchabar' },
  { id: 'strawberrymatcha', name: 'Strawberry Matcha', base: 'matcha', color: 0x7fb24a, layer: 0xf37a95, needs: 'matchabar', unlockCost: 240, machine: 'matchabar' },
  { id: 'hafermatcha', name: 'Hafer-Matcha', base: 'matcha', color: 0x92c060, layer: 0xe9dcc0, needs: 'matchabar', unlockCost: 160, machine: 'matchabar' },
  { id: 'mangomatcha', name: 'Mango-Matcha', base: 'matcha', color: 0x7fb24a, layer: 0xffb93e, needs: 'matchabar', unlockCost: 260, machine: 'matchabar' },
];

export const VARIANTS: Variant[] = [...FLAVORS, ...WAFFLES, ...COFFEES, ...MATCHAS];
export const VARIANT_BY_ID = new Map(VARIANTS.map((v) => [v.id, v]));

export const TOPPINGS: Topping[] = [
  { id: 'schokostreusel', name: 'Schokostreusel', color: 0x4a2c1d, sweet: true, fruit: false, unlockCost: 0, shape: 'sprinkle' },
  { id: 'bunte', name: 'Bunte Streusel', color: 0xff6fa8, color2: 0x6fd6ff, sweet: true, fruit: false, unlockCost: 0, shape: 'sprinkle' },
  { id: 'schokosauce', name: 'Schokosoße', color: 0x5a3120, sweet: true, fruit: false, unlockCost: 0, shape: 'sauce' },
  { id: 'karamell', name: 'Karamellsoße', color: 0xd88b38, sweet: true, fruit: false, unlockCost: 120, shape: 'sauce' },
  { id: 'puderzucker', name: 'Puderzucker', color: 0xffffff, sweet: true, fruit: false, unlockCost: 90, shape: 'dust' },
  { id: 'gummibaer', name: 'Gummibärchen', color: 0xff4f5e, color2: 0x7ee05c, sweet: true, fruit: false, unlockCost: 150, shape: 'chunk' },
  { id: 'keks', name: 'Kekskrümel', color: 0xa9733f, sweet: true, fruit: false, unlockCost: 150, shape: 'chunk' },
  { id: 'kokos', name: 'Kokosraspel', color: 0xf7f4ea, sweet: false, fruit: false, unlockCost: 160, shape: 'sprinkle' },
  { id: 'nuesse', name: 'Gehackte Nüsse', color: 0xa26d36, sweet: false, fruit: false, unlockCost: 180, shape: 'chunk' },
  { id: 'marshmallow', name: 'Mini-Marshmallows', color: 0xfde0ec, color2: 0xffffff, sweet: true, fruit: false, unlockCost: 200, shape: 'chunk' },
  { id: 'ahornsirup', name: 'Ahornsirup', color: 0xb4641c, sweet: true, fruit: false, unlockCost: 170, shape: 'sauce' },
  { id: 'granola', name: 'Granola', color: 0xc9a066, sweet: false, fruit: false, unlockCost: 140, shape: 'chunk' },
  { id: 'erdbeeren', name: 'Erdbeeren', color: 0xe6323e, sweet: false, fruit: true, needs: 'vorratskuehlschrank', unlockCost: 200, shape: 'chunk' },
  { id: 'blaubeeren', name: 'Blaubeeren', color: 0x3b4fb4, sweet: false, fruit: true, needs: 'vorratskuehlschrank', unlockCost: 220, shape: 'blob' },
  { id: 'kiwi', name: 'Kiwi', color: 0x7cc242, sweet: false, fruit: true, needs: 'vorratskuehlschrank', unlockCost: 190, shape: 'chunk' },
  { id: 'mangostuecke', name: 'Mangostücke', color: 0xffad2e, sweet: false, fruit: true, needs: 'vorratskuehlschrank', unlockCost: 210, shape: 'chunk' },
  { id: 'sahne', name: 'Sahne', color: 0xfffbf2, sweet: true, fruit: false, needs: 'vorratskuehlschrank', unlockCost: 180, shape: 'blob' },
  { id: 'banane', name: 'Bananenscheiben', color: 0xfbe68a, sweet: false, fruit: true, needs: 'vorratskuehlschrank', unlockCost: 160, shape: 'chunk' },
];
export const TOPPING_BY_ID = new Map(TOPPINGS.map((t) => [t.id, t]));

export const DRINKS: Drink[] = [
  { id: 'limo', name: 'Zitronenlimo', color: 0xf7e463, unlockCost: 0 },
  { id: 'eistee', name: 'Pfirsich-Eistee', color: 0xf2a05c, unlockCost: 0 },
  { id: 'wasser', name: 'Sprudelwasser', color: 0xa8daf2, unlockCost: 0 },
  { id: 'mate', name: 'Mate', color: 0xd8c066, unlockCost: 120 },
  { id: 'brause', name: 'Kirschbrause', color: 0xe0566b, unlockCost: 120 },
];
export const DRINK_BY_ID = new Map(DRINKS.map((d) => [d.id, d]));

export const EQUIPMENT: Equipment[] = [
  { id: 'zapfer', name: 'Joghurt-Zapfer', desc: 'Dein treuer Start-Zapfer mit zwei Sorten.', price: 0 },
  { id: 'eismaschine', name: 'Eismaschine Deluxe', desc: 'Zweite Maschine: Mango, Schoko und weitere Sorten freischaltbar.', price: 900 },
  { id: 'waffeleisen', name: 'Waffeleisen', desc: 'Frische Waffeln! Achtung: Nicht anbrennen lassen.', price: 600 },
  { id: 'kaffeemaschine', name: 'Siebträger-Kaffeemaschine', desc: 'Espresso & Cappuccino – Kaffeeklatsch-Gäste bestellen nach.', price: 750 },
  { id: 'matchabar', name: 'Matcha-Bar', desc: 'Bambusbesen & Zeremonie: Matcha Latte, Kokosmilch- und Strawberry-Matcha.', price: 700 },
  { id: 'getraenkekuehlschrank', name: 'Getränkekühlschrank', desc: 'Kund:innen nehmen sich Getränke selbst und legen sie auf die Theke.', price: 500 },
  { id: 'vorratskuehlschrank', name: 'Vorratskühlschrank', desc: 'Kühlt frische Toppings: Obst & Sahne werden freischaltbar.', price: 650 },
];
export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));

export const PLACEABLES: Placeable[] = [
  { id: 'stuhl', name: 'Holzstuhl', price: 55, cozy: 0, cat: 'sitz', w: 0.55, d: 0.55, blocking: false, seat: true, desc: 'Ein Sitzplatz. Stell ihn neben einen Tisch.' },
  { id: 'polsterstuhl', name: 'Polsterstuhl', price: 110, cozy: 1, cat: 'sitz', w: 0.6, d: 0.6, blocking: false, seat: true, desc: 'Weich gepolstert in Rosa. Etwas gemütlicher.' },
  { id: 'hocker', name: 'Hocker', price: 35, cozy: 0, cat: 'sitz', w: 0.45, d: 0.45, blocking: false, seat: true, desc: 'Günstig, aber nicht sehr bequem.' },
  { id: 'bistrotisch', name: 'Bistrotisch', price: 120, cozy: 1, cat: 'tisch', w: 0.8, d: 0.8, blocking: true, desc: 'Runder Tisch für 2 Personen.' },
  { id: 'tisch', name: 'Großer Tisch', price: 220, cozy: 1, cat: 'tisch', w: 1.6, d: 0.9, blocking: true, desc: 'Platz für bis zu 4 Personen – perfekt für Kaffeeklatsch.' },
  { id: 'plant', name: 'Topfpflanze', price: 70, cozy: 2, cat: 'deko', w: 0.5, d: 0.5, blocking: true, desc: 'Ein bisschen Grün.' },
  { id: 'kaktus', name: 'Kaktus', price: 45, cozy: 1, cat: 'deko', w: 0.4, d: 0.4, blocking: true, desc: 'Pflegeleicht. Nicht anfassen.' },
  { id: 'monstera', name: 'Große Monstera', price: 210, cozy: 5, cat: 'deko', w: 0.8, d: 0.8, blocking: true, desc: 'Instagram liebt sie.' },
  { id: 'stehlampe', name: 'Stehlampe', price: 140, cozy: 4, cat: 'deko', w: 0.5, d: 0.5, blocking: true, desc: 'Warmes Licht für gemütliche Ecken.' },
  { id: 'teppich', name: 'Flauschteppich', price: 170, cozy: 4, cat: 'deko', w: 2.0, d: 1.4, blocking: false, desc: 'Weicher Teppich. Man kann darauf stehen und Möbel abstellen.' },
  { id: 'regal', name: 'Bücherregal', price: 290, cozy: 6, cat: 'deko', w: 1.4, d: 0.5, blocking: true, desc: 'Bücher zum Schmökern beim Frozen Yogurt.' },
  { id: 'sitzsack', name: 'Sitzsack', price: 150, cozy: 3, cat: 'sitz', w: 0.8, d: 0.8, blocking: false, seat: true, desc: 'Super gemütlich, zählt als Sitzplatz am Tisch.' },
  { id: 'blumen', name: 'Blumenkübel', price: 110, cozy: 3, cat: 'deko', w: 0.6, d: 0.6, blocking: true, desc: 'Bunte Blumen in einem Holzkübel.' },
  { id: 'neon', name: 'Neon-Herz', price: 380, cozy: 7, cat: 'deko', w: 0.8, d: 0.4, blocking: true, desc: 'Leuchtendes Neon-Herz auf einem Ständer.' },
  { id: 'jukebox', name: 'Retro-Jukebox', price: 780, cozy: 12, cat: 'deko', w: 0.9, d: 0.6, blocking: true, desc: 'Der Hingucker schlechthin.', minLevel: 0 },
  { id: 'aquarium', name: 'Aquarium', price: 620, cozy: 10, cat: 'deko', w: 1.2, d: 0.5, blocking: true, desc: 'Blubb. Fische beruhigen ungemein.' },
  { id: 'tortenvitrine', name: 'Tortenvitrine', price: 460, cozy: 6, cat: 'deko', w: 1.0, d: 0.6, blocking: true, desc: 'Sieht lecker aus. Ist nur Deko (pssst).' },
  { id: 'kaugummi', name: 'Kaugummi-Automat', price: 95, cozy: 2, cat: 'deko', w: 0.4, d: 0.4, blocking: true, desc: 'Nostalgie in Rot.' },
];
export const PLACEABLE_BY_ID = new Map(PLACEABLES.map((p) => [p.id, p]));

export const THEMES: ThemeOption[] = [
  { id: 'wall_creme', kind: 'wall', name: 'Wand: Creme', price: 0, cozy: 0, colors: [0xf6ead6, 0xe9d8bd] },
  { id: 'wall_rosa', kind: 'wall', name: 'Wand: Rosa', price: 160, cozy: 2, colors: [0xf8cfd8, 0xefb4c2] },
  { id: 'wall_mint', kind: 'wall', name: 'Wand: Mint', price: 160, cozy: 2, colors: [0xc9eedc, 0xaee0c8] },
  { id: 'wall_himmel', kind: 'wall', name: 'Wand: Himmelblau', price: 160, cozy: 2, colors: [0xcfe6f7, 0xb3d4ee] },
  { id: 'wall_lavendel', kind: 'wall', name: 'Wand: Lavendel', price: 200, cozy: 3, colors: [0xe0d4f5, 0xcbbbea] },
  { id: 'floor_holz', kind: 'floor', name: 'Boden: Helles Holz', price: 0, cozy: 0, colors: [0xd8b48a, 0xcda57a] },
  { id: 'floor_schach', kind: 'floor', name: 'Boden: Schachbrett', price: 260, cozy: 3, colors: [0xfaf6ee, 0x3f3a44] },
  { id: 'floor_terrazzo', kind: 'floor', name: 'Boden: Terrazzo', price: 320, cozy: 4, colors: [0xeee8e0, 0xf2a2b4, 0x9ad2c0] },
  { id: 'floor_rosa', kind: 'floor', name: 'Boden: Rosa Fliesen', price: 280, cozy: 4, colors: [0xf7d7de, 0xfbe9ec] },
  { id: 'awning_rosa', kind: 'awning', name: 'Markise: Rosa-Weiß', price: 0, cozy: 0, colors: [0xf28cab, 0xffffff] },
  { id: 'awning_mint', kind: 'awning', name: 'Markise: Mint-Weiß', price: 150, cozy: 2, colors: [0x7fd6b4, 0xffffff] },
  { id: 'awning_gelb', kind: 'awning', name: 'Markise: Gelb-Weiß', price: 150, cozy: 2, colors: [0xffd45e, 0xffffff] },
  { id: 'awning_blau', kind: 'awning', name: 'Markise: Blau-Weiß', price: 150, cozy: 2, colors: [0x6aa8e8, 0xffffff] },
];
export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

export const LICHTERKETTE = { id: 'lichterkette', name: 'Lichterkette', price: 240, cozy: 8 };

export interface LevelDef { w: number; d: number; rent: number; cost: number; name: string }
export const LEVELS: LevelDef[] = [
  { w: 12, d: 9, rent: 55, cost: 0, name: 'Kleiner Laden' },
  { w: 16, d: 11, rent: 130, cost: 3800, name: 'Gemütliches Café' },
  { w: 20, d: 13, rent: 240, cost: 9500, name: 'Süßkram-Paradies' },
];

/** Einkauf: Portionen pro Packung, Preis pro Packung */
export interface StockDef { id: string; name: string; pack: number; cost: number; color: number; group: string }

export function stockDefs(): StockDef[] {
  const out: StockDef[] = [];
  for (const f of FLAVORS) out.push({ id: 'froyo_' + f.id, name: 'Joghurt ' + f.name, pack: 20, cost: 22, color: f.color, group: 'Frozen Yogurt' });
  for (const w of WAFFLES) out.push({ id: 'waffle_' + w.id, name: w.name + ' (Teig)', pack: 15, cost: 15, color: w.color, group: 'Waffeln' });
  out.push({ id: 'coffee', name: 'Kaffeebohnen & Milch', pack: 25, cost: 14, color: 0x5a3a24, group: 'Kaffee' });
  for (const m of MATCHAS) out.push({ id: 'matcha_' + m.id, name: m.name + ' (Zutaten)', pack: 20, cost: 18, color: m.color, group: 'Matcha' });
  for (const t of TOPPINGS) out.push({ id: 'top_' + t.id, name: t.name, pack: 30, cost: t.fruit || t.id === 'sahne' ? 9 : 6, color: t.color, group: 'Toppings' });
  for (const d of DRINKS) out.push({ id: 'drink_' + d.id, name: d.name, pack: 12, cost: 12, color: d.color, group: 'Getränke' });
  return out;
}

export function stockIdFor(base: BaseKind, variant: string): string {
  if (base === 'froyo') return 'froyo_' + variant;
  if (base === 'waffle') return 'waffle_' + variant;
  if (base === 'matcha') return 'matcha_' + variant;
  return 'coffee';
}

export const FAIR_PRICE: Record<PriceCat, number> = {
  froyo: 4.5,
  waffle: 4.2,
  coffee: 3.0,
  matcha: 4.2,
  topping: 0.6,
  drink: 2.5,
};

export const PRICE_LABEL: Record<PriceCat, string> = {
  froyo: 'Frozen Yogurt (Becher)',
  waffle: 'Waffel',
  coffee: 'Kaffee & Kakao',
  matcha: 'Matcha-Drinks',
  topping: 'Pro Topping',
  drink: 'Getränk aus dem Kühlschrank',
};

export const LOAN_OFFERS = [
  { principal: 500, rate: 0.08, days: 5 },
  { principal: 1500, rate: 0.12, days: 8 },
  { principal: 4000, rate: 0.16, days: 12 },
  { principal: 8000, rate: 0.22, days: 16 },
];
