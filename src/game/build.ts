import * as THREE from 'three';
import type { Game } from './game';
import { PLACEABLE_BY_ID } from '../data/catalog';
import { placeableModel } from '../world/models';
import { disposeObject, setGhost } from '../core/voxel';
import { isTouch } from '../ui/touch';
import { money } from '../core/util';

type Sel =
  | { mode: 'new'; type: string; fromInventory: boolean }
  | { mode: 'move'; uid: number; type: string; ox: number; oz: number; orot: number };

/** Baumodus: Möbel kaufen, platzieren, verschieben, verkaufen. */
export class BuildMode {
  active = false;
  sel: Sel | null = null;
  private ghost: THREE.Group | null = null;
  private rot = 0;
  private pos = new THREE.Vector3();
  private ok = false;
  private ray = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private mouse = new THREE.Vector2();
  private hover: number | null = null;
  readonly grid: THREE.GridHelper;

  constructor(private g: Game) {
    this.grid = new THREE.GridHelper(1, 1);
    this.grid.visible = false;
    g.scene.add(this.grid);
  }

  toggle(on = !this.active): void {
    if (on && !this.g.canBuild()) return;
    this.active = on;
    this.cancel();
    this.rebuildGrid();
    this.grid.visible = on;
    // Anleitung steht in der Bauleiste (passend zum jeweiligen Schritt)
    this.g.ui.setBuildMode(on);
  }

  private rebuildGrid(): void {
    const L = this.g.shop.layout;
    this.g.scene.remove(this.grid);
    this.grid.geometry.dispose();
    const size = Math.max(L.W, L.D);
    const ng = new THREE.GridHelper(size, size * 2, 0xffffff, 0xffffff);
    (ng.material as THREE.Material).transparent = true;
    (ng.material as THREE.Material).opacity = 0.18;
    ng.position.set(0, 0.02, -L.D / 2);
    this.grid.geometry = ng.geometry;
    this.grid.material = ng.material;
    this.grid.position.copy(ng.position);
    this.g.scene.add(this.grid);
  }

  /** Neues Möbelstück aus Shop oder Lager in die Hand nehmen */
  startPlacing(type: string, fromInventory: boolean): void {
    if (!this.active) this.toggle(true);
    if (!this.active) return;
    this.cancel();
    this.sel = { mode: 'new', type, fromInventory };
    this.rot = 0;
    this.makeGhost(type);
  }

  private makeGhost(type: string): void {
    this.clearGhost();
    this.ghost = placeableModel(type);
    setGhost(this.ghost, true);
    this.g.scene.add(this.ghost);
  }

  private clearGhost(): void {
    if (this.ghost) {
      disposeObject(this.ghost);
      this.ghost = null;
    }
  }

  cancel(): void {
    if (this.sel?.mode === 'move') {
      const mesh = this.g.shop.furnitureMeshes.get(this.sel.uid);
      if (mesh) mesh.visible = true;
    }
    this.sel = null;
    this.clearGhost();
  }

