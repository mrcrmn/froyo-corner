import * as THREE from 'three';
import { Character } from '../entities/character';
import { randomAppearance } from '../entities/appearance';
import { Persona, LINES, GENERIC, FIRST_NAMES, PERSONA_LABEL } from '../data/dialogue';
import { DRINKS, FAIR_PRICE, stockIdFor } from '../data/catalog';
import { P2 } from '../core/path';
import { chance, clamp, escapeHtml, pick, pickWeighted, rand, randi } from '../core/util';
import { orderImg } from '../ui/pixelart';
import { Ctx, Ticket } from './context';
import { HeldItem, OrderItem, exactMatch, generateOrder, matchScore, orderPrice, fairPriceOf, describeOrder } from './orders';
import { Seat, TableInfo } from '../world/shop';
import { productModel } from '../world/models';
import { avgRating } from './state';

export type CState =
  | 'arrive' | 'toFridge' | 'atFridge' | 'toQueue' | 'queue' | 'toPickup' | 'waitPickup'
  | 'toSeat' | 'eating' | 'seated' | 'leaving' | 'gone';

const PERSONAS: Persona[] = ['naschkatze', 'gesund', 'hipster', 'oma', 'kind', 'business', 'tourist', 'influencer', 'student'];
const PATIENCE: Record<Persona, number> = {
  naschkatze: 1, gesund: 1, hipster: 1.1, oma: 1.5, kind: 0.75, business: 0.6, tourist: 1.2, influencer: 0.9, student: 1.1,
};
const TIP: Record<Persona, number> = {
  naschkatze: 1.1, gesund: 1, hipster: 0.8, oma: 1.6, kind: 0.4, business: 1.4, tourist: 1.5, influencer: 0.9, student: 0.4,
};

let NEXT_ID = 1;

export class Group {
  members: Customer[] = [];
  table: TableInfo | null = null;
  reorders = 0;
  leaving = false;
}

export class Customer {
  id = NEXT_ID++;
  name: string;
  ch: Character;
  state: CState = 'arrive';
  patience = 0;
  patienceMax = 1;
  group: Group | null = null;
  seat: Seat | null = null;
  dineIn = false;
  order: OrderItem | null = null;
  ticket: Ticket | null = null;
  paid = 0;
  fair = 0;
  drink: string | null = null;
  wrong = 0;
  served = false;
  waited = 0;
  timer = 0;
  chatT = rand(4, 10);
  reordering = false;
  pickupIdx = -1;
  angry = false;
  thoughts: string[] = [];

  constructor(public persona: Persona) {
    this.name = pick(FIRST_NAMES);
    this.ch = new Character(randomAppearance({ kid: persona === 'kind', old: persona === 'oma' }));
    this.ch.speed = persona === 'oma' ? 1.05 : persona === 'kind' ? 1.9 : persona === 'business' ? 1.9 : rand(1.3, 1.65);
  }

  get label(): string { return `${this.name} (${PERSONA_LABEL[this.persona]})`; }
}

export class CustomerManager {
  customers: Customer[] = [];
  queue: Customer[] = [];
  tickets: Ticket[] = [];
  groups: Group[] = [];
  private spawnT = 0.4;
  private ticketId = 1;
  pickupTaken: (Customer | null)[] = [];
  servedToday = 0;
  revenueToday = 0;
  tipsToday = 0;
  angryToday = 0;
  /** wer gerade an der Kasse bedient (Spieler oder Personal) */
  cashierBusy: unknown | null = null;

  constructor(private ctx: Ctx) {}

  get shop() { return this.ctx.shop; }
  get L() { return this.ctx.shop.layout; }

  // ------------------------------------------------------------ Bewegung

  private outsideToDoor(from: P2): P2[] {
    const L = this.L;
    return [{ x: L.doorX, z: Math.max(2.2, Math.min(3.0, from.z)) }, L.doorOut, { x: L.doorX, z: 0.1 }, L.doorIn];
  }

  goTo(c: Customer, target: P2, onArrive: () => void): void {
    const p = c.ch.position;
    let path: P2[] = [];
    let from: P2 = { x: p.x, z: p.z };
    if (p.z > -0.3) {
      path = this.outsideToDoor(from);
      from = this.L.doorIn;
    }
    const inner = this.shop.nav.findPath(from.x, from.z, target.x, target.z) ?? [target];
    path.push(...inner);
    c.ch.walkTo(path, onArrive);
  }

