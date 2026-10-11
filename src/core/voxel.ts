import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export type Layer = 'solid' | 'glow' | 'glass';

export const MAT = {
  solid: new THREE.MeshLambertMaterial({ vertexColors: true }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  glass: new THREE.MeshLambertMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }),
  ghostOk: new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0.45, depthWrite: false }),
  ghostBad: new THREE.MeshBasicMaterial({ color: 0xff6b7d, transparent: true, opacity: 0.45, depthWrite: false }),
};

const tmp = new THREE.Color();

/** Kleiner Voxel-Baukasten: sammelt Boxen mit Vertex-Farben und verschmilzt sie. */
export class VB {
  private layers: Record<Layer, THREE.BufferGeometry[]> = { solid: [], glow: [], glass: [] };
  jitter = 0.04;

  /** Box anhand ihres Mittelpunkts. */
  box(
    cx: number, cy: number, cz: number,
    w: number, h: number, d: number,
    color: THREE.ColorRepresentation,
    layer: Layer = 'solid',
    jitter = this.jitter,
  ): this {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(cx, cy, cz);
    tmp.set(color);
    if (jitter) {
      const j = 1 + (Math.random() * 2 - 1) * jitter;
      tmp.r = Math.min(1, tmp.r * j);
      tmp.g = Math.min(1, tmp.g * j);
      tmp.b = Math.min(1, tmp.b * j);
    }
    const n = g.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = tmp.r;
      arr[i * 3 + 1] = tmp.g;
      arr[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.layers[layer].push(g);
    return this;
  }

  /** Box anhand der minimalen Ecke. */
  cube(
    x0: number, y0: number, z0: number,
    w: number, h: number, d: number,
    color: THREE.ColorRepresentation,
    layer: Layer = 'solid',
    jitter = this.jitter,
  ): this {
    return this.box(x0 + w / 2, y0 + h / 2, z0 + d / 2, w, h, d, color, layer, jitter);
  }

  isEmpty(): boolean {
    return !this.layers.solid.length && !this.layers.glow.length && !this.layers.glass.length;
  }

  geometry(layer: Layer = 'solid'): THREE.BufferGeometry | null {
    const list = this.layers[layer];
    if (!list.length) return null;
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    this.layers[layer] = [];
    return merged;
  }

  build(opts: { shadow?: boolean; receive?: boolean } = {}): THREE.Group {
    const group = new THREE.Group();
    const shadow = opts.shadow ?? true;
    for (const layer of ['solid', 'glow', 'glass'] as Layer[]) {
      const g = this.geometry(layer);
      if (!g) continue;
      const mesh = new THREE.Mesh(g, MAT[layer]);
      mesh.castShadow = shadow && layer === 'solid';
      mesh.receiveShadow = (opts.receive ?? true) && layer !== 'glow';
      mesh.userData.layer = layer;
      group.add(mesh);
    }
    return group;
  }
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      const mat = m.material as THREE.Material;
      if (mat && !Object.values(MAT).includes(mat as never) && !(mat as any).userData?.shared) mat.dispose();
    }
  });
  obj.removeFromParent();
}

/** Ersetzt die Materialien eines Objekts durch ein Ghost-Material (für die Platzierung). */
export function setGhost(obj: THREE.Object3D, ok: boolean): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.material = ok ? MAT.ghostOk : MAT.ghostBad;
      m.castShadow = false;
    }
  });
}
