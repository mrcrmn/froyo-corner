import * as THREE from 'three';
import type { Game } from './game';
import {
  FLAVORS, WAFFLES, COFFEES, MATCHAS, Variant, stockIdFor, BaseKind, TOPPING_BY_ID, BATCH, MACHINE_CAP, VARIANT_BY_ID,
} from '../data/catalog';
import { availableToppings, describeOrder } from './orders';
import { PLAYER_LINES } from '../data/dialogue';
import { pick } from '../core/util';
import { isTouch } from '../ui/touch';
import { productUrl, toppingUrl } from '../ui/pixelart';

export interface ChoiceOption {
  label: string;
  sub?: string;
  color?: number;
  /** Pixel-Art (URL) – dann als Kachel statt als Textknopf */
  icon?: string;
  /** Zahl auf der Kachel (z.B. Vorrat) */
  badge?: string;
  /** schon gewählt (z.B. Topping liegt drauf) */
  picked?: boolean;
  disabled?: boolean;
  action: () => void;
}
export interface ChoicePanel {
  title: string;
  hint?: string;
  /** Bild in der Titelzeile, z.B. das Produkt in der Hand */
  icon?: string;
  options: ChoiceOption[];
  keepOpen?: boolean;
  station: string;
}

export interface Target {
  id: string;
  label: string;
  /** Punkt, zu dem sich der Spieler beim Benutzen dreht */
  x: number;
  z: number;
}

const STATION_LABEL: Record<string, string> = {
  zapfer: 'Joghurt-Zapfer',
  eismaschine: 'Eismaschine',
  waffeleisen: 'Waffeleisen',
  kaffeemaschine: 'Kaffeemaschine',
  matchabar: 'Matcha-Bar',
  trash: 'Mülleimer',
  vorratskuehlschrank: 'Vorratskühlschrank',
  getraenkekuehlschrank: 'Getränkekühlschrank',
  kasse: 'Kasse',
  ausgabe: 'Ausgabe',
  toppings: 'Topping-Bar',
  ruehrwerk: 'Rührwerk',
  basisregal: 'Basis-Kühlregal',
};

/** Sekunden fürs Anrühren eines Kanisters */
const MIX_TIME = 4;

const WAFFLE_DONE = 6.5;
const WAFFLE_BURN = 14;

export class Interactions {
  waffle: { variant: string; t: number } | null = null;
  /** Rührwerk läuft gerade */
  mixing = false;
  work: { t: number; max: number; label: string; done: () => void } | null = null;
  private sizzleT = 0;

  constructor(private g: Game) {}

  get busy(): boolean { return !!this.work; }

  update(dt: number): void {
    if (this.work) {
      this.work.t += dt;
      if (this.work.t >= this.work.max) {
        const w = this.work;
        this.work = null;
        w.done();
      }
    }
    const parts = this.g.shop.waffle;
    if (this.waffle) {
      this.waffle.t += dt;
      this.sizzleT -= dt;
      if (this.sizzleT <= 0 && this.waffle.t < WAFFLE_BURN) { this.sizzleT = 1.2; if (this.nearPlayer('waffeleisen', 4)) this.g.sfx.play('sizzle'); }
      if (this.waffle.t >= WAFFLE_DONE && this.waffle.t - dt < WAFFLE_DONE) {
        this.g.sfx.play('ding');
        const st = this.g.shop.stations.get('waffeleisen');
        if (st) this.g.floatText(new THREE.Vector3(st.x, 1.6, st.iz - 0.8), 'Waffel fertig!', '#ffe066');
      }
      if (this.waffle.t >= WAFFLE_BURN && this.waffle.t - dt < WAFFLE_BURN) {
        const st = this.g.shop.stations.get('waffeleisen');
        if (st) this.g.floatText(new THREE.Vector3(st.x, 1.6, st.iz - 0.8), 'Verbrannt! 🔥', '#ff6b7d');
        this.g.sfx.play('wrong');
      }
    }
    const mixer = this.g.shop.mixer;
    if (mixer) {
      if (!this.work) this.mixing = false;
      if (this.mixing) mixer.paddle.rotation.y += dt * 14;
      (mixer.lamp.material as THREE.MeshBasicMaterial).color.set(this.mixing ? 0xffa030 : 0x55ff77);
    }
    if (parts) {
      const mat = parts.lamp.material as THREE.MeshBasicMaterial;
      if (!this.waffle) mat.color.set(0x55ff77);
      else if (this.waffle.t < WAFFLE_DONE) mat.color.set(Math.sin(performance.now() / 150) > 0 ? 0xffa030 : 0x6b3a10);
      else if (this.waffle.t < WAFFLE_BURN) mat.color.set(0xffff55);
      else mat.color.set(0xff2020);
      parts.lid.rotation.x = this.waffle ? 0 : -0.9;
    }
  }