  goOutside(c: Customer, onArrive: () => void): void {
    const L = this.L;
    const p = c.ch.position;
    const path: P2[] = p.z < -0.3 ? (this.shop.nav.findPath(p.x, p.z, L.doorIn.x, L.doorIn.z) ?? [L.doorIn]) : [];
    const dir = chance(0.5) ? 1 : -1;
    path.push({ x: L.doorX, z: 0.1 }, L.doorOut, { x: L.doorX + dir * 0.6, z: 2.6 }, { x: dir * 34, z: 2.6 + rand(-0.4, 0.4) });
    c.ch.walkTo(path, onArrive);
  }

  // ------------------------------------------------------------ Spawnen

  spawnRate(): number {
    const s = this.ctx.state;
    const rating = avgRating(s);
    const cozy = this.shop.cozy;
    let ratio = 0, n = 0;
    for (const k of ['froyo', 'waffle', 'coffee', 'matcha'] as const) { ratio += s.prices[k] / FAIR_PRICE[k]; n++; }
    ratio /= n;
    const priceF = clamp(1.7 - 0.7 * ratio, 0.25, 1.4);
    const ratingF = 0.35 + Math.pow(clamp((rating - 1) / 4, 0, 1), 1.3) * 1.35;
    const cozyF = 1 + Math.min(cozy, 120) / 90;
    const seatF = 1 + Math.min(this.shop.seatCount(), 16) * 0.025;
    const levelF = 1 + s.level * 0.3;
    const menuF = 0.85 + Math.min(0.5, s.equipment.length * 0.06);
    return 2.1 * priceF * ratingF * cozyF * seatF * levelF * menuF; // pro Minute
  }

  update(dt: number, hourOfDay: number): void {
    const ctx = this.ctx;
    // Spawnen
    if (ctx.isOpen()) {
      const curve = 0.7 + 0.45 * Math.exp(-Math.pow(hourOfDay - 12.5, 2) / 2) + 0.55 * Math.exp(-Math.pow(hourOfDay - 15.5, 2) / 2.5);
      this.spawnT -= dt * (this.spawnRate() * curve) / 30;
      const maxInside = 5 + this.shop.seats.length + this.ctx.state.level * 2;
      const active = this.customers.filter((c) => c.state !== 'leaving').length;
      if (this.spawnT <= 0) {
        this.spawnT = rand(0.6, 1.4);
        if (active < maxInside) this.spawn();
      }
    }
    for (const c of [...this.customers]) this.updateCustomer(c, dt);
    this.customers = this.customers.filter((c) => c.state !== 'gone');
    this.groups = this.groups.filter((g) => g.members.some((m) => m.state !== 'gone'));
  }

  private freeTable(size: number): TableInfo | null {
    const cands = this.shop.tables.filter((t) => !t.claimedBy && t.seats.length >= size && t.seats.every((s) => !s.occupant));
    if (!cands.length) return null;
    return cands.sort((a, b) => a.seats.length - b.seats.length)[0];
  }

  private freeSeat(): Seat | null {
    const free = this.shop.seats.filter((s) => !s.occupant && s.tableUid !== null);
    const unclaimed = free.filter((s) => !this.shop.tables.find((t) => t.uid === s.tableUid)?.claimedBy);
    return pick(unclaimed.length ? unclaimed : []) ?? null;
  }

