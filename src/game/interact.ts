import * as THREE from 'three';
import type { Game } from './game';
import { FLAVORS, WAFFLES, COFFEES, MATCHAS, Variant, stockIdFor, BaseKind, TOPPING_BY_ID } from '../data/catalog';
import { availableToppings, describeOrder } from './orders';
import { PLAYER_LINES } from '../data/dialogue';
import { pick } from '../core/util';

export interface ChoiceOption {
  label: string;
  sub?: string;
  color?: number;
  disabled?: boolean;
  action: () => void;
}
export interface ChoicePanel {
  title: string;
  hint?: string;
  options: ChoiceOption[];
  keepOpen?: boolean;
  station: string;
}

export interface Target {
  id: string;
  label: string;
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
};

const WAFFLE_DONE = 6.5;
const WAFFLE_BURN = 14;

export class Interactions {
  waffle: { variant: string; t: number } | null = null;
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
        best = { id: st.id, label: this.labelFor(st.id), x: st.x, z: st.iz };
      }
    }
    return best;
  }

  private labelFor(id: string): string {
    const held = this.g.player.held;
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
        return 'Vorrat & Einkauf öffnen';
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
    g.player.faceTo(t.x, t.z - (t.id === 'thief' ? 0 : 1));
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
        g.ui.openPanel('lager');
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
          color: v.color,
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
      hint: held.toppings.length ? 'Drauf: ' + held.toppings.map((t) => TOPPING_BY_ID.get(t)?.name).join(', ') : 'Wähle Toppings (mehrere möglich). Esc/E zum Schließen.',
      options: avail.map((t) => {
        const n = g.state.stock['top_' + t.id] ?? 0;
        const has = held.toppings.includes(t.id);
        return {
          label: (has ? '✓ ' : '') + t.name,
          sub: `${n} übrig`,
          color: t.color,
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