  private nearPlayer(id: string, r: number): boolean {
    const st = this.g.shop.stations.get(id);
    if (!st) return false;
    const p = this.g.player.pos;
    return Math.hypot(p.x - st.ix, p.z - st.iz) < r;
  }

  /** nächstgelegenes Ziel für E */
  nearest(): Target | null {
    const p = this.g.player.pos;
    const th = this.g.thief;
    if (th && th.state === 'steal' && Math.hypot(th.ch.position.x - p.x, th.ch.position.z - p.z) < 2.0) {
      return { id: 'thief', label: 'Dem Dieb auf die Finger hauen!', x: th.ch.position.x, z: th.ch.position.z };
    }
    let best: Target | null = null;
    let bd = 0.95;
    for (const st of this.g.shop.stations.values()) {
      const d = Math.hypot(p.x - st.ix, p.z - st.iz);
      if (d < bd) {
        bd = d;
        best = { id: st.id, label: this.labelFor(st.id), x: st.face?.x ?? st.x, z: st.face?.z ?? st.iz - 1 };
      }
    }
    return best;
  }

  private labelFor(id: string): string {
    const held = this.g.player.held;
    const carry = this.g.player.carry;
    if (carry) {
      const f = VARIANT_BY_ID.get(carry);
      if (f && id === f.machine) return `Kanister ${f.name} einfüllen`;
      if (id === 'trash') return 'Kanister auskippen';
      if (id === 'ruehrwerk') return 'Kanister zur Maschine bringen';
    }
    switch (id) {
      case 'kasse': {
        const f = this.g.cm.frontCustomer();
        return f ? `Bestellung von ${f.name} aufnehmen` : 'Kasse (niemand wartet)';
      }
      case 'ausgabe':
        return held ? `${describeOrder(held)} ausgeben` : 'Ausgabe (nichts in der Hand)';
      case 'toppings':
        return held && (held.base === 'froyo' || held.base === 'waffle') ? 'Toppings hinzufügen' : 'Topping-Bar (erst Joghurt oder Waffel holen)';
      case 'trash':
        return held ? 'Wegwerfen' : 'Mülleimer';
      case 'waffeleisen':
        if (this.waffle) return this.waffle.t >= WAFFLE_DONE ? 'Waffel herausnehmen' : 'Waffel backt…';
        return 'Waffel backen';
      case 'vorratskuehlschrank':
      case 'basisregal':
        return 'Vorrat & Einkauf öffnen';
      case 'ruehrwerk':
        return `Joghurt anrühren (Basis: ${this.g.state.stock.basis ?? 0})`;
      case 'getraenkekuehlschrank':
        return 'Getränkekühlschrank (Kund:innen bedienen sich)';
      default:
        return STATION_LABEL[id] ?? id;
    }
  }