  spawn(): void {
    const s = this.ctx.state;
    const dir = chance(0.5) ? 1 : -1;
    const startX = dir * rand(26, 34);
    const lane = rand(2.2, 3.0);
    const groupTable = chance(0.22) ? this.freeTable(2) : null;
    if (groupTable && this.queue.length < this.L.queueSpots.length - 1) {
      const size = Math.min(groupTable.seats.length, randi(2, 4));
      const table = this.freeTable(size) ?? groupTable;
      const g = new Group();
      g.table = table;
      table.claimedBy = g;
      const theme = pick<Persona[]>([['oma', 'oma', 'oma', 'oma'], ['student', 'student', 'hipster', 'student'], ['business', 'business', 'business', 'business'], ['tourist', 'tourist', 'kind', 'tourist'], ['influencer', 'influencer', 'hipster', 'gesund'], PERSONAS]);
      for (let i = 0; i < Math.min(size, table.seats.length); i++) {
        const c = new Customer(theme === PERSONAS ? pick(PERSONAS) : theme[i % theme.length]);
        c.group = g;
        c.dineIn = true;
        c.seat = table.seats[i];
        c.seat.occupant = c;
        g.members.push(c);
        this.addCustomer(c, startX - dir * i * 0.9, lane + (i % 2) * 0.5);
      }
      this.groups.push(g);
      return;
    }
    const persona = pickWeighted(PERSONAS, (p) => (p === 'kind' ? 0.7 : p === 'influencer' && this.shop.cozy > 30 ? 1.6 : 1));
    const c = new Customer(persona);
    // Sitzen oder To-Go?
    const wantsSeat = chance(persona === 'business' ? 0.2 : persona === 'oma' ? 0.8 : 0.5);
    if (wantsSeat) {
      const seat = this.freeSeat();
      if (seat) {
        c.dineIn = true;
        c.seat = seat;
        seat.occupant = c;
      } else {
        c.thoughts.push('noSeat');
      }
    }
    this.addCustomer(c, startX, lane);
    void s;
  }

  private addCustomer(c: Customer, x: number, z: number): void {
    c.ch.root.position.set(x, 0, z);
    this.ctx.scene.add(c.ch.root);
    this.customers.push(c);
    c.state = 'arrive';
    // zur Tür
    const L = this.L;
    if (this.queue.length >= L.queueSpots.length) {
      // zu voll – gehen gleich vorbei
      c.ch.walkTo([{ x: L.doorX, z: 2.6 }], () => {
        this.ctx.say(c.ch, pick(GENERIC.queueFull), 'angry');
        this.leave(c, false);
      });
      return;
    }
    c.ch.walkTo([{ x: L.doorX + (x > 0 ? 0.4 : -0.4), z: 2.6 }, L.doorOut, { x: L.doorX, z: 0.1 }, L.doorIn], () => this.entered(c));
  }

  private entered(c: Customer): void {
    if (!this.ctx.isOpen() && !c.group) { this.leave(c, false); return; }
    if (chance(0.45)) this.ctx.say(c.ch, pick(LINES[c.persona].enter));
    else if (this.shop.cozy > 40 && chance(0.3)) this.ctx.say(c.ch, pick(GENERIC.cozyHigh), 'happy');
    if (c.thoughts.includes('noSeat') && chance(0.5)) setTimeout(() => this.ctx.say(c.ch, pick(GENERIC.noSeat)), 1500);
    const fridge = this.ctx.state.equipment.includes('getraenkekuehlschrank');
    const drinks = DRINKS.filter((d) => this.ctx.state.unlocked.includes(d.id) && (this.ctx.state.stock['drink_' + d.id] ?? 0) > 0);
    if (fridge && drinks.length && chance(0.35)) {
      c.state = 'toFridge';
      this.goTo(c, this.L.fridgeSpot, () => {
        c.state = 'atFridge';
        c.timer = 1.6;
        c.ch.faceTo(this.L.fridgePos.x, this.L.fridgePos.z);
        const d = pick(drinks);
        c.drink = d.id;
        this.ctx.state.stock['drink_' + d.id]--;
        if (chance(0.4)) this.ctx.say(c.ch, pick(GENERIC.drink));
      });
      return;
    }
    this.joinQueue(c);
  }

  joinQueue(c: Customer): void {
    if (this.queue.length >= this.L.queueSpots.length) {
      this.ctx.say(c.ch, pick(GENERIC.queueFull), 'angry');
      this.releaseSeat(c);
      this.leave(c, false);
      return;
    }
    this.queue.push(c);
    c.state = 'toQueue';
    c.patienceMax = (55 + this.shop.cozy * 0.25) * PATIENCE[c.persona];
    c.patience = c.patienceMax;
    this.walkQueue(c);
  }

  private walkQueue(c: Customer): void {
    const idx = this.queue.indexOf(c);
    const spot = this.L.queueSpots[Math.min(idx, this.L.queueSpots.length - 1)];
    this.goTo(c, spot, () => {
      if (c.state === 'toQueue') c.state = 'queue';
      c.ch.faceAngle(Math.PI);
    });
  }

