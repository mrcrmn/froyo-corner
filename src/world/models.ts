import * as THREE from 'three';
import { VB } from '../core/voxel';
import { BaseKind, TOPPING_BY_ID, VARIANT_BY_ID, DRINK_BY_ID } from '../data/catalog';
import { rand, pick } from '../core/util';

const WOOD = 0xb8875a;
const WOOD_D = 0x8c6239;
const STEEL = 0xc9ced6;
const STEEL_D = 0x9aa1ab;
const PINK = 0xf28cab;
const CREAM = 0xfff6e8;

/** Höhe der Thekenoberfläche */
export const COUNTER_H = 1.0;

// ---------------------------------------------------------------- Produkte

export function toppingVoxels(vb: VB, toppings: string[], cx: number, cy: number, cz: number, rx: number, rz: number): void {
  for (const id of toppings) {
    const t = TOPPING_BY_ID.get(id);
    if (!t) continue;
    const c2 = t.color2 ?? t.color;
    switch (t.shape) {
      case 'sprinkle':
        for (let i = 0; i < 9; i++) {
          vb.box(cx + rand(-rx, rx), cy + rand(0, 0.03), cz + rand(-rz, rz), 0.025, 0.018, 0.025, id === 'bunte' ? pick([0xff6fa8, 0x6fd6ff, 0xffe066, 0x8ef08a, 0xffffff]) : i % 2 ? t.color : c2, 'solid', 0.1);
        }
        break;
      case 'sauce':
        vb.box(cx, cy + 0.01, cz, rx * 1.6, 0.025, rz * 1.6, t.color, 'solid', 0.02);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + rand(0, 0.5);
          vb.box(cx + Math.cos(a) * rx * 0.95, cy - 0.03, cz + Math.sin(a) * rz * 0.95, 0.03, 0.07, 0.03, t.color, 'solid', 0.02);
        }
        break;
      case 'chunk':
        for (let i = 0; i < 4; i++) {
          vb.box(cx + rand(-rx, rx) * 0.8, cy + 0.02, cz + rand(-rz, rz) * 0.8, 0.045, 0.04, 0.045, i % 2 ? t.color : c2, 'solid', 0.08);
        }
        break;
      case 'dust':
        vb.box(cx, cy + 0.005, cz, rx * 1.8, 0.012, rz * 1.8, t.color, 'solid', 0.01);
        break;
      case 'blob':
        if (id === 'sahne') {
          vb.box(cx, cy + 0.03, cz, 0.09, 0.05, 0.09, t.color, 'solid', 0.01);
          vb.box(cx, cy + 0.07, cz, 0.05, 0.04, 0.05, t.color, 'solid', 0.01);
        } else {
          for (let i = 0; i < 5; i++) vb.box(cx + rand(-rx, rx) * 0.8, cy + 0.02, cz + rand(-rz, rz) * 0.8, 0.035, 0.035, 0.035, t.color, 'solid', 0.1);
        }
        break;
    }
    cy += 0.012;
  }
}

