import * as THREE from 'three';
import type { Game } from './game';
import type { MessApi } from './context';
import { disposeObject } from '../core/voxel';
import { binHeapModel, leftoverModel, spillModel } from '../world/models';
import { itemRect, TableInfo } from '../world/shop';
import { rand } from '../core/util';

/** so viel passt in den Mülleimer hinter der Theke */
export const TRASH_CAP = 10;
/** ab hier lohnt es sich, den Sack rauszubringen */
export const TRASH_TAKE = 3;

interface Spill { id: number; x: number; z: number; obj: THREE.Group }

/**
 * Dreck im Laden: Kleckse auf dem Boden, stehen gelassenes Geschirr auf den Tischen
 * und der Füllstand des Mülleimers.
 */
export class Mess implements MessApi {
  spills: Spill[] = [];
  /** Tisch-uid → zurückgelassene Becher */
  private leftovers = new Map<number, THREE.Group>();
  private heap: THREE.Group | null = null;
  private group = new THREE.Group();
  private nextId = 1;

  constructor(private g: Game) {
    g.scene.add(this.group);
  }

  // ---------------- Kleckse

  spill(x: number, z: number, color: number): void {
    // nicht zwei Pfützen übereinander
    if (this.spills.some((s) => Math.hypot(s.x - x, s.z - z) < 0.5)) return;
    const obj = spillModel(color);
    obj.position.set(x, 0, z);
    obj.rotation.y = rand(0, Math.PI * 2);
    this.group.add(obj);
    this.spills.push({ id: this.nextId++, x, z, obj });
  }

  spillAt(x: number, z: number, r = 0.4): boolean {
    return this.spills.some((s) => Math.hypot(s.x - x, s.z - z) < r);
  }

  wipe(id: number): void {
    const s = this.spills.find((q) => q.id === id);
    if (!s) return;
    disposeObject(s.obj);
    this.spills = this.spills.filter((q) => q !== s);
  }

  // ---------------- Tische

  leftover(tableUid: number, seat: { x: number; z: number }, color: number): void {
    const t = this.g.shop.tables.find((q) => q.uid === tableUid);
    if (!t) return;
    t.dirty = true;
    let grp = this.leftovers.get(t.uid);
    if (!grp) {
      grp = new THREE.Group();
      grp.userData.top = this.tableTop(t.uid);
      this.group.add(grp);
      this.leftovers.set(t.uid, grp);
    }
    const m = leftoverModel(color);
    const dx = seat.x - t.x, dz = seat.z - t.z;
    const len = Math.hypot(dx, dz) || 1;
    m.position.set((dx / len) * 0.2 + rand(-0.06, 0.06), 0, (dz / len) * 0.2 + rand(-0.06, 0.06));
    m.rotation.y = rand(0, Math.PI * 2);
    grp.add(m);
    grp.position.set(t.x, grp.userData.top, t.z);
  }

  clearTable(uid: number): void {
    const t = this.g.shop.tables.find((q) => q.uid === uid);
    if (t) t.dirty = false;
    const grp = this.leftovers.get(uid);
    if (grp) disposeObject(grp);
    this.leftovers.delete(uid);
  }

  dirtyTables(): TableInfo[] {
    return this.g.shop.tables.filter((t) => t.dirty);
  }

  /** Abstand des Spielers zur Tischkante */
  tableDist(t: TableInfo, x: number, z: number): number {
    const it = this.g.state.placed.find((p) => p.uid === t.uid);
    if (!it) return Infinity;
    const r = itemRect(it.type, it.x, it.z, it.rot);
    return Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
  }

  private tableTop(uid: number): number {
    const mesh = this.g.shop.furnitureMeshes.get(uid);
    if (!mesh) return 0.75;
    return new THREE.Box3().setFromObject(mesh).max.y;
  }

  // ---------------- Mülleimer

  get full(): boolean { return this.g.state.trash >= TRASH_CAP; }

  /** etwas in den Mülleimer – ist er voll, landet es daneben auf dem Boden */
  toBin(color = 0xc9b48a): void {
    const g = this.g;
    g.sfx.play('trash');
    if (this.full) {
      const st = g.shop.stations.get('trash');
      if (st) this.spill(st.ix + rand(-0.3, 0.3), st.iz + rand(0.1, 0.4), color);
      g.toast('🗑️ Der Mülleimer quillt über! Bring den Müllsack raus.', 'bad');
      return;
    }
    g.state.trash++;
  }

  /** Wie schmutzig ist es gerade? (0 = blitzblank) */
  level(): number {
    return this.spills.length + this.dirtyTables().length * 0.5 + (this.full ? 1 : 0);
  }

  update(): void {
    // Geschirr folgt verschobenen Tischen bzw. verschwindet mit ihnen
    for (const [uid, grp] of this.leftovers) {
      const t = this.g.shop.tables.find((q) => q.uid === uid);
      if (!t) { disposeObject(grp); this.leftovers.delete(uid); continue; }
      if (grp.position.x !== t.x || grp.position.z !== t.z) {
        grp.userData.top = this.tableTop(uid);
        grp.position.set(t.x, grp.userData.top, t.z);
      }
      t.dirty = true;
    }
    // volle Säcke oben auf dem Mülleimer
    const st = this.g.shop.stations.get('trash');
    if (this.full && st) {
      if (!this.heap) { this.heap = binHeapModel(); this.group.add(this.heap); }
      st.group.getWorldPosition(this.heap.position);
    } else if (this.heap) {
      disposeObject(this.heap);
      this.heap = null;
    }
  }
}