  private advanceQueue(): void {
    for (const q of this.queue) {
      q.state = 'toQueue';
      this.walkQueue(q);
    }
  }

  /** Kund:in vorne in der Schlange, bereit zum Bestellen */
  frontCustomer(): Customer | null {
    const c = this.queue[0];
    if (!c) return null;
    if (c.state !== 'queue') return null;
    return c;
  }

  /** Bestellung an der Kasse aufnehmen. Gibt Text zurück oder null. */
  takeOrder(by: unknown): Customer | null {
    const c = this.frontCustomer();
    if (!c) return null;
    const s = this.ctx.state;
    const order = generateOrder(s, c.persona, c.reordering);
    if (!order) {
      this.ctx.say(c.ch, 'Ihr habt ja gar nichts im Angebot?!', 'angry');
      this.queue.shift();
      this.advanceQueue();
      this.releaseSeat(c);
      this.leave(c, true);
      return null;
    }
    c.order = order;
    const price = orderPrice(s, order);
    const fair = fairPriceOf(order, FAIR_PRICE);
    const ratio = price / fair;
    // zu teuer?
    if (ratio > 2.1 || (ratio > 1.6 && chance((ratio - 1.6) * 1.5))) {
      this.ctx.say(c.ch, pick(GENERIC.expensive) + ' Nee, danke.', 'angry');
      this.queue.shift();
      this.advanceQueue();
      this.addReview(c, 2, pick(GENERIC.expensive));
      this.releaseSeat(c);
      this.leave(c, false);
      return null;
    }
    let total = price;
    if (c.drink) total += s.prices.drink;
    c.paid = total;
    c.fair = fair + (c.drink ? FAIR_PRICE.drink : 0);
    this.ctx.earn(total, c.ch.position.clone().setY(2.2), 'Bezahlt');
    this.revenueToday += total;
    s.stats.revenue += total;
    // Bestellung als Bild statt Spruch + Text – auf einen Blick erkennbar
    const what = describeOrder(order) + (c.drink ? ' + Getränk' : '');
    this.ctx.say(c.ch, what, 'order', orderImg(order, c.drink, 'px-l', what));
    if (ratio > 1.3 && chance(0.5)) setTimeout(() => this.ctx.say(c.ch, pick(GENERIC.expensive)), 2200);
    else if (ratio < 0.8 && chance(0.5)) setTimeout(() => this.ctx.say(c.ch, pick(GENERIC.cheap), 'happy'), 2200);
    const t: Ticket = { id: this.ticketId++, customer: c, order, price, t: this.ctx.time, assignee: null, blockedUntil: 0 };
    this.tickets.push(t);
    c.ticket = t;
    c.drink = null;
    this.ctx.sfx.play('coin');
    this.queue.shift();
    this.advanceQueue();
    // zur Abholung
    c.waited += c.patienceMax - c.patience;
    c.patienceMax = (70 + this.shop.cozy * 0.3) * PATIENCE[c.persona] + order.toppings.length * 6 + (order.base === 'waffle' ? 12 : 0);
    c.patience = c.patienceMax;
    c.state = 'toPickup';
    let idx = this.pickupTaken.findIndex((x) => !x);
    if (idx < 0) idx = this.pickupTaken.length;
    idx = Math.min(idx, this.L.pickupSpots.length - 1);
    this.pickupTaken[idx] = c;
    c.pickupIdx = idx;
    const spot = this.L.pickupSpots[idx];
    this.goTo(c, { x: spot.x + rand(-0.1, 0.1), z: spot.z + rand(-0.05, 0.1) }, () => {
      if (c.state === 'toPickup') c.state = 'waitPickup';
      c.ch.faceAngle(Math.PI);
    });
    void by;
    return c;
  }

  waitingForPickup(): Customer[] {
    return this.customers.filter((c) => (c.state === 'waitPickup' || c.state === 'toPickup') && c.ticket);
  }

