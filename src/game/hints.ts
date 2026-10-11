import type { Game } from './game';
import type { Character } from '../entities/character';
import type { Persona } from '../data/dialogue';
import {
  BaseKind, DRINKS, EQUIPMENT_BY_ID, FLAVORS, LEVELS, TOPPINGS, VARIANTS, Variant,
} from '../data/catalog';
import { itemName } from './orders';
import { TRASH_CAP } from './mess';
import { productImg, productUrl, toppingImg, toppingUrl } from '../ui/pixelart';
import { chance, escapeHtml, money, pick, pickWeighted } from '../core/util';

/** Etwas, das sich Gäste wünschen können */
interface Wish {
  id: string;
  name: string;
  /** Was muss gekauft werden: Gerät oder Freischaltung */
  kind: 'equipment' | 'unlock';
  cost: number;
  /** fehlendes Gerät, das vorher nötig ist */
  needs?: string;
  line: string;
  img: string;
  icon: string;
  weight: number;
}

export interface Hint {
  id: string;
  icon: string;
  title: string;
  text: string;
  action?: { label: string; run: () => void };
}

/** Basis-Gerät → was Gäste dann vermissen */
const MACHINE_BASE: Record<string, { base: BaseKind; variant: string; lines: string[] }> = {
  waffeleisen: { base: 'waffle', variant: 'klassisch', lines: ['Habt ihr keine Waffeln? Schade!', 'Hier riecht’s gar nicht nach Waffeln…'] },
  kaffeemaschine: { base: 'coffee', variant: 'cappuccino', lines: ['Ein Kaffee wäre jetzt toll – gibt’s hier keinen?', 'Kein Cappuccino? Echt jetzt?'] },
  matchabar: { base: 'matcha', variant: 'matchalatte', lines: ['Kein Matcha Latte? Den gibt’s doch überall!', 'Ich hätte so gern einen Matcha…'] },
  eismaschine: { base: 'froyo', variant: 'mango', lines: ['Mango-Froyo wär’s jetzt!', 'Habt ihr kein Schoko-Froyo?'] },
};

/** ab so vielen Nachfragen gibt es einen Hinweis */
const WISH_HINT = [3, 8];
/** mindestens so viele Sekunden (echte Zeit) zwischen zwei Hinweisen */
const GAP = 40;

const BASE_PREF: Record<Persona, Partial<Record<BaseKind, number>>> = {
  naschkatze: { waffle: 3 }, gesund: { matcha: 3 }, hipster: { matcha: 3, coffee: 2 }, oma: { waffle: 3, coffee: 3 },
  kind: { waffle: 3 }, business: { coffee: 4 }, tourist: { waffle: 2 }, influencer: { matcha: 3 }, student: { coffee: 2 },
};

/**
 * Hinweise, wie es weitergeht: Wünsche der Gäste („Habt ihr Karamellsoße?“)
 * und Tipps zum Fortschritt („Zeit für ein Waffeleisen“). Jeder Hinweis kommt nur einmal.
 */
export class Hints {
  private cool = 12;
  private t = 0;
  private queue: Hint[] = [];

  constructor(private g: Game) {}

  // ---------------- Wünsche

  private wishes(persona: Persona): Wish[] {
    const s = this.g.state;
    const has = (eq: string) => s.equipment.includes(eq);
    const out: Wish[] = [];
    for (const t of TOPPINGS) {
      if (s.unlocked.includes(t.id) && (!t.needs || has(t.needs))) continue;
      out.push({
        id: t.id, name: t.name, kind: 'unlock', cost: t.unlockCost, needs: t.needs && !has(t.needs) ? t.needs : undefined,
        line: pick([`Habt ihr auch ${t.name}?`, `Mit ${t.name} wär’s perfekt gewesen!`, `Nächstes Mal gern mit ${t.name}!`]),
        img: toppingImg(t.id, 'px-m'), icon: toppingUrl(t.id),
        weight: persona === 'gesund' && t.fruit ? 3 : (persona === 'naschkatze' || persona === 'kind') && t.sweet ? 2 : 1,
      });
    }
    for (const v of VARIANTS) {
      if (s.unlocked.includes(v.id) || !has(v.machine)) continue;
      const name = itemName(v.base, v.id);
      out.push({
        id: v.id, name, kind: 'unlock', cost: v.unlockCost,
        line: pick([`Habt ihr auch ${name}?`, `Ich hätte so gern mal ${name} probiert.`]),
        img: this.variantImg(v), icon: productUrl({ base: v.base, variant: v.id, toppings: [] }), weight: 1.2,
      });
    }
    for (const [eq, m] of Object.entries(MACHINE_BASE)) {
      if (has(eq)) continue;
      const e = EQUIPMENT_BY_ID.get(eq)!;
      const p = { base: m.base, variant: m.variant, toppings: [] };
      out.push({
        id: eq, name: e.name, kind: 'equipment', cost: e.price, line: pick(m.lines),
        img: productImg(p, 'px-m', e.name), icon: productUrl(p), weight: 1.5 + (BASE_PREF[persona][m.base] ?? 0),
      });
    }
    if (!has('getraenkekuehlschrank')) {
      const p = { base: 'drink' as const, variant: DRINKS[0].id, toppings: [] };
      out.push({
        id: 'getraenkekuehlschrank', name: 'Getränkekühlschrank', kind: 'equipment', cost: EQUIPMENT_BY_ID.get('getraenkekuehlschrank')!.price,
        line: pick(['Gibt’s hier nichts zu trinken?', 'Eine kalte Limo dazu wär super…']),
        img: productImg(p, 'px-m', 'Getränk'), icon: productUrl(p), weight: 1.2,
      });
    }
    return out;
  }

