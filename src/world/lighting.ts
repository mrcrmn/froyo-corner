import * as THREE from 'three';
import { clamp, lerp } from '../core/util';

const SKY_KEYS: [number, number, number, number][] = [
  // Stunde, Himmel, Sonnenfarbe, Intensität
  [6, 0x2b3a67, 0xff9e6b, 0.2],
  [8, 0xffc9a8, 0xffd6a5, 1.3],
  [11, 0x9fd3ff, 0xfff4e0, 2.0],
  [15, 0xa8d8ff, 0xfff0d6, 1.9],
  [17.5, 0xffb98a, 0xffb27a, 1.4],
  [19, 0xe0789a, 0xff8a65, 0.7],
  [20.5, 0x2a2f5c, 0x8a8fd6, 0.15],
  [24, 0x141834, 0x6070c0, 0.1],
];

function sample(h: number): { sky: THREE.Color; sun: THREE.Color; i: number } {
  let a = SKY_KEYS[0], b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let k = 0; k < SKY_KEYS.length - 1; k++) {
    if (h >= SKY_KEYS[k][0] && h <= SKY_KEYS[k + 1][0]) { a = SKY_KEYS[k]; b = SKY_KEYS[k + 1]; break; }
  }
  if (h < SKY_KEYS[0][0]) { a = b = SKY_KEYS[0]; }
  const t = a === b ? 0 : (h - a[0]) / (b[0] - a[0]);
  return {
    sky: new THREE.Color(a[1]).lerp(new THREE.Color(b[1]), t),
    sun: new THREE.Color(a[2]).lerp(new THREE.Color(b[2]), t),
    i: lerp(a[3], b[3], t),
  };
}

/** Tages- und Nachtlicht: Sonne, Himmel, Nebel. */
export class Lighting {
  readonly sun = new THREE.DirectionalLight(0xffffff, 2);
  readonly hemi = new THREE.HemisphereLight(0xcfe8ff, 0xf3d9b8, 1.2);
  readonly ambient = new THREE.AmbientLight(0xfff2e0, 0.35);
  night = 0;

  constructor(private scene: THREE.Scene) {
    this.sun.position.set(-14, 26, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const c = this.sun.shadow.camera;
    c.left = -24; c.right = 24; c.top = 24; c.bottom = -24; c.near = 1; c.far = 80;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target, this.hemi, this.ambient);
    scene.fog = new THREE.Fog(0x9fd3ff, 45, 110);
  }

  /** hour: 0–24 (Spielzeit) */
  update(hour: number, shopLights: THREE.PointLight[], streetLights: THREE.PointLight[]): void {
    const s = sample(hour);
    this.sun.color.copy(s.sun);
    this.sun.intensity = s.i;
    // Sonnenstand nur in 20-Minuten-Stufen ändern: eine stetig wandernde Sonne
    // verschiebt die Schattenkarte jedes Frame und lässt den Boden flimmern
    const sunHour = Math.floor(hour * 3) / 3;
    const ang = clamp((sunHour - 6) / 14, 0, 1) * Math.PI;
    this.sun.position.set(-Math.cos(ang) * 22, 8 + Math.sin(ang) * 22, 16);
    this.night = clamp(1 - s.i / 1.2, 0, 1);
    this.hemi.intensity = 0.55 + (1 - this.night) * 0.75;
    this.hemi.color.copy(s.sky).lerp(new THREE.Color(0xffffff), 0.4);
    this.ambient.intensity = 0.3 + this.night * 0.15;
    const bg = this.scene.background as THREE.Color;
    bg.copy(s.sky);
    (this.scene.fog as THREE.Fog).color.copy(s.sky);
    for (const l of shopLights) l.intensity = 3 + this.night * 9;
    for (const l of streetLights) l.intensity = this.night * 10;
  }

  setShadows(on: boolean): void {
    this.sun.castShadow = on;
  }
}