  /** Ausgabe eines Produkts. `target` erzwingt eine bestimmte Kund:in (Personal). */
  deliver(held: HeldItem, target?: Customer): { ok: boolean; customer: Customer | null } {
    let cands = this.waitingForPickup();
    if (target) cands = cands.filter((c) => c === target);
    if (!cands.length) return { ok: false, customer: null };
    if (held.base === 'drink') return { ok: false, customer: null };
    const exact = cands.filter((c) => exactMatch(held, c.order!)).sort((a, b) => a.ticket!.t - b.ticket!.t);
    let c: Customer;
    if (exact.length) c = exact[0];
    else c = [...cands].sort((a, b) => matchScore(held, b.order!) - matchScore(held, a.order!) || a.ticket!.t - b.ticket!.t)[0];
    const score = exactMatch(held, c.order!) ? 1 : matchScore(held, c.order!);
    const s = this.ctx.state;
    const pos = c.ch.position.clone().setY(2.3);
    if (score >= 1) {
      // perfekt!
      const speed = clamp(c.patience / c.patienceMax, 0, 1);
      const tip = Math.round(c.paid * (0.04 + 0.22 * speed) * TIP[c.persona] * (1 + Math.min(this.shop.cozy, 100) / 150) * 10) / 10;
      this.ctx.say(c.ch, pick(LINES[c.persona].happy), 'happy');
      if (tip > 0) {
        this.ctx.earn(tip, pos, 'Trinkgeld');
        this.tipsToday += tip;
        s.stats.tips += tip;
      }
      this.ctx.sfx.play('happy');
      this.finishPickup(c, held);
      return { ok: true, customer: c };
    }
    // falsch
    c.wrong++;
    s.stats.wrong++;
    this.ctx.sfx.play('wrong');
    this.ctx.floatText(pos, '−1 ★ Falsche Bestellung', '#ff6b7d');
    if (score >= 0.55 || c.wrong >= 2) {
      // grummelnd annehmen
      this.ctx.say(c.ch, pick(LINES[c.persona].wrong) + (score >= 0.55 ? ' …na gut.' : ' Ich nehm’s halt.'), 'angry');
      this.finishPickup(c, held);
      return { ok: true, customer: c };
    }
    const wanted = describeOrder(c.order!);
    const moan = pick(LINES[c.persona].wrong);
    this.ctx.say(c.ch, moan + '\nIch wollte: ' + wanted, 'angry',
      `${escapeHtml(moan)}<br><span class="small">Ich wollte:</span><br>${orderImg(c.order!, null, 'px-l', wanted)}`);
    c.patience -= c.patienceMax * 0.2;
    return { ok: false, customer: c };
  }

  private finishPickup(c: Customer, held: HeldItem): void {
    c.served = true;
    c.reordering = false;
    this.servedToday++;
    this.ctx.state.stats.served++;
    if (c.ticket) this.tickets = this.tickets.filter((t) => t !== c.ticket);
    c.ticket = null;
    if (c.pickupIdx >= 0) this.pickupTaken[c.pickupIdx] = null;
    c.pickupIdx = -1;
    c.waited += c.patienceMax - c.patience;
    c.ch.setHeld(productModel(held.base, held.variant, held.toppings, held.burnt));
    if (c.dineIn && c.seat) {
      c.state = 'toSeat';
      const seat = c.seat;
      this.goTo(c, { x: seat.x, z: seat.z }, () => {
        c.ch.sitAt(seat.x, seat.z, seat.angle, seat.height);
        c.state = 'eating';
        c.timer = rand(16, 28);
      });
    } else {
      this.writeReview(c);
      this.leave(c, false);
    }
  }

  // ------------------------------------------------------------ Bewertungen