export function productModel(base: BaseKind | 'drink', variant: string, toppings: string[] = [], burnt = false): THREE.Group {
  const vb = new VB();
  if (base === 'froyo') {
    const col = VARIANT_BY_ID.get(variant)?.color ?? 0xffffff;
    // Becher
    vb.box(0, 0.07, 0, 0.2, 0.14, 0.2, 0xffffff);
    vb.box(0, 0.07, 0.101, 0.2, 0.05, 0.002, PINK, 'solid', 0);
    vb.box(0, 0.07, -0.101, 0.2, 0.05, 0.002, PINK, 'solid', 0);
    // Swirl
    vb.box(0, 0.16, 0, 0.19, 0.05, 0.19, col);
    vb.box(0, 0.2, 0, 0.14, 0.04, 0.14, col);
    vb.box(0, 0.235, 0, 0.08, 0.035, 0.08, col);
    vb.box(0.01, 0.265, 0, 0.03, 0.03, 0.03, col);
    toppingVoxels(vb, toppings, 0, 0.23, 0, 0.07, 0.07);
    vb.box(0.07, 0.29, 0.03, 0.015, 0.12, 0.015, PINK, 'solid', 0); // Löffel
  } else if (base === 'waffle') {
    const col = burnt ? 0x2a1d17 : VARIANT_BY_ID.get(variant)?.color ?? 0xe9b86c;
    vb.box(0, 0.01, 0, 0.36, 0.02, 0.28, 0xffffff);
    vb.box(0, 0.045, 0, 0.3, 0.05, 0.22, col);
    const dark = new THREE.Color(col).multiplyScalar(0.75).getHex();
    for (let i = -1; i <= 1; i++) {
      vb.box(i * 0.08, 0.072, 0, 0.012, 0.006, 0.22, dark, 'solid', 0);
      vb.box(0, 0.072, i * 0.065, 0.3, 0.006, 0.012, dark, 'solid', 0);
    }
    if (burnt) {
      vb.box(0.05, 0.12, 0, 0.04, 0.06, 0.04, 0x555555, 'solid', 0.2);
      vb.box(0.07, 0.18, 0.01, 0.03, 0.05, 0.03, 0x777777, 'solid', 0.2);
    }
    toppingVoxels(vb, toppings, 0, 0.075, 0, 0.12, 0.09);
  } else if (base === 'coffee') {
    const col = VARIANT_BY_ID.get(variant)?.color ?? 0x3b2416;
    const tall = variant === 'latte';
    vb.box(0, 0.008, 0, 0.2, 0.016, 0.2, 0xffffff);
    if (tall) {
      vb.box(0, 0.12, 0, 0.11, 0.22, 0.11, 0xeaf6fb, 'glass');
      vb.box(0, 0.08, 0, 0.1, 0.13, 0.1, 0xb98a5e);
      vb.box(0, 0.2, 0, 0.1, 0.05, 0.1, 0xfff6e8);
    } else {
      const h = variant === 'espresso' ? 0.07 : 0.11;
      vb.box(0, 0.016 + h / 2, 0, 0.13, h, 0.13, 0xffffff);
      vb.box(0, 0.016 + h - 0.005, 0, 0.11, 0.012, 0.11, col);
      vb.box(0.085, 0.016 + h / 2, 0, 0.03, 0.05, 0.02, 0xffffff);
      if (variant === 'cappuccino' || variant === 'kakao') vb.box(0, 0.016 + h + 0.004, 0, 0.06, 0.006, 0.06, 0xffffff, 'solid', 0);
    }
  } else if (base === 'matcha') {
    const v = VARIANT_BY_ID.get(variant);
    const green = v?.color ?? 0x8fbf5a;
    const layer = v?.layer ?? 0xf4f1e6;
    vb.box(0, 0.13, 0, 0.13, 0.26, 0.13, 0xeaf6fb, 'glass');
    vb.box(0, 0.045, 0, 0.115, 0.08, 0.115, layer);
    vb.box(0, 0.115, 0, 0.115, 0.06, 0.115, new THREE.Color(layer).lerp(new THREE.Color(green), 0.5).getHex());
    vb.box(0, 0.18, 0, 0.115, 0.07, 0.115, green);
    vb.box(0.03, 0.12, 0.03, 0.04, 0.04, 0.04, 0xeef9ff, 'solid', 0); // Eiswürfel
    vb.box(-0.025, 0.2, -0.02, 0.012, 0.18, 0.012, 0x3fa66a, 'solid', 0); // Strohhalm
  } else {
    const col = DRINK_BY_ID.get(variant)?.color ?? 0xffffff;
    vb.box(0, 0.1, 0, 0.09, 0.2, 0.09, col);
    vb.box(0, 0.1, 0, 0.095, 0.07, 0.095, 0xffffff);
    vb.box(0, 0.225, 0, 0.05, 0.05, 0.05, col);
    vb.box(0, 0.255, 0, 0.055, 0.015, 0.055, 0xd0d0d0);
  }
  return vb.build({ shadow: false });
}

export function spoonModel(): THREE.Group {
  const vb = new VB();
  vb.box(0, 0.18, 0, 0.04, 0.32, 0.03, 0xe0e4ea);
  vb.box(0, 0.38, 0, 0.12, 0.12, 0.04, 0xd5dae2);
  return vb.build({ shadow: false });
}

