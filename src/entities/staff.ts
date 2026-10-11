import { Character } from './character';
import { StaffMember } from '../game/state';
import { Ctx, Ticket } from '../game/context';
import { CustomerManager, Customer } from '../game/customers';
import { HeldItem, botchOrder } from '../game/orders';
import { stockIdFor } from '../data/catalog';
import { productModel } from '../world/models';
import { STAFF_LINES, PLAYER_LINES } from '../data/dialogue';
import { chance, pick, rand } from '../core/util';
import { P2 } from '../core/path';

const STATION_FOR: Record<string, string[]> = {
  froyo: ['zapfer', 'eismaschine'],
  waffle: ['waffeleisen'],
  coffee: ['kaffeemaschine'],
  matcha: ['matchabar'],
};
const PREP: Record<string, number> = { froyo: 1.8, waffle: 6.5, coffee: 2.6, matcha: 3.2 };

type Task = 'idle' | 'walk' | 'work' | 'toppings' | 'deliver';

export class StaffWorker {
  ch: Character;
  task: Task = 'idle';
  timer = 0;
  ticket: Ticket | null = null;
  item: HeldItem | null = null;
  idleT = rand(10, 30);
  private orderT = 0;

  constructor(public member: StaffMember, private ctx: Ctx, private cm: CustomerManager) {
    this.ch = new Character(member.appearance);
    this.ch.speed = 1.5 + member.skill * 0.15;
    const L = ctx.shop.layout;
    this.ch.root.position.set(L.regX - 1.5, 0, -L.D + 1.8);
    ctx.scene.add(this.ch.root);
  }

  get speedMul(): number { return 1.6 - this.member.skill * 0.17; }

  private home(): P2 {
    const L = this.ctx.shop.layout;
    if (this.member.role === 'kasse') return { x: L.regX, z: L.counterZ - 0.8 };
    return { x: L.ausgabeX - 0.8 - (this.member.id % 3) * 0.6, z: -L.D + 1.6 };
  }

  private walk(p: P2, cb: () => void): void {
    this.ch.walkTo([p], cb);
  }

  update(dt: number): void {
    this.ch.update(dt);
    if (this.member.role === 'kasse') this.updateCashier(dt);
    else this.updateCook(dt);
    this.idleT -= dt;
    if (this.idleT < 0) {
      this.idleT = rand(25, 60);
      if (chance(0.5)) this.ctx.say(this.ch, pick(STAFF_LINES.idle));
    }
  }

  private updateCashier(dt: number): void {
    const home = this.home();
    const p = this.ch.position;
    if (!this.ch.hasPath && Math.hypot(p.x - home.x, p.z - home.z) > 0.15) {
      this.walk(home, () => this.ch.faceAngle(0));
      return;
    }
    if (this.ch.hasPath) return;
    this.ch.faceAngle(0);
    const front = this.cm.frontCustomer();
    if (front) {
      this.orderT += dt;
      if (this.orderT > 3.4 * this.speedMul) {
        this.orderT = 0;
        if (chance(0.5)) this.ctx.say(this.ch, pick(STAFF_LINES.take));
        this.cm.takeOrder(this);
      }
    } else this.orderT = 0;
  }

  private updateCook(dt: number): void {
    const ctx = this.ctx;
    const shop = ctx.shop;
    if (this.task === 'idle') {
      const t = this.cm.tickets.find((x) => !x.assignee && x.blockedUntil < ctx.time);
      if (t) {
        const stationId = STATION_FOR[t.order.base].find((id) => shop.stations.has(id));
        if (!stationId) { t.blockedUntil = ctx.time + 999; return; }
        // Lager prüfen
        const key = stockIdFor(t.order.base, t.order.variant);
        const missing = (ctx.state.stock[key] ?? 0) <= 0 || t.order.toppings.some((tp) => (ctx.state.stock['top_' + tp] ?? 0) <= 0);
        if (missing) {
          t.blockedUntil = ctx.time + 15;
          ctx.say(this.ch, pick(PLAYER_LINES.noStock), 'angry');
          return;
        }
        t.assignee = this;
        this.ticket = t;
        const st = shop.stations.get(stationId)!;
        this.task = 'walk';
        this.walk({ x: st.ix, z: st.iz }, () => {
          if (this.ticket !== t) return;
          this.task = 'work';
          this.ch.faceAngle(Math.PI);
          this.timer = PREP[t.order.base] * this.speedMul;
          ctx.state.stock[key] = Math.max(0, (ctx.state.stock[key] ?? 0) - 1);
          ctx.sfx.play(t.order.base === 'waffle' ? 'sizzle' : 'pour');
        });
        return;
      }
      const home = this.home();
      const p = this.ch.position;
      if (!this.ch.hasPath && Math.hypot(p.x - home.x, p.z - home.z) > 0.3) this.walk(home, () => this.ch.faceAngle(0));
      return;
    }
    const t = this.ticket;
    if (!t || !this.cm.tickets.includes(t)) {
      // Bestellung hat sich anderweitig erledigt (Spieler war schneller)
      this.reset();
      return;
    }
    if (this.task === 'work') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const order = chance(0.3 - this.member.skill * 0.055) ? botchOrder(ctx.state, t.order) : t.order;
        this.item = { base: order.base, variant: order.variant, toppings: [], burnt: false };
        this.ch.setHeld(productModel(order.base, order.variant, []));
        if (order.toppings.length) {
          const tb = shop.stations.get('toppings')!;
          this.task = 'walk';
          this.walk({ x: tb.ix, z: tb.iz }, () => {
            if (this.ticket !== t) return;
            this.task = 'toppings';
            this.ch.faceAngle(0);
            this.timer = (0.7 * order.toppings.length + 0.5) * this.speedMul;
            this.item!.toppings = [...order.toppings];
          });
        } else this.goDeliver();
      }
    } else if (this.task === 'toppings') {
      this.timer -= dt;
      if (this.timer <= 0 && this.item) {
        for (const tp of this.item.toppings) ctx.state.stock['top_' + tp] = Math.max(0, (ctx.state.stock['top_' + tp] ?? 0) - 1);
        this.ch.setHeld(productModel(this.item.base, this.item.variant, this.item.toppings));
        ctx.sfx.play('pop');
        this.goDeliver();
      }
    }
  }

  private goDeliver(): void {
    const aus = this.ctx.shop.stations.get('ausgabe')!;
    this.task = 'walk';
    this.walk({ x: aus.ix, z: aus.iz }, () => {
      this.ch.faceAngle(0);
      const t = this.ticket;
      if (t && this.item && this.cm.tickets.includes(t)) {
        const res = this.cm.deliver(this.item, t.customer as Customer);
        if (res.ok) this.ctx.say(this.ch, pick(res.customer && res.customer.wrong ? STAFF_LINES.oops : STAFF_LINES.done));
      }
      this.reset();
    });
  }

  reset(): void {
    if (this.ticket && this.ticket.assignee === this) this.ticket.assignee = null;
    this.ticket = null;
    this.item = null;
    this.ch.setHeld(null);
    this.ch.stop();
    this.task = 'idle';
  }

  dispose(): void {
    this.reset();
    this.ch.dispose();
  }
}