  interact(): void {
    if (this.work) return;
    const t = this.nearest();
    if (!t) return;
    const g = this.g;
    const held = g.player.held;
    g.player.faceTo(t.x, t.z);
    if (g.player.carry && t.id !== 'thief' && this.useCarry(t.id)) return;
    switch (t.id) {
      case 'thief':
        g.player.slap();
        g.say(g.player.ch, pick(PLAYER_LINES.slap));
        g.thief?.slapped();
        return;
      case 'kasse': {
        const c = g.cm.takeOrder(g.player);
        if (!c && !g.cm.frontCustomer()) g.toast('Gerade wartet niemand an der Kasse.');
        return;
      }
      case 'ausgabe': {
        if (!held) { g.toast('Du hast nichts in der Hand.'); return; }
        if (held.base === 'drink') { g.toast('Getränke nehmen sich die Gäste selbst.'); return; }
        const res = g.cm.deliver(held);
        if (!res.customer) { g.toast('Niemand wartet auf eine Bestellung.'); return; }
        if (res.ok) g.player.setHeld(null);
        return;
      }
      case 'trash':
        if (held) {
          g.player.setHeld(null);
          g.sfx.play('trash');
        }
        return;
      case 'vorratskuehlschrank':
      case 'getraenkekuehlschrank':
      case 'basisregal':
        g.ui.openPanel('lager');
        return;
      case 'ruehrwerk':
        this.openMixer();
        return;
      case 'toppings':
        if (!held || (held.base !== 'froyo' && held.base !== 'waffle')) {
          g.toast('Hol zuerst einen Frozen Yogurt oder eine Waffel.');
          return;
        }
        this.openToppings();
        return;
      case 'waffeleisen':
        if (this.waffle) {
          if (this.waffle.t < WAFFLE_DONE) { g.toast('Die Waffel ist noch nicht fertig.'); return; }
          if (held) { g.toast('Du hast schon etwas in der Hand.'); return; }
          const burnt = this.waffle.t >= WAFFLE_BURN;
          g.player.setHeld({ base: 'waffle', variant: this.waffle.variant, toppings: [], burnt });
          this.waffle = null;
          g.sfx.play('pop');
          if (burnt) g.toast('Oh je – die Waffel ist verbrannt. Lieber wegwerfen!', 'bad');
          return;
        }
        this.openBase('waffle', 'waffeleisen', WAFFLES);
        return;
      case 'zapfer':
        this.openBase('froyo', 'zapfer', FLAVORS.filter((f) => f.machine === 'zapfer'));
        return;
      case 'eismaschine':
        this.openBase('froyo', 'eismaschine', FLAVORS.filter((f) => f.machine === 'eismaschine'));
        return;
      case 'kaffeemaschine':
        this.openBase('coffee', 'kaffeemaschine', COFFEES);
        return;
      case 'matchabar':
        this.openBase('matcha', 'matchabar', MATCHAS);
        return;
    }
  }

  /** Mit Kanister in der Hand: einfüllen, auskippen – oder freundlich daran erinnern */
  private useCarry(id: string): boolean {
    const g = this.g;
    const f = VARIANT_BY_ID.get(g.player.carry!)!;
    if (id === f.machine) {
      const key = stockIdFor('froyo', f.id);
      g.state.stock[key] = (g.state.stock[key] ?? 0) + BATCH;
      g.player.setCarry(null);
      g.sfx.play('pour');
      const st = g.shop.stations.get(id);
      if (st) g.floatText(new THREE.Vector3(st.x, 2.2, st.iz - 0.8), `+${BATCH} ${f.name}`, '#7fd6b4');
      return true;
    }
    if (id === 'trash') {
      g.player.setCarry(null);
      g.sfx.play('trash');
      g.toast(`Kanister ${f.name} ausgekippt.`);
      return true;
    }
    if (id === 'kasse' || id === 'basisregal') return false;
    g.toast(`Erst den Kanister in ${id === 'ruehrwerk' ? 'die Maschine' : 'den ' + STATION_LABEL[f.machine]} füllen.`);
    return true;
  }