// ---------------------------------------------------------------- Stationen

export function cabinet(vb: VB, w: number, d: number, color = 0xfff1f4): void {
  vb.box(0, 0.45, 0, w, 0.9, d, color);
  vb.box(0, 0.92, 0, w + 0.04, 0.05, d + 0.04, 0xf3f3f3);
  vb.box(0, 0.05, 0.01, w - 0.04, 0.1, d - 0.02, 0x9a8a8a);
  vb.box(-w / 4, 0.5, d / 2 + 0.005, 0.02, 0.2, 0.01, STEEL_D);
  vb.box(w / 4, 0.5, d / 2 + 0.005, 0.02, 0.2, 0.01, STEEL_D);
}

export function zapferModel(flavorColors: number[]): THREE.Group {
  const vb = new VB();
  cabinet(vb, 1.0, 0.7);
  // Maschine
  vb.box(0, 1.45, -0.05, 0.85, 1.0, 0.55, STEEL);
  vb.box(0, 1.98, -0.05, 0.9, 0.08, 0.6, STEEL_D);
  vb.box(0, 1.7, 0.23, 0.7, 0.3, 0.02, 0xffffff);
  vb.box(0, 1.7, 0.24, 0.6, 0.06, 0.01, PINK, 'glow');
  const n = Math.max(1, flavorColors.length);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.24;
    vb.box(x, 1.5, 0.27, 0.12, 0.12, 0.14, flavorColors[i] ?? 0xffffff);
    vb.box(x, 1.38, 0.3, 0.06, 0.1, 0.06, STEEL_D);
    vb.box(x, 1.62, 0.33, 0.04, 0.14, 0.04, 0x333333); // Hebel
  }
  vb.box(0, 1.0, 0.22, 0.7, 0.04, 0.12, STEEL_D); // Abtropfgitter
  // Becherstapel
  for (let i = 0; i < 4; i++) vb.box(0.42, 1.0 + i * 0.06, 0.18, 0.16, 0.06, 0.16, i % 2 ? 0xffffff : PINK);
  return vb.build();
}

export function eismaschineModel(flavorColors: number[]): THREE.Group {
  const vb = new VB();
  cabinet(vb, 1.0, 0.7, 0xe7f6f0);
  vb.box(0, 1.4, -0.05, 0.85, 0.9, 0.55, 0xffb3c6);
  vb.box(0, 1.88, -0.05, 0.75, 0.1, 0.5, 0xffffff);
  vb.box(0, 1.98, -0.05, 0.5, 0.1, 0.35, 0xffb3c6);
  vb.box(0, 1.65, 0.23, 0.6, 0.18, 0.02, 0xfff6c2, 'glow');
  const n = Math.max(1, flavorColors.length);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.17;
    vb.box(x, 1.4, 0.27, 0.1, 0.1, 0.1, flavorColors[i] ?? 0xffffff);
    vb.box(x, 1.3, 0.29, 0.05, 0.08, 0.05, STEEL);
  }
  vb.box(0, 1.0, 0.22, 0.75, 0.04, 0.12, STEEL_D);
  return vb.build();
}

export interface WaffleIronParts { group: THREE.Group; lamp: THREE.Mesh; lid: THREE.Object3D }

export function waffleIronModel(): WaffleIronParts {
  const vb = new VB();
  cabinet(vb, 1.0, 0.7, 0xfff4dc);
  vb.box(0, 1.02, 0, 0.6, 0.12, 0.5, 0x3a3a3a);
  vb.box(0, 1.0, 0.28, 0.2, 0.05, 0.12, 0x222222);
  vb.box(-0.38, 1.06, 0.15, 0.1, 0.1, 0.1, 0xffffff); // Teigschüssel
  vb.box(-0.38, 1.1, 0.15, 0.08, 0.02, 0.08, 0xf2d49b);
  const group = vb.build();
  const lidVb = new VB();
  lidVb.box(0, 0.05, 0.25, 0.6, 0.1, 0.5, 0x444444);
  lidVb.box(0, 0.1, 0.52, 0.12, 0.05, 0.08, 0x222222);
  const lid = lidVb.build();
  lid.position.set(0, 1.08, -0.25);
  group.add(lid);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.03), new THREE.MeshBasicMaterial({ color: 0x55ff77 }));
  lamp.position.set(0.24, 1.0, 0.36);
  group.add(lamp);
  return { group, lamp, lid };
}

