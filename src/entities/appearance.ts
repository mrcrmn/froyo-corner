import { pick, chance, rand } from '../core/util';

export const SKIN_TONES = [0xffe0c7, 0xf6cfae, 0xe8b48f, 0xc98e66, 0xa36a45, 0x7a4b2e, 0x5a3622];
export const HAIR_COLORS = [0x2b1d14, 0x4a2f1f, 0x7b4a26, 0xb57a3e, 0xe6c27a, 0xf1e1b0, 0xd9d9d9, 0x8a3324, 0xe86fa0, 0x6fa8ff, 0x9a7be0, 0x111111];
export const CLOTH_COLORS = [
  0xf28cab, 0x7fd6b4, 0xffd45e, 0x6aa8e8, 0xff8c5a, 0xb48cf2, 0xffffff, 0x2f3542, 0xe84855, 0x3bb273,
  0x4d9de0, 0xf6e3c6, 0x8d6e63, 0xa3c4f3, 0xffb7c5, 0x96e6a1, 0x355070, 0xeaac8b, 0x6d597a, 0xfafafa,
];
export const PANTS_COLORS = [0x3a4a6b, 0x2b2b2b, 0x6b4f3a, 0xc7b299, 0x5b6f8f, 0x8f9aa8, 0x7a2e3a, 0x2e5e4e, 0xe9e1d3, 0x4b3b6b];
export const SHOE_COLORS = [0xffffff, 0x222222, 0x8b4a2b, 0xe84855, 0x4d9de0, 0xf2c14e, 0xf28cab];

export const HAIR_STYLES = ['kurz', 'lang', 'dutt', 'locken', 'irokese', 'glatze', 'pony', 'zoepfe'] as const;
export const HATS = ['kein', 'cap', 'muetze', 'zylinder', 'fischerhut', 'cowboy', 'kopfhoerer', 'blume', 'baskenmuetze'] as const;
export const SHIRTS = ['tshirt', 'streifen', 'hemd', 'hoodie', 'kleid', 'pulli', 'latzhose'] as const;
export const PANTS = ['lang', 'kurz', 'rock'] as const;
export const GLASSES = ['keine', 'rund', 'sonne', 'eckig'] as const;
export const ACCESSORIES = ['keins', 'rucksack', 'schal', 'tasche', 'kette', 'schuerze', 'fliege'] as const;

export type HairStyle = (typeof HAIR_STYLES)[number];
export type Hat = (typeof HATS)[number];
export type Shirt = (typeof SHIRTS)[number];
export type Pants = (typeof PANTS)[number];
export type Glasses = (typeof GLASSES)[number];
export type Accessory = (typeof ACCESSORIES)[number];

export interface Appearance {
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  hat: Hat;
  hatColor: number;
  shirt: Shirt;
  shirtColor: number;
  shirtColor2: number;
  pants: Pants;
  pantsColor: number;
  shoes: number;
  glasses: Glasses;
  beard: boolean;
  accessory: Accessory;
  accessoryColor: number;
  height: number;
  width: number;
  kid?: boolean;
}

export const LABELS: Record<string, string> = {
  kurz: 'Kurz', lang: 'Lang', dutt: 'Dutt', locken: 'Locken', irokese: 'Irokese', glatze: 'Glatze', pony: 'Pony', zoepfe: 'Zöpfe',
  kein: 'Kein Hut', cap: 'Cap', muetze: 'Mütze', zylinder: 'Zylinder', fischerhut: 'Fischerhut', cowboy: 'Cowboyhut', kopfhoerer: 'Kopfhörer', blume: 'Blume', baskenmuetze: 'Baskenmütze',
  tshirt: 'T-Shirt', streifen: 'Ringelshirt', hemd: 'Hemd', hoodie: 'Hoodie', kleid: 'Kleid', pulli: 'Pulli', latzhose: 'Latzhose',
  rock: 'Rock', keine: 'Keine', rund: 'Rund', sonne: 'Sonnenbrille', eckig: 'Eckig',
  keins: 'Keins', rucksack: 'Rucksack', schal: 'Schal', tasche: 'Tasche', kette: 'Kette', schuerze: 'Schürze', fliege: 'Fliege',
};

export function randomAppearance(opts: { kid?: boolean; old?: boolean } = {}): Appearance {
  const old = !!opts.old;
  const kid = !!opts.kid;
  const hairStyle: HairStyle = old ? pick(['kurz', 'dutt', 'glatze', 'locken'] as const) : pick(HAIR_STYLES);
  const hat: Hat = chance(old ? 0.45 : 0.38) ? pick(HATS.filter((h) => h !== 'kein')) : 'kein';
  const shirt: Shirt = pick(SHIRTS);
  return {
    skin: pick(SKIN_TONES),
    hairStyle,
    hairColor: old ? pick([0xd9d9d9, 0xeeeeee, 0xb0b0b0]) : pick(HAIR_COLORS),
    hat,
    hatColor: pick(CLOTH_COLORS),
    shirt,
    shirtColor: pick(CLOTH_COLORS),
    shirtColor2: pick(CLOTH_COLORS),
    pants: shirt === 'kleid' ? 'rock' : chance(0.15) ? 'rock' : chance(0.25) ? 'kurz' : 'lang',
    pantsColor: pick(PANTS_COLORS),
    shoes: pick(SHOE_COLORS),
    glasses: chance(old ? 0.6 : 0.28) ? pick(GLASSES.filter((g) => g !== 'keine')) : 'keine',
    beard: !kid && chance(0.18),
    accessory: chance(0.45) ? pick(ACCESSORIES.filter((a) => a !== 'keins' && a !== 'schuerze')) : 'keins',
    accessoryColor: pick(CLOTH_COLORS),
    height: kid ? rand(0.66, 0.74) : rand(0.93, 1.07),
    width: kid ? 0.95 : rand(0.92, 1.1),
    kid,
  };
}

export function defaultPlayer(): Appearance {
  return {
    skin: SKIN_TONES[1],
    hairStyle: 'kurz',
    hairColor: HAIR_COLORS[2],
    hat: 'cap',
    hatColor: 0xf28cab,
    shirt: 'tshirt',
    shirtColor: 0xffffff,
    shirtColor2: 0xf28cab,
    pants: 'lang',
    pantsColor: PANTS_COLORS[0],
    shoes: 0xffffff,
    glasses: 'keine',
    beard: false,
    accessory: 'schuerze',
    accessoryColor: 0xf28cab,
    height: 1,
    width: 1,
  };
}

export function thiefAppearance(): Appearance {
  return {
    skin: pick(SKIN_TONES),
    hairStyle: 'kurz',
    hairColor: 0x222222,
    hat: 'muetze',
    hatColor: 0x2b2b2b,
    shirt: 'streifen',
    shirtColor: 0x222222,
    shirtColor2: 0xf2f2f2,
    pants: 'lang',
    pantsColor: 0x2b2b2b,
    shoes: 0x222222,
    glasses: 'sonne',
    beard: chance(0.5),
    accessory: 'tasche',
    accessoryColor: 0x6b4f3a,
    height: 0.97,
    width: 1,
  };
}