  pointerMove(cx: number, cy: number): void {
    const r = this.g.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.g.camera);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.plane, hit)) return;
    this.pos.set(Math.round(hit.x * 4) / 4, 0, Math.round(hit.z * 4) / 4);
    if (!this.sel) {
      this.hover = this.pickFurniture();
      for (const [uid, m] of this.g.shop.furnitureMeshes) m.scale.setScalar(uid === this.hover ? 1.06 : 1);
    }
  }

  /** Möbelstück unter einem Bildschirmpunkt (auch außerhalb des Baumodus) */
  furnitureAt(cx: number, cy: number): number | null {
    const r = this.g.renderer.domElement.getBoundingClientRect();
    this.mouse.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.mouse, this.g.camera);
    return this.pickFurniture();
  }

  /** Baumodus starten und dieses Möbelstück gleich in die Hand nehmen */
  grab(uid: number, cx: number, cy: number): void {
    if (!this.active) this.toggle(true);
    if (!this.active) return;
    this.pointerMove(cx, cy);
    this.pickUp(uid);
  }

  private pickFurniture(): number | null {
    const meshes = [...this.g.shop.furnitureMeshes.values()];
    const hits = this.ray.intersectObjects(meshes, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.uid === undefined) o = o.parent;
      if (o) return o.userData.uid as number;
    }
    return null;
  }

  click(): void {
    const g = this.g;
    if (!this.sel) {
      if (this.hover === null) return;
      this.pickUp(this.hover);
      return;
    }
    if (!this.ok) {
      g.sfx.play('wrong');
      g.toast('Hier ist kein Platz (Wege, Theke und Tür müssen frei bleiben).', 'bad');
      return;
    }
    const s = g.state;
    const sel = this.sel;
    if (sel.mode === 'new') {
      const def = PLACEABLE_BY_ID.get(sel.type)!;
      if (sel.fromInventory) {
        const i = s.inventory.indexOf(sel.type);
        if (i < 0) { this.cancel(); return; }
        s.inventory.splice(i, 1);
      } else if (!g.spend(def.price)) {
        g.toast(`Zu wenig Geld für ${def.name} (${money(def.price)}).`, 'bad');
        return;
      }
      s.placed.push({ uid: s.nextUid++, type: sel.type, x: this.pos.x, z: this.pos.z, rot: this.rot });
      g.sfx.play('place');
      this.afterChange();
      // weiter platzieren, solange vorhanden/bezahlbar
      if (sel.fromInventory && !s.inventory.includes(sel.type)) this.cancel();
      else if (!sel.fromInventory && s.money < def.price) this.cancel();
    } else {
      const it = s.placed.find((p) => p.uid === sel.uid);
      if (it) { it.x = this.pos.x; it.z = this.pos.z; it.rot = this.rot; }
      g.sfx.play('place');
      this.sel = null;
      this.clearGhost();
      this.afterChange();
    }
  }

  private pickUp(uid: number): void {
    const g = this.g;
    const it = g.state.placed.find((p) => p.uid === uid);
    if (!it) return;
    if (this.inUse(uid)) {
      g.toast('Da sitzt gerade jemand – später verschieben.', 'bad');
      return;
    }
    this.sel = { mode: 'move', uid, type: it.type, ox: it.x, oz: it.z, orot: it.rot };
    this.rot = it.rot;
    // Geist erst einmal genau dort, wo das Möbelstück steht (nicht unter dem Finger versetzt)
    this.pos.set(it.x, 0, it.z);
    const mesh = g.shop.furnitureMeshes.get(uid);
    if (mesh) mesh.visible = false;
    this.makeGhost(it.type);
    g.sfx.play('click');
  }

  private inUse(uid: number): boolean {
    const sh = this.g.shop;
    if (sh.seats.some((s) => s.uid === uid && s.occupant)) return true;
    const t = sh.tables.find((t) => t.uid === uid);
    if (t && (t.claimedBy || t.seats.some((s) => s.occupant))) return true;
    return false;
  }

  rotate(): void {
    const g = this.g;
    this.rot = (this.rot + Math.PI / 2) % (Math.PI * 2);
    g.sfx.play('click');
    // Touch: angetipptes Möbelstück gleich an Ort und Stelle drehen – sonst müsste man es danach noch abstellen
    const sel = this.sel;
    if (sel?.mode !== 'move' || !isTouch()) return;
    const it = g.state.placed.find((p) => p.uid === sel.uid);
    if (!it) return;
    this.pos.set(it.x, 0, it.z);
    if (!g.shop.canPlace(g.state, sel.type, it.x, it.z, this.rot, sel.uid)) {
      g.toast('So gedreht passt es hier nicht – zieh es erst an eine freiere Stelle.', 'bad');
      return;
    }
    it.rot = this.rot;
    this.sel = { ...sel, orot: this.rot };
    this.afterChange();
    // in der Hand behalten, damit man weiterdrehen kann
    const mesh = g.shop.furnitureMeshes.get(sel.uid);
    if (mesh) mesh.visible = false;
  }

  /** ausgewähltes (oder überfahrenes) Möbelstück verkaufen */
  sell(): void {
    const g = this.g;
    const uid = this.sel?.mode === 'move' ? this.sel.uid : this.sel ? null : this.hover;
    if (uid === null) { if (this.sel) this.cancel(); return; }
    if (this.inUse(uid)) { g.toast('Wird gerade benutzt.', 'bad'); return; }
    const i = g.state.placed.findIndex((p) => p.uid === uid);
    if (i < 0) return;
    const def = PLACEABLE_BY_ID.get(g.state.placed[i].type)!;
    g.state.placed.splice(i, 1);
    const back = Math.round(def.price * 0.5);
    g.earn(back, undefined, 'Verkauft');
    g.toast(`${def.name} für ${money(back)} verkauft.`);
    this.sel = null;
    this.clearGhost();
    this.hover = null;
    this.afterChange();
  }

  /** ins Lager (Inventar) legen */
  store(): void {
    const g = this.g;
    const uid = this.sel?.mode === 'move' ? this.sel.uid : this.sel ? null : this.hover;
    if (uid === null) return;
    if (this.inUse(uid)) { g.toast('Wird gerade benutzt.', 'bad'); return; }
    const i = g.state.placed.findIndex((p) => p.uid === uid);
    if (i < 0) return;
    g.state.inventory.push(g.state.placed[i].type);
    g.state.placed.splice(i, 1);
    this.sel = null;
    this.clearGhost();
    this.hover = null;
    g.sfx.play('pop');
    this.afterChange();
  }

  private afterChange(): void {
    const g = this.g;
    g.shop.buildFurniture(g.state);
    g.shop.computeCozy(g.state);
    g.player.unstick(g.shop.colliders, new THREE.Vector3(g.shop.layout.regX - 1, 0, g.shop.layout.counterZ - 0.9));
    g.ui.refresh();
  }

  update(): void {
    if (!this.active || !this.ghost || !this.sel) return;
    const g = this.g;
    this.ghost.position.copy(this.pos);
    this.ghost.rotation.y = this.rot;
    const ignore = this.sel.mode === 'move' ? this.sel.uid : null;
    this.ok = g.shop.canPlace(g.state, this.sel.type, this.pos.x, this.pos.z, this.rot, ignore);
    if (this.ok && this.sel.mode === 'new' && !this.sel.fromInventory) {
      this.ok = g.state.money >= PLACEABLE_BY_ID.get(this.sel.type)!.price;
    }
    setGhost(this.ghost, this.ok);
  }
}