export function coffeeModel(): THREE.Group {
  const vb = new VB();
  cabinet(vb, 1.0, 0.7, 0xe9e1f7);
  vb.box(0, 1.3, -0.08, 0.75, 0.6, 0.45, 0xd23d4a);
  vb.box(0, 1.62, -0.08, 0.78, 0.05, 0.48, STEEL);
  vb.box(0, 1.22, 0.16, 0.6, 0.15, 0.06, STEEL);
  vb.box(-0.15, 1.12, 0.22, 0.08, 0.06, 0.12, 0x222222);
  vb.box(0.15, 1.12, 0.22, 0.08, 0.06, 0.12, 0x222222);
  vb.box(0.15, 1.12, 0.33, 0.04, 0.04, 0.14, 0x222222);
  vb.box(0.3, 1.45, 0.16, 0.06, 0.06, 0.02, 0xfff2a8, 'glow');
  // Tassen oben
  for (let i = 0; i < 3; i++) vb.box(-0.25 + i * 0.18, 1.69, -0.08, 0.1, 0.08, 0.1, 0xffffff);
  vb.box(-0.35, 1.0, 0.22, 0.12, 0.04, 0.12, STEEL_D);
  return vb.build();
}

export function matchaBarModel(): THREE.Group {
  const vb = new VB();
  cabinet(vb, 1.0, 0.7, 0xe3f1d8);
  vb.box(0, 1.0, 0, 0.9, 0.04, 0.5, 0xc9a873); // Bambusmatte
  vb.box(-0.25, 1.07, 0.05, 0.2, 0.1, 0.2, 0x5f7f4f); // Schale
  vb.box(-0.25, 1.11, 0.05, 0.16, 0.02, 0.16, 0x8fbf5a);
  vb.box(0.0, 1.1, 0.05, 0.06, 0.16, 0.06, 0xd9c08a); // Besen
  vb.box(0.0, 1.2, 0.05, 0.08, 0.06, 0.08, 0xc9a873);
  vb.box(0.28, 1.12, -0.08, 0.16, 0.2, 0.16, 0x4a6b3a); // Matcha-Dose
  vb.box(0.28, 1.23, -0.08, 0.17, 0.03, 0.17, 0xd4af37);
  vb.box(0.28, 1.12, 0.002, 0.1, 0.06, 0.005, 0xfff6e8, 'solid', 0);
  vb.box(0.15, 1.1, 0.18, 0.1, 0.16, 0.1, 0xffffff); // Milchkännchen
  vb.box(-0.4, 1.3, -0.2, 0.1, 0.5, 0.1, 0x6aa84f); // Bambus-Deko
  vb.box(-0.4, 1.6, -0.2, 0.06, 0.2, 0.06, 0x7fbf5f);
  return vb.build();
}

export function trashModel(): THREE.Group {
  const vb = new VB();
  vb.box(0, 0.4, 0, 0.5, 0.8, 0.5, 0x7fd6b4);
  vb.box(0, 0.82, 0, 0.54, 0.06, 0.54, 0x5fb894);
  vb.box(0, 0.4, 0.251, 0.2, 0.2, 0.01, 0xffffff);
  return vb.build();
}

export function storageFridgeModel(): THREE.Group {
  const vb = new VB();
  vb.box(0, 1.0, 0, 0.95, 2.0, 0.7, 0xe8edf2);
  vb.box(0, 1.0, 0.351, 0.02, 1.9, 0.01, 0xb8c0c8);
  vb.box(-0.08, 1.2, 0.36, 0.04, 0.4, 0.04, STEEL_D);
  vb.box(0.08, 1.2, 0.36, 0.04, 0.4, 0.04, STEEL_D);
  vb.box(0.3, 1.75, 0.355, 0.2, 0.12, 0.01, 0x7fd6b4, 'glow');
  // Magnete
  vb.box(-0.3, 1.5, 0.36, 0.08, 0.08, 0.01, 0xffd45e);
  vb.box(-0.25, 1.3, 0.36, 0.1, 0.06, 0.01, PINK);
  return vb.build();
}

