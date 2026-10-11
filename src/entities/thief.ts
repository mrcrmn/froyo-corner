import { Character } from './character';
import { thiefAppearance } from './appearance';
import { Ctx } from '../game/context';
import { THIEF } from '../data/dialogue';
import { TOPPINGS } from '../data/catalog';
import { pick, rand } from '../core/util';
import { P2 } from '../core/path';

export class Thief {
  ch = new Character(thiefAppearance());
  state: 'sneak' | 'steal' | 'flee' | 'gone' = 'sneak';
  timer = 2.5;
  steals = 0;
  stolen: string[] = [];

  constructor(private ctx: Ctx) {
    const L = ctx.shop.layout;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.ch.speed = 1.3;
    this.ch.root.position.set(dir * 30, 0, 2.6);
    ctx.scene.add(this.ch.root);
    const target = { x: L.tbX + rand(-0.3, 0.3), z: L.counterZ + 0.85 };
    const inner = ctx.shop.nav.findPath(L.doorIn.x, L.doorIn.z, target.x, target.z) ?? [target];
    this.ch.walkTo([{ x: L.doorX, z: 2.6 }, L.doorOut, { x: L.doorX, z: 0.1 }, L.doorIn, ...inner], () => {
      this.state = 'steal';
      this.ch.faceAngle(Math.PI);
      ctx.say(this.ch, pick(THIEF.enter), 'thief');
    });
  }

  get inside(): boolean { return this.ch.position.z < 0; }

  update(dt: number): void {
    this.ch.update(dt);
    if (this.state !== 'steal') return;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = rand(2.2, 3.4);
      const s = this.ctx.state;
      const cands = TOPPINGS.filter((t) => s.unlocked.includes(t.id) && (s.stock['top_' + t.id] ?? 0) > 0);
      if (cands.length) {
        const t = pick(cands);
        const n = Math.min(s.stock['top_' + t.id], Math.ceil(rand(3, 7)));
        s.stock['top_' + t.id] -= n;
        this.stolen.push(t.name);
        this.ch.slap();
        this.ctx.say(this.ch, pick(THIEF.steal) + ` (−${n} ${t.name})`, 'thief');
        this.ctx.sfx.play('munch');
      }
      this.steals++;
      if (this.steals >= 5) {
        this.ctx.say(this.ch, pick(THIEF.escaped), 'thief');
        this.ctx.toast('Der Topping-Dieb ist entkommen! 🦝', 'bad');
        this.flee(1.6);
      }
    }
  }

  slapped(): void {
    if (this.state === 'flee' || this.state === 'gone') return;
    this.ctx.say(this.ch, pick(THIEF.slapped), 'thief');
    this.ctx.state.stats.thieves++;
    this.ctx.sfx.play('slap');
    this.ch.hop = 0.25;
    this.flee(3.6);
  }

  private flee(speed: number): void {
    this.state = 'flee';
    const L = this.ctx.shop.layout;
    const p = this.ch.position;
    const inner: P2[] = this.ctx.shop.nav.findPath(p.x, p.z, L.doorIn.x, L.doorIn.z) ?? [L.doorIn];
    this.ch.speed = speed;
    const dir = Math.random() < 0.5 ? 1 : -1;
    this.ch.walkTo([...inner, { x: L.doorX, z: 0.1 }, L.doorOut, { x: L.doorX + dir, z: 2.8 }, { x: dir * 34, z: 2.8 }], () => {
      this.state = 'gone';
      this.ch.dispose();
    });
  }
}