  private variantImg(v: Variant): string {
    return productImg({ base: v.base, variant: v.id, toppings: [] }, 'px-m', v.name);
  }

  /** Zufriedene Gäste äußern ab und zu einen Wunsch */
  maybeWish(ch: Character, persona: Persona): void {
    if (!chance(0.3) || !ch.root.parent) return;
    const list = this.wishes(persona);
    if (!list.length) return;
    const w = pickWeighted(list, (x) => x.weight);
    const s = this.g.state;
    const n = (s.wishes[w.id] = (s.wishes[w.id] ?? 0) + 1);
    this.g.say(ch, w.line, 'normal', `<span class="bubble-wish">${w.img}<span>${escapeHtml(w.line)}</span></span>`);
    const step = WISH_HINT.find((k) => k === n);
    if (step) this.push(this.wishHint(w, n), `wish:${w.id}:${step}`);
  }

  private wishHint(w: Wish, n: number): Hint {
    const shopAt = (tab: string) => () => this.g.ui.openShop(tab);
    const head = `${n} Gäste haben nach <b>${escapeHtml(w.name)}</b> gefragt.`;
    if (w.needs) {
      const e = EQUIPMENT_BY_ID.get(w.needs)!;
      return {
        id: '', icon: w.icon, title: 'Wunsch der Gäste',
        text: `${head} Dafür brauchst du zuerst: ${escapeHtml(e.name)} (${money(e.price)}).`,
        action: { label: '🛍️ Zur Ausstattung', run: shopAt('ausstattung') },
      };
    }
    return {
      id: '', icon: w.icon, title: 'Wunsch der Gäste',
      text: `${head} ${w.kind === 'equipment' ? 'Kaufen' : 'Freischalten'} kostet ${money(w.cost)}.`,
      action: { label: '🛍️ Zum Shop', run: shopAt(w.kind === 'equipment' ? 'ausstattung' : 'sorten') },
    };
  }

  // ---------------- Fortschritts-Tipps