  /** Rührwerk im Nebenraum: Basis + Sorte → ein Kanister für Zapfer bzw. Eismaschine */
  openMixer(): void {
    const g = this.g;
    if (g.player.held) { g.toast('Erst die Hände frei machen – ausgeben oder wegwerfen.'); return; }
    const s = g.state;
    const basis = s.stock.basis ?? 0;
    const vs = FLAVORS.filter((f) => s.unlocked.includes(f.id) && s.equipment.includes(f.machine));
    g.ui.showChoice({
      title: 'Rührwerk',
      station: 'ruehrwerk',
      hint: basis < BATCH ? `Zu wenig Basis (${basis}) – im Kühlregal nachbestellen.`
        : `Basis: ${basis} · ein Kanister = ${BATCH} Portionen. Danach zur Maschine tragen.`,
      options: vs.map((f) => {
        const key = stockIdFor('froyo', f.id);
        const n = s.stock[key] ?? 0;
        const full = n >= MACHINE_CAP;
        return {
          label: f.name,
          sub: full ? 'Maschine ist voll' : `in der Maschine: ${n}`,
          icon: productUrl({ base: 'froyo', variant: f.id, toppings: [] }),
          badge: String(n),
          disabled: basis < BATCH || full,
          action: () => {
            if ((s.stock.basis ?? 0) < BATCH) return;
            s.stock.basis -= BATCH;
            g.sfx.play('pour');
            this.mixing = true;
            this.work = {
              t: 0, max: MIX_TIME, label: `${f.name} anrühren`,
              done: () => { this.mixing = false; g.player.setCarry(f.id); g.sfx.play('ding'); },
            };
          },
        };
      }),
    });
  }

  private openBase(base: BaseKind, station: string, list: Variant[]): void {
    const g = this.g;
    if (g.player.held) { g.toast('Du hast schon etwas in der Hand – erst ausgeben oder wegwerfen.'); return; }
    const vs = list.filter((v) => g.state.unlocked.includes(v.id));
    if (!vs.length) { g.toast('Noch keine Sorte freigeschaltet – schau im Shop vorbei.'); return; }
    const time: Record<BaseKind, number> = { froyo: 1.2, waffle: 0, coffee: 2.2, matcha: 2.6 };
    g.ui.showChoice({
      title: STATION_LABEL[station],
      station,
      hint: base === 'waffle' ? 'Die Waffel backt von selbst – nicht zu lange drin lassen!' : undefined,
      options: vs.map((v) => {
        const key = stockIdFor(base, v.id);
        const n = g.state.stock[key] ?? 0;
        return {
          label: v.name,
          sub: base === 'coffee' ? `Vorrat: ${n}` : `${n} Portionen`,
          icon: productUrl({ base, variant: v.id, toppings: [] }),
          badge: String(n),
          disabled: n <= 0,
          action: () => {
            if ((g.state.stock[key] ?? 0) <= 0) { g.say(g.player.ch, pick(PLAYER_LINES.noStock)); return; }
            g.state.stock[key]--;
            if (base === 'waffle') {
              this.waffle = { variant: v.id, t: 0 };
              g.sfx.play('sizzle');
              return;
            }
            g.sfx.play('pour');
            this.work = {
              t: 0, max: time[base], label: v.name,
              done: () => { g.player.setHeld({ base, variant: v.id, toppings: [], burnt: false }); g.sfx.play('pop'); },
            };
          },
        };
      }),
    });
  }

  openToppings(): void {
    const g = this.g;
    const held = g.player.held;
    if (!held) return;
    const avail = availableToppings(g.state);
    g.ui.showChoice({
      title: 'Topping-Bar',
      station: 'toppings',
      keepOpen: true,
      // was schon drauf ist, zeigt das Bild in der Titelzeile
      icon: productUrl(held),
      hint: held.toppings.length >= 6 ? 'Mehr passt nicht drauf!'
        : held.toppings.length ? undefined
          : isTouch() ? 'Mehrere möglich – dann „Fertig ✓“.' : 'Mehrere möglich. Esc/E zum Schließen.',
      options: avail.map((t) => {
        const n = g.state.stock['top_' + t.id] ?? 0;
        const has = held.toppings.includes(t.id);
        return {
          label: t.name,
          sub: `${n} übrig`,
          icon: toppingUrl(t.id),
          badge: String(n),
          picked: has,
          disabled: n <= 0 || has || held.toppings.length >= 6,
          action: () => {
            const h = g.player.held;
            if (!h || h.toppings.includes(t.id) || (g.state.stock['top_' + t.id] ?? 0) <= 0) return;
            g.state.stock['top_' + t.id]--;
            h.toppings.push(t.id);
            g.player.refreshHeld();
            g.sfx.play('pop');
            this.openToppings();
          },
        };
      }),
    });
  }
}