  private writeReview(c: Customer): void {
    if (c.angry) return;
    const s = this.ctx.state;
    let stars = 3.5;
    const reasons: string[] = [];
    if (c.wrong === 0) stars += 1.0;
    else { stars -= 1.4 * c.wrong; reasons.push('wrong'); }
    const waitF = c.waited / Math.max(1, 120 * PATIENCE[c.persona]);
    if (waitF > 0.55) { stars -= (waitF - 0.55) * 2.2; reasons.push('wait'); }
    const ratio = c.paid / Math.max(0.5, c.fair);
    if (ratio > 1.2) { stars -= (ratio - 1.2) * 2.6; reasons.push('expensive'); }
    if (ratio < 0.85) { stars += 0.35; reasons.push('cheap'); }
    stars += Math.min(1.0, this.shop.cozy / 70);
    if (this.shop.cozy > 40) reasons.push('cozy');
    if (c.dineIn && c.seat) stars += 0.2;
    if (c.thoughts.includes('noSeat')) { stars -= 0.4; reasons.push('noSeat'); }
    if (c.thoughts.includes('thief')) { stars -= 0.3; }
    const st = clamp(Math.round(stars), 1, 5);
    let text: string;
    if (reasons.includes('wrong')) text = pick(LINES[c.persona].wrong);
    else if (reasons.includes('wait') && st <= 3) text = pick(['Hat ewig gedauert.', 'Lange Wartezeit, aber okay.', pick(LINES[c.persona].wait)]);
    else if (reasons.includes('expensive') && st <= 3) text = pick(GENERIC.expensive);
    else if (reasons.includes('noSeat') && st <= 3) text = pick(GENERIC.noSeat);
    else if (reasons.includes('cozy') && chance(0.4)) text = pick(GENERIC.cozyHigh);
    else if (reasons.includes('cheap') && chance(0.3)) text = pick(GENERIC.cheap);
    else text = pick(LINES[c.persona].happy);
    this.addReview(c, st, text);
    void s;
  }

  addReview(c: Customer, stars: number, text: string): void {
    const s = this.ctx.state;
    s.reviews.push({ stars, text, name: c.name, day: s.day });
    if (s.reviews.length > 80) s.reviews.splice(0, s.reviews.length - 80);
    c.angry = c.angry || stars <= 1;
  }

  // ------------------------------------------------------------ Gehen

  releaseSeat(c: Customer): void {
    if (c.seat) {
      if (c.seat.occupant === c) c.seat.occupant = null;
      c.seat = null;
    }
    if (c.group && c.group.table && c.group.members.every((m) => !m.seat || m === c)) {
      c.group.table.claimedBy = null;
    }
  }

  leave(c: Customer, angry: boolean): void {
    if (c.state === 'leaving' || c.state === 'gone') return;
    if (angry && !c.angry) {
      c.angry = true;
      this.addReview(c, 1, pick(GENERIC.leaveAngry));
      this.angryToday++;
    }
    const qi = this.queue.indexOf(c);
    if (qi >= 0) { this.queue.splice(qi, 1); this.advanceQueue(); }
    if (c.ticket) {
      this.tickets = this.tickets.filter((t) => t !== c.ticket);
      c.ticket = null;
      if (c.paid > 0) {
        this.ctx.spend(c.paid);
        this.revenueToday -= c.paid;
        this.ctx.floatText(c.ch.position.clone().setY(2.2), `−${c.paid.toFixed(2).replace('.', ',')} € Geld zurück`, '#ff6b7d');
      }
    }
    if (c.pickupIdx >= 0) this.pickupTaken[c.pickupIdx] = null;
    c.pickupIdx = -1;
    this.releaseSeat(c);
    c.state = 'leaving';
    c.ch.standUp();
    this.goOutside(c, () => {
      c.state = 'gone';
      c.ch.dispose();
    });
  }

  private groupLeave(g: Group): void {
    if (g.leaving) return;
    g.leaving = true;
    for (const m of g.members) {
      if (m.state === 'leaving' || m.state === 'gone') continue;
      if (m.served) this.writeReview(m);
      this.leave(m, false);
    }
    if (g.table) g.table.claimedBy = null;
  }

  // ------------------------------------------------------------ Update

