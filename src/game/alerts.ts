import * as THREE from 'three';
import type { Game } from './game';
import { FLAVORS, WAFFLES, MATCHAS, DRINKS, stockDefs } from '../data/catalog';
import { availableToppings } from './orders';

export type AlertLevel = 'low' | 'out';
export interface StationAlert { id: string; pos: THREE.Vector3; level: AlertLevel; text: string }

/** ab hier gilt ein Vorrat als knapp */
const LOW = 5;
const NAME = new Map(stockDefs().map((d) => [d.id, d.name]));

/**
 * Vorrats-Warnungen: „!“ über den Geräten, deren Vorrat knapp oder leer ist,
 * plus einmaliger Hinweis, sobald etwas knapp wird bzw. ausgeht.
 */
export class StockAlerts {
  alerts: StationAlert[] = [];
  /** zuletzt gemeldeter Stand je Vorrat – damit jeder Hinweis nur einmal kommt */
  private told = new Map<string, AlertLevel>();
  private t = 0;
  private first = true;

  constructor(private g: Game) {}

  /** Welche Vorräte hängen an welcher Station (nur freigeschaltete) */
  private stockFor(station: string): string[] {
    const s = this.g.state;
    const un = (id: string) => s.unlocked.includes(id);
    switch (station) {
      case 'zapfer':
      case 'eismaschine':
        return FLAVORS.filter((f) => f.machine === station && un(f.id)).map((f) => 'froyo_' + f.id);
      case 'waffeleisen': return WAFFLES.filter((w) => un(w.id)).map((w) => 'waffle_' + w.id);
      case 'kaffeemaschine': return ['coffee'];
      case 'matchabar': return MATCHAS.filter((m) => un(m.id)).map((m) => 'matcha_' + m.id);
      case 'toppings': return availableToppings(s).map((t) => 'top_' + t.id);
      case 'getraenkekuehlschrank': return DRINKS.filter((d) => un(d.id)).map((d) => 'drink_' + d.id);
      default: return [];
    }
  }

  update(dt: number): void {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 0.5;
    const g = this.g;
    const stock = g.state.stock;
    const L = g.shop.layout;
    const out: StationAlert[] = [];
    const news: { id: string; level: AlertLevel }[] = [];
    for (const st of g.shop.stations.values()) {
      const ids = this.stockFor(st.id);
      if (!ids.length) continue;
      const empty = ids.filter((id) => (stock[id] ?? 0) <= 0);
      const low = ids.filter((id) => (stock[id] ?? 0) > 0 && (stock[id] ?? 0) <= LOW);
      for (const id of ids) {
        const lv: AlertLevel | null = empty.includes(id) ? 'out' : low.includes(id) ? 'low' : null;
        const before = this.told.get(id);
        if (!lv) { this.told.delete(id); continue; }
        if (before !== lv && !(before === 'out' && lv === 'low')) news.push({ id, level: lv });
        this.told.set(id, lv);
      }
      if (!empty.length && !low.length) continue;
      const pos = new THREE.Vector3();
      if (st.group.parent) st.group.getWorldPosition(pos);
      else pos.set(st.x, 0, L.counterZ);
      pos.y += st.group.parent ? 2.1 : 1.6;
      const names = (list: string[]) => list.map((id) => NAME.get(id) ?? id).join(', ');
      out.push({
        id: st.id,
        pos,
        level: empty.length ? 'out' : 'low',
        text: (empty.length ? `Leer: ${names(empty)}` : '') + (empty.length && low.length ? ' · ' : '') + (low.length ? `Knapp: ${names(low)}` : ''),
      });
    }
    this.alerts = out;
    // beim Laden nicht gleich alles aufzählen – die „!“ zeigen es ja
    if (this.first) { this.first = false; return; }
    const outs = news.filter((n) => n.level === 'out');
    const lows = news.filter((n) => n.level === 'low');
    const names = (list: { id: string }[]) => list.map((n) => NAME.get(n.id) ?? n.id).join(', ');
    if (outs.length) {
      g.toast(`❗ ${names(outs)} ist alle – im 📦 Lager nachbestellen!`, 'bad');
      g.sfx.play('wrong');
    } else if (lows.length) {
      g.toast(`⚠️ ${names(lows)} wird knapp.`);
    }
  }
}