export function drinksFridgeModel(colors: number[]): THREE.Group {
  const vb = new VB();
  vb.box(0, 1.0, -0.05, 0.9, 2.0, 0.6, 0x3d7fd6);
  vb.box(0, 1.9, 0.26, 0.86, 0.18, 0.02, 0xffffff, 'glow');
  vb.box(0, 1.0, 0.255, 0.78, 1.55, 0.01, 0xdff4ff, 'glass');
  for (let s = 0; s < 4; s++) {
    const y = 0.35 + s * 0.38;
    vb.box(0, y - 0.02, 0, 0.76, 0.02, 0.45, 0xdddddd);
    for (let i = 0; i < 5; i++) {
      const c = colors.length ? colors[(i + s) % colors.length] : 0xffffff;
      vb.box(-0.3 + i * 0.15, y + 0.11, 0.08, 0.08, 0.22, 0.08, c, 'solid', 0.06);
    }
  }
  vb.box(0, 1.0, 0.24, 0.8, 1.6, 0.005, 0xbfe8ff, 'glow', 0);
  return vb.build();
}

export function registerModel(): THREE.Group {
  const vb = new VB();
  vb.box(0, 0.08, 0, 0.45, 0.16, 0.38, 0x6d5a7a);
  vb.box(0, 0.25, -0.05, 0.36, 0.2, 0.06, 0x3a3346);
  vb.box(0, 0.26, -0.015, 0.3, 0.13, 0.01, 0x9ff0c4, 'glow');
  vb.box(0, 0.17, 0.08, 0.3, 0.02, 0.14, 0xdddddd);
  // Klingel
  vb.box(0.32, 0.03, 0.1, 0.12, 0.04, 0.12, 0x333333);
  vb.box(0.32, 0.08, 0.1, 0.08, 0.06, 0.08, 0xf2c14e);
  return vb.build();
}

export function toppingBarModel(colors: number[], width: number): THREE.Group {
  const vb = new VB();
  vb.box(0, 0.03, 0, width, 0.06, 0.55, STEEL);
  // Glas-Spuckschutz
  vb.box(0, 0.35, 0.22, width, 0.02, 0.2, 0xdff4ff, 'glass');
  vb.box(-width / 2 + 0.02, 0.2, 0.22, 0.03, 0.32, 0.03, STEEL_D);
  vb.box(width / 2 - 0.02, 0.2, 0.22, 0.03, 0.32, 0.03, STEEL_D);
  const n = colors.length;
  const cols = Math.ceil(n / 2);
  const step = Math.min(0.3, (width - 0.1) / Math.max(1, cols));
  for (let i = 0; i < n; i++) {
    const row = i % 2;
    const ci = Math.floor(i / 2);
    const x = (ci - (cols - 1) / 2) * step;
    const z = row ? 0.12 : -0.12;
    vb.box(x, 0.09, z, step * 0.85, 0.06, 0.2, 0xffffff);
    vb.box(x, 0.125, z, step * 0.72, 0.02, 0.16, colors[i], 'solid', 0.05);
  }
  return vb.build();
}

// ---------------------------------------------------------------- Möbel & Deko