  private updateCustomer(c: Customer, dt: number): void {
    c.ch.update(dt);
    const ctx = this.ctx;
    switch (c.state) {
      case 'atFridge':
        c.timer -= dt;
        if (c.timer <= 0) {
          c.ch.setHeld(productModel('drink', c.drink!, []));
          this.joinQueue(c);
        }
        break;
      case 'queue':
      case 'toQueue':
      case 'waitPickup':
      case 'toPickup': {
        const slow = c.state === 'waitPickup' || c.state === 'toPickup' ? 0.85 : 1;
        c.patience -= dt * slow;
        if (c.patience < c.patienceMax * 0.3 && chance(dt * 0.08)) ctx.say(c.ch, pick(LINES[c.persona].wait));
        if (c.patience <= 0) {
          ctx.sfx.play('wrong');
          ctx.say(c.ch, pick(GENERIC.leaveAngry), 'angry');
          if (c.group) {
            // Gruppe geht mit
            for (const m of c.group.members) if (m !== c) this.leave(m, false);
          }
          this.leave(c, true);
        }
        break;
      }
      case 'eating': {
        c.timer -= dt;
        const held = c.ch.hand.children[0];
        if (held) held.scale.setScalar(Math.max(0.35, 0.4 + (c.timer / 28) * 0.6));
        c.chatT -= dt;
        if (c.chatT <= 0) {
          c.chatT = rand(6, 14) * (c.group ? 1 : 2);
          if (c.group || chance(0.4)) ctx.say(c.ch, pick(LINES[c.persona].chat));
          if (c.persona === 'influencer' && chance(0.4)) ctx.say(c.ch, pick(GENERIC.photo));
        }
        if (c.timer <= 0) {
          c.ch.setHeld(null);
          c.state = 'seated';
          c.timer = rand(3, 8);
          this.writeReviewOnce(c);
        }
        break;
      }
      case 'seated': {
        c.timer -= dt;
        c.chatT -= dt;
        if (c.chatT <= 0 && c.group) {
          c.chatT = rand(5, 12);
          ctx.say(c.ch, pick(LINES[c.persona].chat));
        }
        if (c.timer > 0) break;
        const drinksAvail = ['kaffeemaschine', 'matchabar'].some((m) => ctx.state.equipment.includes(m));
        if (c.group) {
          const g = c.group;
          const allDone = g.members.every((m) => m.state === 'seated' || m.state === 'gone' || m.state === 'leaving' || m.reordering);
          const someoneReordering = g.members.some((m) => m.reordering);
          if (!allDone || someoneReordering) { c.timer = 2; break; }
          if (drinksAvail && g.reorders < 2 && ctx.isOpen() && chance(0.55)) {
            g.reorders++;
            this.reorder(c);
          } else this.groupLeave(g);
        } else {
          if (drinksAvail && !c.reordering && ctx.isOpen() && chance(0.2) && !c.thoughts.includes('reordered')) {
            c.thoughts.push('reordered');
            this.reorder(c);
          } else {
            this.leave(c, false);
          }
        }
        break;
      }
    }
  }

  private reviewed = new Set<number>();
  private writeReviewOnce(c: Customer): void {
    if (this.reviewed.has(c.id)) return;
    this.reviewed.add(c.id);
    if (!c.group) this.writeReview(c);
  }

  private reorder(c: Customer): void {
    c.reordering = true;
    c.served = false;
    c.ch.standUp();
    this.ctx.say(c.ch, pick(GENERIC.reorder));
    // Sitzplatz bleibt reserviert
    const seat = c.seat;
    if (this.queue.length >= this.L.queueSpots.length) {
      c.reordering = false;
      c.state = 'seated';
      c.timer = 4;
      if (seat) c.ch.sitAt(seat.x, seat.z, seat.angle, seat.height);
      return;
    }
    this.queue.push(c);
    c.state = 'toQueue';
    c.patienceMax = 80 * PATIENCE[c.persona];
    c.patience = c.patienceMax;
    this.walkQueue(c);
  }

  /** Ladenschluss: Wartende ohne Bestellung gehen */
  closeAll(): void {
    for (const c of [...this.customers]) {
      if (c.state === 'leaving' || c.state === 'gone') continue;
      if (c.state === 'queue' || c.state === 'toQueue' || c.state === 'arrive' || c.state === 'toFridge' || c.state === 'atFridge') {
        this.ctx.say(c.ch, 'Oh, schon zu? Schade!');
        this.leave(c, false);
      }
    }
  }

  clearAll(): void {
    for (const c of this.customers) c.ch.dispose();
    this.customers = [];
    this.queue = [];
    this.tickets = [];
    this.groups = [];
    this.pickupTaken = [];
    for (const s of this.shop.seats) s.occupant = null;
    for (const t of this.shop.tables) t.claimedBy = null;
  }

  resetDay(): void {
    this.servedToday = 0;
    this.revenueToday = 0;
    this.tipsToday = 0;
    this.angryToday = 0;
    this.spawnT = 0.4;
  }

  /** Lager prüfen: kann das Produkt hergestellt werden? */
  static stockKey(o: OrderItem): string { return stockIdFor(o.base, o.variant); }
}

export function isInside(p: THREE.Vector3): boolean { return p.z < 0; }