  private progressHint(): { key: string; hint: Hint } | null {
    const g = this.g;
    const s = g.state;
    const seen = (k: string) => s.hintsSeen.includes(k);
    const cash = s.money;
    // Joghurt wird knapp → Nebenraum zeigen
    const lowFlavor = FLAVORS.find((f) => s.unlocked.includes(f.id) && s.equipment.includes(f.machine) && (s.stock['froyo_' + f.id] ?? 0) <= 12);
    if (lowFlavor && !seen('backroom')) {
      return {
        key: 'backroom',
        hint: {
          id: '', icon: productUrl({ base: 'froyo', variant: lowFlavor.id, toppings: [] }), title: 'Joghurt selbst anrühren',
          text: `<b>${escapeHtml(lowFlavor.name)}</b> geht bald aus. Geh durch die Tür in der Rückwand in den <b>Nebenraum</b>: Am <b>Rührwerk</b> wird aus Joghurt-Basis ein Kanister – den trägst du zur Maschine.`,
        },
      };
    }
    // Sauberkeit
    if (g.mess.dirtyTables().length && !seen('tables')) {
      return {
        key: 'tables',
        hint: {
          id: '', icon: '', title: 'Tische abräumen',
          text: 'Gäste lassen ihre Becher stehen. Auf einen <b>schmutzigen Tisch</b> setzt sich niemand – also abräumen und das Tablett in den <b>Mülleimer</b> hinter der Theke leeren.',
        },
      };
    }
    if (g.mess.spills.length && !seen('spill')) {
      return {
        key: 'spill',
        hint: {
          id: '', icon: '', title: 'Gekleckert!',
          text: 'Da ist etwas auf den Boden getropft. <b>Aufwischen</b>, bevor jemand reintritt – Kleckse gibt’s sonst in den Bewertungen zurück.',
        },
      };
    }
    if (s.trash >= TRASH_CAP - 2 && !seen('trash')) {
      return {
        key: 'trash',
        hint: {
          id: '', icon: '', title: 'Müll rausbringen',
          text: 'Der Mülleimer ist bald voll. Nimm den <b>Müllsack</b> heraus und bring ihn durch die Eingangstür zur <b>Tonne an der Straße</b>. Läuft er über, landet alles auf dem Boden.',
        },
      };
    }
    // nächstes Gerät – das, wonach am meisten gefragt wurde, sonst in dieser Reihenfolge
    const missing = ['waffeleisen', 'kaffeemaschine', 'getraenkekuehlschrank', 'matchabar', 'vorratskuehlschrank', 'eismaschine']
      .filter((id) => !s.equipment.includes(id))
      .map((id) => EQUIPMENT_BY_ID.get(id)!)
      .sort((a, b) => (s.wishes[b.id] ?? 0) - (s.wishes[a.id] ?? 0));
    const next = missing[0];
    if (next && s.day >= 2 && cash >= next.price + 120 && !seen('eq:' + next.id)) {
      const m = MACHINE_BASE[next.id];
      const icon = m ? productUrl({ base: m.base, variant: m.variant, toppings: [] })
        : next.id === 'getraenkekuehlschrank' ? productUrl({ base: 'drink', variant: DRINKS[0].id, toppings: [] })
        : toppingUrl('erdbeeren');
      return {
        key: 'eq:' + next.id,
        hint: {
          id: '', icon, title: 'Zeit für etwas Neues',
          text: `Du hast ${money(cash)} – genug für: <b>${escapeHtml(next.name)}</b> (${money(next.price)}). ${escapeHtml(next.desc)}`,
          action: { label: '🛍️ Zur Ausstattung', run: () => g.ui.openShop('ausstattung') },
        },
      };
    }
    if (s.day >= 3 && !s.staff.length && s.stats.served >= 25 && !seen('staff')) {
      return {
        key: 'staff',
        hint: {
          id: '', icon: '', title: 'Hilfe gefällig?',
          text: 'Wird’s an der Theke voll? <b>Personal</b> nimmt Bestellungen auf oder bereitet sie zu – dann kannst du dich um anderes kümmern.',
          action: { label: '🧑‍🍳 Personal', run: () => g.ui.openPanel('personal') },
        },
      };
    }
    if (s.day >= 2 && g.shop.cozy < 8 && cash >= 250 && !seen('cozy')) {
      return {
        key: 'cozy',
        hint: {
          id: '', icon: '', title: 'Mehr Gemütlichkeit',
          text: 'Pflanzen, Lampen und Teppiche machen den Laden <b>gemütlicher</b> – das lockt mehr Gäste an und bringt mehr Trinkgeld.',
          action: { label: '🪴 Möbel & Deko', run: () => g.ui.openShop('moebel') },
        },
      };
    }
    const lvl = LEVELS[s.level + 1];
    if (lvl && cash >= lvl.cost && !seen('level:' + (s.level + 1))) {
      return {
        key: 'level:' + (s.level + 1),
        hint: {
          id: '', icon: '', title: 'Größer werden?',
          text: `Du kannst dir jetzt den Umbau zum <b>${escapeHtml(lvl.name)}</b> leisten (${money(lvl.cost)}) – mehr Platz für Tische & Deko.`,
          action: { label: '🏗️ Umbau', run: () => g.ui.openShop('umbau') },
        },
      };
    }
    return null;
  }

  // ---------------- Anzeige

  private push(h: Hint, key: string): void {
    const s = this.g.state;
    if (s.hintsSeen.includes(key)) return;
    s.hintsSeen.push(key);
    this.queue.push({ ...h, id: key });
  }

  update(dt: number): void {
    const g = this.g;
    this.cool -= dt;
    this.t -= dt;
    // nicht während Tutorial, Tagesabschluss oder offenen Fenstern
    if (!g.state.tutorialDone || g.phase === 'summary' || g.ui.panel || g.build.active) return;
    if (this.cool > 0) return;
    if (!this.queue.length && this.t <= 0) {
      this.t = 5;
      const p = this.progressHint();
      if (p) this.push(p.hint, p.key);
    }
    const h = this.queue.shift();
    if (!h) return;
    this.cool = GAP;
    g.ui.showHint(h);
    g.sfx.play('pop');
  }
}
