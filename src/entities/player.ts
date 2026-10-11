import * as THREE from 'three';
import { Character } from './character';
import { Appearance } from './appearance';
import { Rect } from '../world/shop';
import { HeldItem } from '../game/orders';
import { productModel, spoonModel } from '../world/models';

const R = 0.26;

export class Player {
  ch: Character;
  held: HeldItem | null = null;
  /** blockiert Bewegung (z.B. während des Zapfens) */
  busy = 0;
  busyLabel = '';
  private spoonT = 0;
  private vel = new THREE.Vector2();

  constructor(appearance: Appearance, scene: THREE.Scene) {
    this.ch = new Character(appearance);
    this.ch.speed = 3.2;
    scene.add(this.ch.root);
  }

  get pos(): THREE.Vector3 { return this.ch.position; }

  setHeld(item: HeldItem | null): void {
    this.held = item;
    this.ch.setHeld(item ? productModel(item.base, item.variant, item.toppings, item.burnt) : null);
  }

  refreshHeld(): void { this.setHeld(this.held); }

  slap(): void {
    this.ch.slap();
    this.spoonT = 0.5;
    if (!this.held) this.ch.setHeld(spoonModel());
  }

  update(dt: number, input: THREE.Vector2, colliders: Rect[], bounds: (x: number, z: number) => boolean): void {
    if (this.spoonT > 0) {
      this.spoonT -= dt;
      if (this.spoonT <= 0 && !this.held) this.ch.setHeld(null);
    }
    let moving = false;
    if (this.busy > 0) {
      this.busy -= dt;
      input.set(0, 0);
    }
    const target = input.clone().multiplyScalar(this.ch.speed);
    this.vel.lerp(target, 1 - Math.exp(-18 * dt));
    if (this.vel.lengthSq() > 0.02) {
      moving = input.lengthSq() > 0.01;
      const p = this.ch.position;
      const nx = p.x + this.vel.x * dt;
      if (!this.collides(nx, p.z, colliders) && bounds(nx, p.z)) p.x = nx;
      const nz = p.z + this.vel.y * dt;
      if (!this.collides(p.x, nz, colliders) && bounds(p.x, nz)) p.z = nz;
      if (moving) {
        const ang = Math.atan2(this.vel.x, this.vel.y);
        const r = this.ch.root.rotation;
        let d = ang - r.y;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        r.y += d * (1 - Math.exp(-16 * dt));
      }
    }
    this.ch.animate(dt, moving, this.vel.length() / 1.6);
  }

  private collides(x: number, z: number, cols: Rect[]): boolean {
    for (const c of cols) {
      if (x + R > c.x0 && x - R < c.x1 && z + R > c.z0 && z - R < c.z1) return true;
    }
    return false;
  }

  /** aus der Kollision schieben, falls nach einem Umbau eingeklemmt */
  unstick(cols: Rect[], fallback: THREE.Vector3): void {
    if (this.collides(this.pos.x, this.pos.z, cols)) this.pos.copy(fallback);
  }

  faceTo(x: number, z: number): void {
    this.ch.root.rotation.y = Math.atan2(x - this.pos.x, z - this.pos.z);
  }
}