export function placeableModel(type: string): THREE.Group {
  const vb = new VB();
  switch (type) {
    case 'stuhl':
      vb.box(0, 0.45, 0, 0.45, 0.06, 0.45, WOOD);
      for (const [x, z] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) vb.box(x, 0.22, z, 0.06, 0.44, 0.06, WOOD_D);
      vb.box(0, 0.78, -0.2, 0.45, 0.4, 0.05, WOOD);
      vb.box(0, 0.75, -0.2, 0.3, 0.12, 0.06, 0xfff1e0);
      break;
    case 'polsterstuhl':
      vb.box(0, 0.45, 0, 0.5, 0.12, 0.5, 0xf6a2b8);
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) vb.box(x, 0.2, z, 0.05, 0.4, 0.05, 0xd4af37);
      vb.box(0, 0.82, -0.22, 0.5, 0.5, 0.1, 0xf6a2b8);
      vb.box(0, 0.82, -0.17, 0.36, 0.36, 0.02, 0xfbc6d4);
      break;
    case 'hocker':
      vb.box(0, 0.5, 0, 0.4, 0.07, 0.4, 0x7fd6b4);
      vb.box(0, 0.25, 0, 0.08, 0.5, 0.08, STEEL_D);
      vb.box(0, 0.02, 0, 0.32, 0.04, 0.32, STEEL_D);
      break;
    case 'bistrotisch':
      vb.box(0, 0.75, 0, 0.8, 0.05, 0.8, 0xfaf7f2);
      vb.box(0, 0.73, 0, 0.84, 0.03, 0.84, 0xd4af37);
      vb.box(0, 0.37, 0, 0.08, 0.72, 0.08, 0x3a3a3a);
      vb.box(0, 0.02, 0, 0.45, 0.04, 0.45, 0x3a3a3a);
      vb.box(0.15, 0.82, 0.1, 0.08, 0.1, 0.08, 0xffffff);
      vb.box(0.15, 0.9, 0.1, 0.05, 0.08, 0.05, 0xff8fb0);
      break;
    case 'tisch':
      vb.box(0, 0.75, 0, 1.6, 0.06, 0.9, WOOD);
      for (const [x, z] of [[-0.72, -0.37], [0.72, -0.37], [-0.72, 0.37], [0.72, 0.37]]) vb.box(x, 0.36, z, 0.08, 0.72, 0.08, WOOD_D);
      vb.box(0, 0.785, 0, 0.5, 0.01, 0.9, 0xf2f0e6);
      vb.box(0.4, 0.84, 0, 0.1, 0.1, 0.1, 0x9ad2c0);
      vb.box(0.4, 0.92, 0, 0.05, 0.08, 0.05, 0xffd45e);
      break;
    case 'plant':
      vb.box(0, 0.2, 0, 0.36, 0.4, 0.36, 0xd98c5f);
      vb.box(0, 0.41, 0, 0.32, 0.03, 0.32, 0x5a3a24);
      for (let i = 0; i < 6; i++) vb.box(rand(-0.15, 0.15), 0.55 + rand(0, 0.3), rand(-0.15, 0.15), 0.18, 0.16, 0.18, i % 2 ? 0x4caf50 : 0x6cc56f, 'solid', 0.1);
      break;
    case 'kaktus':
      vb.box(0, 0.12, 0, 0.26, 0.24, 0.26, 0xf28cab);
      vb.box(0, 0.42, 0, 0.12, 0.38, 0.12, 0x3f9b5a);
      vb.box(0.1, 0.45, 0, 0.08, 0.06, 0.06, 0x3f9b5a);
      vb.box(0.13, 0.52, 0, 0.06, 0.12, 0.06, 0x3f9b5a);
      vb.box(0, 0.63, 0, 0.06, 0.04, 0.06, 0xff6fa8);
      break;
    case 'monstera':
      vb.box(0, 0.25, 0, 0.5, 0.5, 0.5, 0xfaf6ee);
      vb.box(0, 0.48, 0, 0.44, 0.03, 0.44, 0x5a3a24);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = rand(0.15, 0.35);
        vb.box(Math.cos(a) * r, 0.75 + rand(0, 0.7), Math.sin(a) * r, 0.3, 0.05, 0.25, i % 2 ? 0x2e8b57 : 0x3fa66a, 'solid', 0.1);
        vb.box(Math.cos(a) * r * 0.5, 0.65 + rand(0, 0.4), Math.sin(a) * r * 0.5, 0.03, 0.4, 0.03, 0x2e7d4f);
      }
      break;
    case 'stehlampe':
      vb.box(0, 0.03, 0, 0.36, 0.06, 0.36, 0x3a3a3a);
      vb.box(0, 0.8, 0, 0.05, 1.5, 0.05, 0xd4af37);
      vb.box(0, 1.62, 0, 0.5, 0.35, 0.5, 0xfff1c9);
      vb.box(0, 1.48, 0, 0.3, 0.06, 0.3, 0xffe9a8, 'glow');
      break;
    case 'teppich':
      vb.box(0, 0.012, 0, 2.0, 0.02, 1.4, 0xf6c1cf, 'solid', 0.02);
      vb.box(0, 0.024, 0, 1.6, 0.01, 1.0, 0xfde6ec, 'solid', 0.02);
      vb.box(0, 0.03, 0, 0.9, 0.01, 0.5, 0xb9e6d4, 'solid', 0.02);
      for (let i = 0; i < 10; i++) vb.box(-0.95 + i * 0.21, 0.012, 0.72, 0.06, 0.015, 0.06, 0xffffff, 'solid', 0);
      break;
    case 'regal':
      vb.box(0, 0.9, -0.05, 1.4, 1.8, 0.4, WOOD_D);
      vb.box(0, 0.9, 0.0, 1.3, 1.7, 0.36, 0x6e4a2c);
      for (let s = 0; s < 4; s++) {
        const y = 0.15 + s * 0.42;
        vb.box(0, y, 0.02, 1.3, 0.03, 0.36, WOOD);
        let x = -0.6;
        while (x < 0.55) {
          const w = rand(0.05, 0.1);
          const h = rand(0.22, 0.32);
          vb.box(x + w / 2, y + h / 2 + 0.015, 0.03, w, h, 0.26, pick([0xe84855, 0x4d9de0, 0xffd45e, 0x7fd6b4, 0xf28cab, 0xb48cf2, 0xfff6e8]), 'solid', 0.05);
          x += w + 0.01;
        }
      }
      break;
    case 'sitzsack':
      vb.box(0, 0.18, 0, 0.75, 0.36, 0.75, 0xb48cf2, 'solid', 0.03);
      vb.box(0, 0.4, -0.1, 0.6, 0.2, 0.5, 0xc4a2f6, 'solid', 0.03);
      vb.box(0, 0.5, -0.28, 0.6, 0.2, 0.2, 0xb48cf2, 'solid', 0.03);
      break;
    case 'blumen':
      vb.box(0, 0.22, 0, 0.55, 0.44, 0.55, WOOD);
      vb.box(0, 0.45, 0, 0.5, 0.03, 0.5, 0x5a3a24);
      for (let i = 0; i < 10; i++) {
        const x = rand(-0.2, 0.2), z = rand(-0.2, 0.2), h = rand(0.15, 0.4);
        vb.box(x, 0.46 + h / 2, z, 0.03, h, 0.03, 0x4caf50);
        vb.box(x, 0.48 + h, z, 0.1, 0.08, 0.1, pick([0xff6fa8, 0xffd45e, 0xffffff, 0xb48cf2, 0xff8c5a]), 'solid', 0.05);
      }
      break;
    case 'neon':
      vb.box(0, 0.03, 0, 0.6, 0.06, 0.3, 0x3a3a3a);
      vb.box(0, 0.6, 0, 0.04, 1.1, 0.04, 0x3a3a3a);
      vb.box(0, 1.35, 0, 0.8, 0.7, 0.04, 0x2b2533);
      {
        const heart = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
        heart.forEach((row, r) => [...row].forEach((ch, c) => {
          if (ch === 'X') vb.box((c - 3) * 0.08, 1.58 - r * 0.08, 0.03, 0.07, 0.07, 0.02, 0xff5fa2, 'glow', 0);
        }));
      }
      break;
    case 'jukebox':
      vb.box(0, 0.6, 0, 0.9, 1.2, 0.6, 0xc0392b);
      vb.box(0, 1.35, 0, 0.8, 0.3, 0.55, 0xc0392b);
      vb.box(0, 1.5, 0, 0.5, 0.15, 0.5, 0xd4af37);
      vb.box(0, 0.95, 0.31, 0.6, 0.4, 0.02, 0xfff2a8, 'glow');
      vb.box(0, 0.45, 0.31, 0.7, 0.3, 0.02, 0x2b2b2b);
      for (let i = 0; i < 5; i++) vb.box(-0.28 + i * 0.14, 0.45, 0.33, 0.08, 0.2, 0.01, pick([0xff6fa8, 0x6fd6ff, 0xffe066, 0x8ef08a]), 'glow', 0);
      vb.box(-0.4, 0.7, 0.31, 0.06, 1.0, 0.02, 0xff9ff3, 'glow');
      vb.box(0.4, 0.7, 0.31, 0.06, 1.0, 0.02, 0xff9ff3, 'glow');
      break;
    case 'aquarium':
      vb.box(0, 0.35, 0, 1.2, 0.7, 0.5, WOOD_D);
      vb.box(0, 0.98, 0, 1.15, 0.55, 0.45, 0x6fd6ff, 'glass');
      vb.box(0, 0.75, 0, 1.1, 0.06, 0.4, 0xf2e2b0);
      vb.box(-0.3, 0.85, 0, 0.05, 0.25, 0.05, 0x3fa66a);
      vb.box(0.35, 0.82, 0.05, 0.05, 0.18, 0.05, 0x3fa66a);
      vb.box(-0.1, 1.0, 0.05, 0.1, 0.06, 0.03, 0xff8c2e, 'glow');
      vb.box(0.2, 1.1, -0.05, 0.08, 0.05, 0.03, 0xffe066, 'glow');
      vb.box(0.0, 0.9, -0.1, 0.07, 0.05, 0.03, 0x6fa8ff, 'glow');
      vb.box(0, 1.28, 0, 1.2, 0.05, 0.5, 0x3a3a3a);
      break;
    case 'tortenvitrine':
      vb.box(0, 0.45, 0, 1.0, 0.9, 0.6, 0xfff6e8);
      vb.box(0, 1.15, 0, 0.98, 0.5, 0.58, 0xeaf6fb, 'glass');
      vb.box(0, 0.92, 0, 0.95, 0.03, 0.55, 0xffffff);
      for (let i = 0; i < 3; i++) {
        const x = -0.3 + i * 0.3;
        vb.box(x, 1.02, 0, 0.22, 0.16, 0.22, pick([0xf6a2b8, 0x8c5a3c, 0xfbe7a8, 0xb8d99a]));
        vb.box(x, 1.11, 0, 0.22, 0.03, 0.22, 0xffffff);
        vb.box(x, 1.14, 0, 0.04, 0.04, 0.04, 0xe6323e);
      }
      vb.box(0, 1.42, 0, 1.0, 0.04, 0.6, 0xf28cab);
      break;
    case 'kaugummi':
      vb.box(0, 0.35, 0, 0.12, 0.7, 0.12, 0xc0392b);
      vb.box(0, 0.75, 0, 0.3, 0.12, 0.3, 0xc0392b);
      vb.box(0, 0.98, 0, 0.32, 0.34, 0.32, 0xeaf6fb, 'glass');
      for (let i = 0; i < 12; i++) vb.box(rand(-0.11, 0.11), rand(0.84, 1.08), rand(-0.11, 0.11), 0.06, 0.06, 0.06, pick([0xff6fa8, 0x6fd6ff, 0xffe066, 0x8ef08a, 0xffffff]), 'solid', 0);
      vb.box(0, 1.17, 0, 0.18, 0.06, 0.18, 0xc0392b);
      break;
    default:
      vb.box(0, 0.25, 0, 0.5, 0.5, 0.5, 0xff00ff);
  }
  return vb.build();
}

export function menuBoardModel(lines: { text: string; price: string }[], title: string): THREE.Mesh {
  const W = 256, H = 192;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#2f3b36';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c99b63';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.fillStyle = '#ffd6e2';
  ctx.font = 'bold 20px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(title, W / 2, 30);
  ctx.font = '14px "Pixelify Sans", monospace';
  lines.slice(0, 8).forEach((l, i) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f5f1e6';
    ctx.fillText(l.text, 16, 56 + i * 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#b8f0d4';
    ctx.fillText(l.price, W - 16, 56 + i * 17);
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ map: tex }));
  return mesh;
}

export function signTexture(text: string, bg = '#fff6e8', fg = '#e2557e'): THREE.CanvasTexture {
  const W = 512, H = 96;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg;
  ctx.font = 'bold 54px "Pixelify Sans", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 3);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export { WOOD, WOOD_D, STEEL, STEEL_D, PINK, CREAM };
