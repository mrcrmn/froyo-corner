import type { Game } from '../game/game';
import type { ChoicePanel } from '../game/interact';
import type { Hint } from '../game/hints';
import {
  EQUIPMENT, EQUIPMENT_BY_ID, FLAVORS, WAFFLES, COFFEES, MATCHAS, TOPPINGS, DRINKS, PLACEABLES, PLACEABLE_BY_ID,
  THEMES, THEME_BY_ID, LICHTERKETTE, LEVELS, stockDefs, PRICE_LABEL, FAIR_PRICE, LOAN_OFFERS, PriceCat, Variant, StockDef, VARIANT_BY_ID,
} from '../data/catalog';
import { STAFF_NAMES, STAFF_TRAITS } from '../data/dialogue';
import { avgRating, saveState, clearSave, StaffMember, StaffRole } from '../game/state';
import { describeOrder } from '../game/orders';
import { productImg } from './pixelart';
import {
  randomAppearance, Appearance, SKIN_TONES, HAIR_COLORS, CLOTH_COLORS, PANTS_COLORS, SHOE_COLORS,
  HAIR_STYLES, HATS, SHIRTS, PANTS, GLASSES, ACCESSORIES, LABELS,
} from '../entities/appearance';
import { money, fmtTime, stars, escapeHtml as esc, pick, randi, rand } from '../core/util';
import { isTouch } from './touch';
import { canInstall, isInstalled, isIos, promptInstall } from './pwa';

type PanelName =
  | 'shop' | 'lager' | 'preise' | 'bank' | 'personal' | 'bewertungen' | 'einstellungen' | 'charakter'
  | 'tagesabschluss' | 'hilfe' | 'menu';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
const PANEL_TITLE: Record<PanelName, string> = {
  shop: '🛍️ Shop', lager: '📦 Lager & Einkauf', preise: '🏷️ Preise', bank: '🏦 Bank', personal: '🧑‍🍳 Personal',
  bewertungen: '⭐ Bewertungen', einstellungen: '⚙️ Einstellungen', charakter: '🎨 Deine Figur',
  tagesabschluss: '🌙 Tagesabschluss', hilfe: '❓ So geht’s', menu: '⏸️ Pause',
};

export class UI {
  private root: HTMLDivElement;
  private hud: HTMLDivElement;
  private panelEl: HTMLDivElement;
  private choiceEl: HTMLDivElement;
  private toastsEl: HTMLDivElement;
  private buildEl: HTMLDivElement;
  private actions = new Map<string, () => void>();
  private actionN = 0;
  panel: PanelName | null = null;
  choice: ChoicePanel | null = null;
  private shopTab = 'ausstattung';
  private candidates: { day: number; list: StaffMember[] } = { day: -1, list: [] };
  private confirmNew = false;
  private hudT = 0;
  private refs: Record<string, HTMLElement> = {};

  constructor(private g: Game, container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'ui-root';
    container.appendChild(this.root);
    this.root.innerHTML = `
      <div class="hud">
        <div class="hud-top-left card">
          <div class="shop-name" data-r="name"></div>
          <div class="row"><span class="money" data-r="money"></span></div>
          <div class="row small"><span data-r="day"></span> · <span data-r="clock"></span> <span class="badge" data-r="phase"></span></div>
        </div>
        <div class="hud-top-right card">
          <div class="row"><span class="stars" data-r="rating"></span> <span class="small" data-r="ratingNum"></span></div>
          <div class="row small">🧸 Gemütlichkeit <b data-r="cozy"></b> · 🪑 <b data-r="seats"></b></div>
          <div class="row btns">
            <button data-hud="speed" title="Tempo (F)" data-r="speed"></button>
            <button data-hud="pause" title="Pause (P)" data-r="pause"></button>
            <button data-hud="menu" title="Menü (Esc)">☰</button>
          </div>
        </div>
        <div class="hud-menu">
          <button data-hud="open" class="primary" data-r="openBtn">🔔 Laden öffnen <span class="kh">(O)</span></button>
          <button data-hud="more" class="more-btn">☰ Aktionen</button>
          <button data-hud="shop">🛍️ Shop</button>
          <button data-hud="lager">📦 Lager</button>
          <button data-hud="preise">🏷️ Preise</button>
          <button data-hud="build">🔨 Bauen <span class="kh">(B)</span></button>
          <button data-hud="personal">🧑‍🍳 Personal</button>
          <button data-hud="bank">🏦 Bank</button>
          <button data-hud="bewertungen">⭐ Bewertungen</button>
          <button data-hud="charakter">🎨 Figur</button>
        </div>
        <div class="tickets card" data-r="tickets"></div>
        <div class="hud-bottom">
          <div class="work" data-r="work"><div class="work-label" data-r="workLabel"></div><div class="work-track"><div class="work-fill" data-r="workFill"></div></div></div>
          <div class="held card" data-r="held"></div>
          <div class="prompt" data-r="prompt"></div>
        </div>
      </div>
      <div class="toasts"></div>
      <div class="choice card"></div>
      <div class="buildbar card"></div>
      <div class="panel-wrap"><div class="panel card"></div></div>
    `;
    this.hud = this.root.querySelector('.hud')!;
    this.toastsEl = this.root.querySelector('.toasts')!;
    this.choiceEl = this.root.querySelector('.choice')!;
    this.buildEl = this.root.querySelector('.buildbar')!;
    this.panelEl = this.root.querySelector('.panel')!;
    this.root.querySelectorAll<HTMLElement>('[data-r]').forEach((el) => (this.refs[el.dataset.r!] = el));

    this.hud.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hud]');
      if (!b) return;
      g.sfx.play('click');
      const a = b.dataset.hud!;
      this.hud.classList.toggle('menu-open', a === 'more' && !this.hud.classList.contains('menu-open'));
      if (a === 'more') return;
      if (a === 'tickets') { this.ticketsCollapsed = !this.ticketsCollapsed; return; }
      if (a === 'speed') g.cycleSpeed();
      else if (a === 'pause') g.togglePause();
      else if (a === 'open') g.openNow();
      else if (a === 'build') g.build.toggle();
      else this.openPanel(a as PanelName);
    });
    const delegate = (e: Event) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      const fn = this.actions.get(el.dataset.a!);
      if (fn) { g.sfx.play('click'); fn(); }
    };
    this.panelEl.addEventListener('click', delegate);
    this.choiceEl.addEventListener('click', delegate);
    this.buildEl.addEventListener('click', delegate);
    this.panelEl.addEventListener('input', (e) => this.onInput(e.target as HTMLInputElement));
    this.root.querySelector('.panel-wrap')!.addEventListener('click', (e) => {
      if (e.target === e.currentTarget && this.panel !== 'tagesabschluss') this.closePanel();
    });
    this.refs.prompt.addEventListener('click', () => { if (isTouch()) g.useAction(); });
    this.refs.name.textContent = g.state.shopName;
  }

  // ------------------------------------------------------------ allgemein

  private act(fn: () => void): string {
    const id = 'a' + this.actionN++;
    this.actions.set(id, fn);
    return id;
  }

  private btn(label: string, fn: () => void, opts: { cls?: string; disabled?: boolean; title?: string } = {}): string {
    return `<button class="${opts.cls ?? ''}" data-a="${this.act(fn)}" ${opts.disabled ? 'disabled' : ''} ${opts.title ? `title="${esc(opts.title)}"` : ''}>${label}</button>`;
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    const el = document.createElement('div');
    el.className = `toast toast-${kind}`;
    el.textContent = text;
    this.toastsEl.appendChild(el);
    const plain = this.toastsEl.querySelectorAll('.toast:not(.hint)');
    if (plain.length > 4) plain[0].remove();
    setTimeout(() => el.classList.add('out'), 3600);
    setTimeout(() => el.remove(), 4200);
  }

  blocksMovement(): boolean { return !!this.panel; }
  pausesGame(): boolean { return !!this.panel && this.panel !== 'charakter'; }

  handleKey(e: KeyboardEvent): boolean {
    const k = e.key.toLowerCase();
    if (this.panel) {
      if (k === 'escape' && this.panel !== 'tagesabschluss') this.closePanel();
      if (k === 'enter' && this.panel === 'tagesabschluss') this.g.startDay();
      return true;
    }
    if (this.choice) {
      if (MOVE_KEYS.includes(k)) { this.closeChoice(); return false; }
      if (k === 'escape' || k === 'e' || k === ' ') { this.closeChoice(); return true; }
      if (/^[0-9]$/.test(k)) {
        const idx = k === '0' ? 9 : Number(k) - 1;
        const o = this.choice.options[idx];
        if (o && !o.disabled) this.runChoice(idx);
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------ Auswahl an Stationen

  showChoice(p: ChoicePanel): void {
    this.choice = p;
    this.renderChoice();
  }

  closeChoice(): void {
    this.choice = null;
    this.choiceEl.classList.remove('show');
    this.hud.classList.remove('choosing');
  }

  private runChoice(i: number): void {
    const p = this.choice;
    if (!p) return;
    const o = p.options[i];
    o.action();
    if (this.choice === p && !p.keepOpen) this.closeChoice();
  }

  private renderChoice(): void {
    const p = this.choice;
    if (!p) return;
    this.actions.clear();
    if (this.panel) this.renderPanel();
    const key = (i: number) => (i < 9 ? i + 1 : i === 9 ? 0 : '');
    const tiles = p.options.some((o) => o.icon);
    const opts = tiles ? p.options.map((o, i) => `
      <button class="opt tile${o.picked ? ' picked' : ''}" data-a="${this.act(() => this.runChoice(i))}" ${o.disabled ? 'disabled' : ''} title="${esc(o.label + (o.sub ? ' · ' + o.sub : ''))}">
        <span class="key">${key(i)}</span>
        ${o.badge !== undefined ? `<span class="tile-badge">${o.picked ? '✓' : esc(o.badge)}</span>` : ''}
        ${o.icon ? `<img class="px px-m" src="${o.icon}" alt="" draggable="false">` : ''}
        <span class="tile-name">${esc(o.label)}</span>
      </button>`).join('') : p.options.map((o, i) => `
      <button class="opt" data-a="${this.act(() => this.runChoice(i))}" ${o.disabled ? 'disabled' : ''}>
        <span class="key">${key(i)}</span>
        ${o.color !== undefined ? `<span class="swatch" style="background:${hex(o.color)}"></span>` : ''}
        <span class="opt-label">${esc(o.label)}</span>
        ${o.sub ? `<span class="opt-sub">${esc(o.sub)}</span>` : ''}
      </button>`).join('');
    // Schließen/Fertig oben in der Titelzeile: bleibt sichtbar, auch wenn die Optionen scrollen
    const close = p.keepOpen
      ? this.btn('Fertig ✓', () => this.closeChoice(), { cls: 'primary choice-close' })
      : this.btn('✕', () => this.closeChoice(), { cls: 'choice-close', title: 'Schließen' });
    this.choiceEl.innerHTML = `
      <div class="choice-head">
        ${p.icon ? `<img class="px px-l choice-icon" src="${p.icon}" alt="" draggable="false">` : ''}
        <div class="choice-title">${esc(p.title)} <span class="small kh">· Zahl drücken oder klicken · Esc schließt</span></div>
        ${close}
      </div>
      ${p.hint ? `<div class="choice-hint">${esc(p.hint)}</div>` : ''}
      <div class="opts${tiles ? ' tiles' : ''}">${opts}</div>`;
    this.choiceEl.classList.add('show');
    this.hud.classList.add('choosing');
  }

  // ------------------------------------------------------------ Baumodus

  setBuildMode(on: boolean): void {
    this.closeChoice();
    this.buildEl.classList.toggle('show', on);
    this.hud.classList.toggle('building', on);
    if (on) this.renderBuild();
  }

  private renderBuild(): void {
    const g = this.g;
    if (!g.build.active) return;
    this.actions.clear();
    const counts = new Map<string, number>();
    for (const t of g.state.inventory) counts.set(t, (counts.get(t) ?? 0) + 1);
    const inv = [...counts].map(([t, n]) =>
      this.btn(`${esc(PLACEABLE_BY_ID.get(t)?.name ?? t)} ×${n}`, () => g.build.startPlacing(t, true), { cls: 'inv' })).join('');
    const quick = PLACEABLES.filter((p) => (p.minLevel ?? 0) <= g.state.level).map((p) =>
      this.btn(`${esc(p.name)} <span class="price">${money(p.price)}</span>`, () => g.build.startPlacing(p.id, false), {
        cls: 'buy' + (g.build.sel?.mode === 'new' && g.build.sel.type === p.id ? ' sel' : ''),
        disabled: g.state.money < p.price,
        title: `${p.desc}${p.cozy ? ` (+${p.cozy} Gemütlichkeit)` : ''}`,
      })).join('');
    this.buildEl.innerHTML = `
      <div class="build-head"><b>🔨 Baumodus</b>
        <span class="small build-status" data-r="buildStatus"></span>
        <span class="build-tools">
          ${this.btn('⟳', () => g.build.rotate(), { title: 'Drehen (R)' })}
          ${this.btn('📦', () => g.build.store(), { title: 'Ins Lager (Q)' })}
          ${this.btn('💰', () => g.build.sell(), { title: 'Verkaufen für 50 % (X)' })}
          ${this.btn('✕', () => g.build.cancel(), { title: 'Abbrechen (Esc)' })}
        </span>
        ${this.btn('Fertig', () => g.build.toggle(false), { cls: 'primary' })}
      </div>
      ${inv ? `<div class="build-row"><span class="small">Im Lager:</span> ${inv}</div>` : ''}
      <div class="build-row scroll">${quick}</div>`;
    this.refs.buildStatus = this.buildEl.querySelector('.build-status')!;
    this.lastBuildStatus = '';
    this.updateBuildStatus();
  }

  private lastBuildStatus = '';
  private lastTickets = '';
  private ticketsCollapsed = false;

  /** Handy: Bestellungen als kleines Bilder-Raster mit Geduldsbalken, einklappbar */
  private compactTickets(): string {
    const tickets = this.g.cm.tickets;
    const head = `<button class="tickets-title" data-hud="tickets">🧾 ${tickets.length} ${this.ticketsCollapsed ? '▸' : '▾'}</button>`;
    if (this.ticketsCollapsed) return head;
    // höchstens zwei Reihen, damit der Aktionsknopf unten rechts frei bleibt
    const max = tickets.length > 6 ? 5 : 6;
    const tiles = tickets.slice(0, max).map((t) => {
      const frac = Math.max(0, t.customer.patience / t.customer.patienceMax);
      const what = describeOrder(t.order);
      const col = frac > 0.5 ? '#6fd08c' : frac > 0.25 ? '#ffc658' : '#ff6b7d';
      return `<div class="tk${frac < 0.3 ? ' urgent' : ''}">${productImg(t.order, 'px-m', what)}${t.assignee ? '<span class="tk-cook">👩‍🍳</span>' : ''}<i style="width:${Math.round(frac * 10) * 10}%;background:${col}"></i></div>`;
    }).join('');
    const more = tickets.length > max ? `<div class="tk-more">+${tickets.length - max}</div>` : '';
    return head + `<div class="tk-grid">${tiles}${more}</div>`;
  }
  private lastHeld = '';

  /** Anleitung in der Bauleiste – passend dazu, ob gerade etwas in der Hand ist */
  private updateBuildStatus(): void {
    const b = this.g.build;
    if (!b.active || !this.refs.buildStatus) return;
    const t = isTouch();
    const sel = b.sel;
    const html = !sel
      ? (t ? '👆 Tippe ein Möbelstück mit <b>✥</b> an und zieh es an seinen neuen Platz – oder kauf unten etwas Neues.'
        : '👆 Klick auf ein Möbelstück mit <b>✥</b>, um es zu verschieben – oder kauf unten etwas Neues. <span class="kh">Esc: beenden</span>')
      : sel.mode === 'move'
        ? (t ? '✋ Zieh es an die neue Stelle · ⟳ dreht es direkt hier · 📦 ins Lager · 💰 verkaufen'
          : '✋ Klick zum Abstellen · Rechtsklick/R: drehen · Q: ins Lager · X: verkaufen (50 %) · Esc: zurück')
        : (t ? '✋ Tipp oder zieh dorthin, wo es stehen soll · ⟳ drehen · ✕ abbrechen'
          : '✋ Klick zum Platzieren · Rechtsklick/R: drehen · Esc: abbrechen');
    if (html === this.lastBuildStatus) return;
    this.lastBuildStatus = html;
    this.refs.buildStatus.innerHTML = html;
    // Werkzeuge nur anbieten, wenn sie gerade etwas tun
    this.buildEl.querySelectorAll<HTMLButtonElement>('.build-tools button').forEach((btn, i) => {
      btn.disabled = !sel || ((i === 1 || i === 2) && sel.mode !== 'move');
    });
  }

  /** Hinweis-Karte oben: bleibt länger stehen und hat einen Knopf zum passenden Fenster */
  showHint(h: Hint): void {
    this.toastsEl.querySelector('.hint')?.remove();
    const el = document.createElement('div');
    el.className = 'toast hint';
    el.innerHTML = `${h.icon ? `<img class="px px-m" src="${h.icon}" alt="">` : '<span class="hint-bulb">💡</span>'}
      <div class="hint-body"><b class="hint-title">${esc(h.title)}</b><div>${h.text}</div>
      <div class="hint-btns">${h.action ? `<button class="primary hint-go">${esc(h.action.label)}</button>` : ''}<button class="hint-x">${h.action ? 'Später' : 'Alles klar'}</button></div></div>`;
    const close = () => { el.classList.add('out'); setTimeout(() => el.remove(), 500); };
    el.querySelector('.hint-go')?.addEventListener('click', () => { this.g.sfx.play('click'); close(); h.action!.run(); });
    el.querySelector('.hint-x')!.addEventListener('click', () => { this.g.sfx.play('click'); close(); });
    this.toastsEl.prepend(el);
    setTimeout(close, 16000);
  }

  openShop(tab: string): void {
    this.shopTab = tab;
    this.openPanel('shop');
  }

  // ------------------------------------------------------------ Panels

  openPanel(name: PanelName | string): void {
    this.closeChoice();
    if (this.g.build.active && name !== 'shop') this.g.build.toggle(false);
    this.panel = name as PanelName;
    this.confirmNew = false;
    this.root.querySelector('.panel-wrap')!.classList.add('show');
    this.root.querySelector('.panel-wrap')!.classList.toggle('side', name === 'charakter');
    this.renderPanel();
  }

  closePanel(): void {
    if (this.panel === 'charakter' || this.panel === 'einstellungen') saveState(this.g.state);
    this.panel = null;
    this.root.querySelector('.panel-wrap')!.classList.remove('show');
    this.renderBuild();
  }

  /** Alles neu zeichnen, was sich durch Spielaktionen geändert haben kann */
  refresh(): void {
    this.refs.name.textContent = this.g.state.shopName;
    if (this.panel) this.renderPanel();
    else if (this.g.build.active) this.renderBuild();
    this.hudT = 0;
  }

  private renderPanel(): void {
    if (!this.panel) return;
    this.actions.clear();
    if (this.choice) { /* Auswahl bleibt offen, Aktionen werden neu registriert */ }
    const body = this.panelBody(this.panel);
    const closable = this.panel !== 'tagesabschluss';
    const scroll = this.panelEl.querySelector('.panel-body')?.scrollTop ?? 0;
    this.panelEl.innerHTML = `
      <div class="panel-head"><h2>${PANEL_TITLE[this.panel]}</h2>
        ${this.panel !== 'tagesabschluss' && this.panel !== 'menu' ? `<span class="money small-money">${money(this.g.state.money)}</span>` : ''}
        ${closable ? this.btn('✕', () => this.closePanel(), { cls: 'close' }) : ''}</div>
      <div class="panel-body">${body}</div>`;
    this.panelEl.querySelector('.panel-body')!.scrollTop = scroll;
    if (this.choice) this.renderChoiceActionsOnly();
  }

  private renderChoiceActionsOnly(): void {
    // Panels und Auswahl teilen sich die Aktionstabelle – Auswahl neu verdrahten
    const p = this.choice;
    if (!p) return;
    this.choiceEl.querySelectorAll<HTMLElement>('button.opt').forEach((b, i) => (b.dataset.a = this.act(() => this.runChoice(i))));
  }

  private panelBody(name: PanelName): string {
    switch (name) {
      case 'shop': return this.shopPanel();
      case 'lager': return this.lagerPanel();
      case 'preise': return this.preisePanel();
      case 'bank': return this.bankPanel();
      case 'personal': return this.personalPanel();
      case 'bewertungen': return this.reviewsPanel();
      case 'einstellungen': return this.settingsPanel();
      case 'charakter': return this.charPanel();
      case 'tagesabschluss': return this.summaryPanel();
      case 'hilfe': return this.helpPanel();
      case 'menu': return this.menuPanel();
    }
  }

  // ---------------- Shop

  private shopPanel(): string {
    const tabs: [string, string][] = [
      ['ausstattung', 'Ausstattung'], ['sorten', 'Sorten & Toppings'], ['moebel', 'Möbel & Deko'], ['design', 'Design'], ['umbau', 'Umbau'],
    ];
    const tabHtml = tabs.map(([id, l]) => this.btn(l, () => { this.shopTab = id; this.renderPanel(); }, { cls: 'tab' + (this.shopTab === id ? ' active' : '') })).join('');
    let content = '';
    if (this.shopTab === 'ausstattung') content = this.shopEquipment();
    else if (this.shopTab === 'sorten') content = this.shopVariants();
    else if (this.shopTab === 'moebel') content = this.shopFurniture();
    else if (this.shopTab === 'design') content = this.shopDesign();
    else content = this.shopExpand();
    return `<div class="tabs">${tabHtml}</div>${content}`;
  }

  private shopEquipment(): string {
    const g = this.g;
    const s = g.state;
    return `<div class="grid">${EQUIPMENT.filter((e) => e.id !== 'zapfer').map((e) => {
      const owned = s.equipment.includes(e.id);
      return `<div class="item ${owned ? 'owned' : ''}">
        <div class="item-title">${esc(e.name)}</div>
        <div class="item-desc">${esc(e.desc)}</div>
        <div class="item-foot">${owned ? '<span class="tag ok">✓ Vorhanden</span>' : this.btn(`Kaufen · ${money(e.price)}`, () => this.buyEquipment(e.id), { cls: 'primary', disabled: s.money < e.price })}</div>
      </div>`;
    }).join('')}</div>`;
  }

  private buyEquipment(id: string): void {
    const g = this.g;
    const e = EQUIPMENT_BY_ID.get(id)!;
    if (!g.spend(e.price)) { g.toast('Nicht genug Geld.', 'bad'); return; }
    const s = g.state;
    s.equipment.push(id);
    const freebies: string[] = [];
    // kostenlose Sorten freischalten + ein Starterpaket
    const defs = new Map(stockDefs().map((d) => [d.id, d]));
    for (const v of [...FLAVORS, ...WAFFLES, ...COFFEES, ...MATCHAS]) {
      if (v.machine === id && v.unlockCost === 0 && !s.unlocked.includes(v.id)) {
        s.unlocked.push(v.id);
        freebies.push(v.name);
        const key = v.base === 'coffee' ? 'coffee' : `${v.base}_${v.id}`;
        s.stock[key] = (s.stock[key] ?? 0) + (defs.get(key)?.pack ?? 10);
      }
    }
    if (id === 'getraenkekuehlschrank') {
      for (const d of DRINKS) if (d.unlockCost === 0 && !s.unlocked.includes(d.id)) {
        s.unlocked.push(d.id);
        freebies.push(d.name);
        s.stock['drink_' + d.id] = (s.stock['drink_' + d.id] ?? 0) + 12;
      }
    }
    g.sfx.play('buy');
    g.rebuildShop();
    g.toast(`${e.name} gekauft!${freebies.length ? ' Neu: ' + freebies.join(', ') + ' (mit Starterpaket).' : ''}`, 'good');
    this.refresh();
  }

  private variantRow(v: { id: string; name: string; color: number; unlockCost: number }, needs: string | undefined, rebuild: boolean): string {
    const s = this.g.state;
    const unlocked = s.unlocked.includes(v.id);
    const hasEq = !needs || s.equipment.includes(needs);
    let right: string;
    if (unlocked && hasEq) right = '<span class="tag ok">✓</span>';
    else if (!hasEq) right = `<span class="tag">braucht ${esc(EQUIPMENT_BY_ID.get(needs!)?.name ?? needs!)}</span>`;
    else if (unlocked) right = '<span class="tag ok">✓</span>';
    else right = this.btn(`Freischalten · ${money(v.unlockCost)}`, () => this.unlock(v.id, v.name, v.unlockCost, rebuild), { disabled: s.money < v.unlockCost });
    return `<div class="line"><span class="swatch" style="background:${hex(v.color)}"></span><span class="grow">${esc(v.name)}</span>${right}</div>`;
  }

  private unlock(id: string, name: string, cost: number, rebuild: boolean): void {
    const g = this.g;
    if (!g.spend(cost)) return;
    g.state.unlocked.push(id);
    g.sfx.play('buy');
    if (rebuild) g.rebuildShop();
    g.toast(`${name} freigeschaltet! Denk daran, im Lager Vorrat zu kaufen.`, 'good');
    this.refresh();
  }

  private shopVariants(): string {
    const sec = (title: string, list: Variant[]) =>
      `<h3>${title}</h3>${list.map((v) => this.variantRow(v, v.machine, v.base === 'froyo')).join('')}`;
    return `<div class="cols">
      <div>${sec('🍦 Frozen Yogurt', FLAVORS)}${sec('🧇 Waffeln', WAFFLES)}</div>
      <div>${sec('☕ Kaffee', COFFEES)}${sec('🍵 Matcha', MATCHAS)}
        <h3>🥤 Getränke (Kühlschrank)</h3>${DRINKS.map((d) => this.variantRow(d, 'getraenkekuehlschrank', false)).join('')}</div>
      <div><h3>✨ Toppings</h3>${TOPPINGS.map((t) => this.variantRow(t, t.needs, true)).join('')}</div>
    </div>`;
  }

  private shopFurniture(): string {
    const g = this.g;
    const cats: [string, string][] = [['tisch', 'Tische'], ['sitz', 'Sitzplätze'], ['deko', 'Deko']];
    return `<p class="small">Gäste brauchen Tische <b>mit</b> Stühlen daneben, um sich hinzusetzen. Deko erhöht die Gemütlichkeit – das lockt mehr Kundschaft an.</p>` +
      cats.map(([c, title]) => `<h3>${title}</h3><div class="grid">${PLACEABLES.filter((p) => p.cat === c).map((p) => `
        <div class="item">
          <div class="item-title">${esc(p.name)} ${p.cozy ? `<span class="tag">🧸 +${p.cozy}</span>` : ''}</div>
          <div class="item-desc">${esc(p.desc)}</div>
          <div class="item-foot">${this.btn(`Platzieren · ${money(p.price)}`, () => { this.closePanel(); g.build.startPlacing(p.id, false); }, { cls: 'primary', disabled: g.state.money < p.price })}</div>
        </div>`).join('')}</div>`).join('');
  }

  private shopDesign(): string {
    const g = this.g;
    const s = g.state;
    const kinds: [string, string][] = [['wall', 'Wandfarbe'], ['floor', 'Boden'], ['awning', 'Markise']];
    const themes = kinds.map(([k, title]) => `<h3>${title}</h3><div class="grid small-grid">${THEMES.filter((t) => t.kind === k).map((t) => {
      const owned = s.ownedThemes.includes(t.id);
      const active = (s.theme as Record<string, unknown>)[k] === t.id;
      const sw = t.colors.map((c) => `<span class="swatch big" style="background:${hex(c)}"></span>`).join('');
      const action = active ? '<span class="tag ok">Aktiv</span>'
        : owned ? this.btn('Verwenden', () => this.setTheme(k, t.id))
          : this.btn(`Kaufen · ${money(t.price)}`, () => this.buyTheme(k, t.id), { disabled: s.money < t.price });
      return `<div class="item"><div class="item-title">${sw} ${esc(t.name.split(': ')[1] ?? t.name)}</div>
        <div class="item-desc">${t.cozy ? `🧸 +${t.cozy} Gemütlichkeit` : 'Standard'}</div><div class="item-foot">${action}</div></div>`;
    }).join('')}</div>`).join('');
    const lights = s.ownedThemes.includes('lichterkette')
      ? this.btn(s.theme.lights ? 'Lichterkette ausschalten' : 'Lichterkette einschalten', () => { s.theme.lights = !s.theme.lights; g.rebuildShop(); this.refresh(); })
      : this.btn(`Lichterkette kaufen · ${money(LICHTERKETTE.price)} (🧸 +${LICHTERKETTE.cozy})`, () => {
        if (!g.spend(LICHTERKETTE.price)) return;
        s.ownedThemes.push('lichterkette');
        s.theme.lights = true;
        g.sfx.play('buy');
        g.rebuildShop();
        this.refresh();
      }, { disabled: s.money < LICHTERKETTE.price });
    return `<h3>Ladenname</h3>
      <div class="line"><input type="text" maxlength="22" value="${esc(s.shopName)}" data-set="shopName" class="grow"></div>
      <h3>Lichterkette</h3><div class="line">${lights}</div>${themes}`;
  }

  private setTheme(kind: string, id: string): void {
    (this.g.state.theme as Record<string, unknown>)[kind] = id;
    this.g.rebuildShop();
    this.refresh();
  }

  private buyTheme(kind: string, id: string): void {
    const t = THEME_BY_ID.get(id)!;
    if (!this.g.spend(t.price)) return;
    this.g.state.ownedThemes.push(id);
    this.g.sfx.play('buy');
    this.setTheme(kind, id);
  }

  private shopExpand(): string {
    const g = this.g;
    const s = g.state;
    const cur = LEVELS[s.level];
    const next = LEVELS[s.level + 1];
    const rows = LEVELS.map((l, i) => `<div class="line ${i === s.level ? 'hl' : ''}"><span class="grow"><b>${esc(l.name)}</b> · ${l.w}×${l.d} m</span><span>Miete ${money(l.rent)}/Tag</span></div>`).join('');
    return `<p>Aktuell: <b>${esc(cur.name)}</b>. Ein größerer Laden bietet mehr Platz für Tische, Deko und mehr Gäste gleichzeitig – aber die Miete steigt.</p>
      ${rows}
      <div class="line">${next
    ? this.btn(`Umziehen in „${esc(next.name)}“ · ${money(next.cost)}`, () => { if (g.expand()) this.closePanel(); }, { cls: 'primary', disabled: s.money < next.cost || g.phase !== 'prep' })
    : '<span class="tag ok">Größter Laden erreicht 🎉</span>'}
      ${next && g.phase !== 'prep' ? '<span class="small">Umbauen geht nur morgens vor Ladenöffnung.</span>' : ''}</div>`;
  }

  // ---------------- Lager

  private relevantStock(): StockDef[] {
    const s = this.g.state;
    const allV = new Map([...FLAVORS, ...WAFFLES, ...COFFEES, ...MATCHAS].map((v) => [v, v]));
    return stockDefs().filter((d) => {
      if (d.id === 'basis') return true;
      if (d.id === 'coffee') return s.equipment.includes('kaffeemaschine');
      if (d.id.startsWith('top_')) {
        const t = TOPPINGS.find((x) => 'top_' + x.id === d.id)!;
        return s.unlocked.includes(t.id) && (!t.needs || s.equipment.includes(t.needs));
      }
      if (d.id.startsWith('drink_')) return s.equipment.includes('getraenkekuehlschrank') && s.unlocked.includes(d.id.slice(6));
      for (const v of allV.keys()) {
        if (`${v.base}_${v.id}` === d.id) return s.unlocked.includes(v.id) && s.equipment.includes(v.machine);
      }
      return false;
    });
  }

  private buyStock(d: StockDef, packs: number): boolean {
    const g = this.g;
    if (!g.spend(d.cost * packs)) { g.toast('Nicht genug Geld.', 'bad'); return false; }
    g.state.stock[d.id] = (g.state.stock[d.id] ?? 0) + d.pack * packs;
    return true;
  }

  private lagerPanel(): string {
    const g = this.g;
    const s = g.state;
    const defs = this.relevantStock();
    const groups = new Map<string, StockDef[]>();
    for (const d of defs) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
    const buyable = defs.filter((d) => !d.made);
    const fillCost = buyable.reduce((a, d) => a + ((s.stock[d.id] ?? 0) < d.pack ? d.cost : 0), 0);
    const html = [...groups].map(([grp, list]) => `<h3>${esc(grp)}</h3>${list.map((d) => {
      const n = s.stock[d.id] ?? 0;
      if (d.made) {
        return `<div class="line ${n === 0 ? 'warn' : n < 8 ? 'low' : ''}"><span class="swatch" style="background:${hex(d.color)}"></span>
        <span class="grow">${esc(d.name)}</span><span class="count">${n}</span><span class="tag" title="Im Nebenraum am Rührwerk anrühren">🥣 selbst anrühren</span></div>`;
      }
      return `<div class="line ${n === 0 ? 'warn' : n < 8 ? 'low' : ''}"><span class="swatch" style="background:${hex(d.color)}"></span>
        <span class="grow">${esc(d.name)}</span><span class="count">${n}</span>
        ${this.btn(`+${d.pack} · ${money(d.cost)}`, () => { if (this.buyStock(d, 1)) { g.sfx.play('coin'); this.refresh(); } }, { disabled: s.money < d.cost })}
        ${this.btn(`+${d.pack * 5}`, () => { if (this.buyStock(d, 5)) { g.sfx.play('coin'); this.refresh(); } }, { disabled: s.money < d.cost * 5, title: money(d.cost * 5) })}
      </div>`;
    }).join('')}`).join('');
    return `<p class="small">Hier kaufst du Zutaten ein. Leere Sorten kannst du nicht zubereiten – und Gäste werden sauer, wenn es ihr Lieblingsprodukt nicht gibt.
      Frozen Yogurt rührst du im <b>Nebenraum</b> selbst an: aus der Joghurt-Basis wird am Rührwerk ein Kanister, den du zur Maschine trägst.</p>
      <div class="line">${this.btn(`Alles Knappe auffüllen · ${money(fillCost)}`, () => {
    for (const d of buyable) if ((s.stock[d.id] ?? 0) < d.pack) this.buyStock(d, 1);
    g.sfx.play('coin');
    this.refresh();
  }, { cls: 'primary', disabled: fillCost === 0 || s.money < fillCost })}</div>
      <div class="cols2">${html}</div>`;
  }

  // ---------------- Preise

  private preisePanel(): string {
    const g = this.g;
    const s = g.state;
    const cats: PriceCat[] = ['froyo', 'topping'];
    if (s.equipment.includes('waffeleisen')) cats.push('waffle');
    if (s.equipment.includes('kaffeemaschine')) cats.push('coffee');
    if (s.equipment.includes('matchabar')) cats.push('matcha');
    if (s.equipment.includes('getraenkekuehlschrank')) cats.push('drink');
    const rows = cats.map((c) => {
      const p = s.prices[c];
      const f = FAIR_PRICE[c];
      const r = p / f;
      const [label, cls] = r < 0.8 ? ['Schnäppchen', 'ok'] : r <= 1.12 ? ['Fair', 'ok'] : r <= 1.35 ? ['Etwas teuer', 'mid'] : ['Wucher!', 'bad'];
      const step = c === 'topping' ? 0.1 : 0.25;
      const set = (v: number) => { s.prices[c] = Math.max(0.1, Math.round(v * 100) / 100); this.refresh(); };
      return `<div class="line price-line"><span class="grow"><b>${esc(PRICE_LABEL[c])}</b><br><span class="small">fair: ~${money(f)}</span></span>
        ${this.btn('−', () => set(p - step))}<span class="price-val">${money(p)}</span>${this.btn('+', () => set(p + step))}
        <span class="tag ${cls}">${label}</span></div>`;
    }).join('');
    return `<p class="small">Höhere Preise bringen mehr pro Verkauf, aber weniger Kundschaft, kleinere Trinkgelder und schlechtere Bewertungen. Toppings werden pro Stück berechnet.</p>${rows}
      <div class="line">${this.btn('Alle auf fair zurücksetzen', () => { s.prices = { ...FAIR_PRICE }; this.refresh(); })}</div>`;
  }

  // ---------------- Bank

  private bankPanel(): string {
    const g = this.g;
    const s = g.state;
    const debt = s.loans.reduce((a, l) => a + l.remaining, 0);
    const loans = s.loans.length ? s.loans.map((l) => `<div class="line"><span class="grow">Kredit ${money(l.principal)} · noch <b>${money(l.remaining)}</b> · ${money(l.daily)}/Tag · ${l.daysLeft} Tage</span>
      ${this.btn(`Ablösen · ${money(l.remaining)}`, () => {
    if (!g.spend(l.remaining)) { g.toast('Nicht genug Geld zum Ablösen.', 'bad'); return; }
    s.loans = s.loans.filter((x) => x !== l);
    g.toast('Kredit abgelöst. Schuldenfrei fühlt sich gut an!', 'good');
    this.refresh();
  }, { disabled: s.money < l.remaining })}</div>`).join('') : '<p class="small">Keine laufenden Kredite.</p>';
    const offers = LOAN_OFFERS.map((o) => {
      const total = Math.round(o.principal * (1 + o.rate) * 100) / 100;
      const daily = Math.round((total / o.days) * 100) / 100;
      return `<div class="item"><div class="item-title">${money(o.principal)}</div>
        <div class="item-desc">${Math.round(o.rate * 100)} % Zinsen · ${o.days} Tage<br>Rate: ${money(daily)}/Tag · gesamt ${money(total)}</div>
        <div class="item-foot">${this.btn('Aufnehmen', () => {
    s.loans.push({ id: s.nextUid++, principal: o.principal, remaining: total, daily, daysLeft: o.days, rate: o.rate });
    g.earn(o.principal);
    g.sfx.play('coin');
    g.toast(`${money(o.principal)} ausgezahlt. Die Rate wird jeden Abend abgebucht.`, 'good');
    this.refresh();
  }, { cls: 'primary', disabled: s.loans.length >= 3 })}</div></div>`;
    }).join('');
    return `<p>Schulden gesamt: <b>${money(debt)}</b> ${s.loans.length >= 3 ? '<span class="tag bad">max. 3 Kredite</span>' : ''}</p>
      <h3>Laufende Kredite</h3>${loans}<h3>Angebote der Bank „Big Apple Spar & Leih“</h3><div class="grid">${offers}</div>`;
  }

  // ---------------- Personal

  private genCandidates(): StaffMember[] {
    const s = this.g.state;
    if (this.candidates.day === s.day) return this.candidates.list;
    const list: StaffMember[] = [];
    for (let i = 0; i < 4; i++) {
      const skill = randi(1, 5);
      const role: StaffRole = i % 2 === 0 ? 'kasse' : 'kueche';
      const ap = randomAppearance();
      ap.accessory = 'schuerze';
      ap.accessoryColor = pick(CLOTH_COLORS);
      list.push({
        id: s.nextUid++, name: pick(STAFF_NAMES), role, skill,
        wage: Math.round(28 + skill * 17 + rand(-4, 6)),
        trait: pick(STAFF_TRAITS), appearance: ap,
      });
    }
    this.candidates = { day: s.day, list };
    return list;
  }

  private personalPanel(): string {
    const g = this.g;
    const s = g.state;
    const max = 2 + s.level * 2;
    const roleName = (r: StaffRole) => (r === 'kasse' ? '🧾 Kasse' : '👩‍🍳 Küche');
    const skill = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const cur = s.staff.length ? s.staff.map((m) => `<div class="line"><span class="grow"><b>${esc(m.name)}</b> · ${roleName(m.role)} · <span class="stars">${skill(m.skill)}</span><br><span class="small">${esc(m.trait)} · ${money(m.wage)}/Tag</span></span>
      ${this.btn('Entlassen', () => { g.fire(m.id); g.toast(`${m.name} wurde verabschiedet.`); this.refresh(); })}</div>`).join('')
      : '<p class="small">Noch niemand angestellt – du machst alles selbst.</p>';
    const cands = this.genCandidates().filter((c) => !s.staff.some((m) => m.id === c.id)).map((c) => `<div class="item">
      <div class="item-title">${esc(c.name)} <span class="tag">${roleName(c.role)}</span></div>
      <div class="item-desc"><span class="stars">${skill(c.skill)}</span><br>${esc(c.trait)}<br>Lohn: <b>${money(c.wage)}</b>/Tag</div>
      <div class="item-foot">${this.btn('Einstellen', () => {
    g.hire(c);
    g.toast(`${c.name} fängt sofort an!`, 'good');
    this.refresh();
  }, { cls: 'primary', disabled: s.staff.length >= max })}</div></div>`).join('');
    return `<p class="small"><b>Kasse:</b> nimmt Bestellungen auf. <b>Küche:</b> bereitet Bestellungen zu und gibt sie aus. Mehr Sterne = schneller und weniger Fehler. Löhne werden abends gezahlt.</p>
      <h3>Dein Team (${s.staff.length}/${max})</h3>${cur}<h3>Bewerbungen heute</h3><div class="grid">${cands || '<p class="small">Morgen kommen neue Bewerbungen.</p>'}</div>`;
  }

  // ---------------- Bewertungen

  private reviewsPanel(): string {
    const s = this.g.state;
    const avg = avgRating(s);
    const list = [...s.reviews].reverse().slice(0, 40).map((r) => `<div class="review"><span class="stars">${stars(r.stars)}</span> <b>${esc(r.name)}</b> <span class="small">· Tag ${r.day}</span><br>„${esc(r.text)}“</div>`).join('');
    return `<p class="big-rating"><span class="stars">${stars(avg)}</span> ${avg.toFixed(1)} <span class="small">(Schnitt der letzten 25)</span></p>
      <p class="small">Gute Bewertungen bringen mehr Kundschaft. Falsche Bestellungen, lange Wartezeiten, zu hohe Preise und Dreck… äh, Diebe sorgen für schlechte.</p>
      <p class="small">Insgesamt bedient: ${s.stats.served} · Trinkgeld gesamt: ${money(s.stats.tips)} · Diebe verjagt: ${s.stats.thieves} · falsche Bestellungen: ${s.stats.wrong}</p>${list}`;
  }

  // ---------------- Einstellungen

  private settingsPanel(): string {
    const g = this.g;
    const st = g.state.settings;
    const pxBtn = (n: number, l: string) => this.btn(l, () => { st.pixel = n; g.applyPixel(); this.refresh(); }, { cls: st.pixel === n ? 'active' : '' });
    return `
      <h3>Grafik</h3>
      <div class="line"><span class="grow">Pixel-Look</span>${pxBtn(1, 'Aus')}${pxBtn(2, 'Fein')}${pxBtn(3, 'Mittel')}${pxBtn(4, 'Grob')}</div>
      <div class="line"><span class="grow">Schatten</span>${this.btn(st.shadows ? 'An' : 'Aus', () => { st.shadows = !st.shadows; g.applyShadows(); this.refresh(); })}</div>
      <h3>Audio</h3>
      <div class="line"><span class="grow">Musik</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" data-set="music"></div>
      <div class="line"><span class="grow">Effekte</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-set="sfx"></div>
      <div class="line"><span class="grow">Musikquelle</span>
        ${this.btn('Generativ (Lo-Fi)', () => { st.musicSource = 'generativ'; g.music.setSource('generativ'); this.refresh(); }, { cls: st.musicSource === 'generativ' ? 'active' : '' })}
        ${this.btn('Eigene Datei', () => { st.musicSource = 'datei'; g.music.setSource('datei'); this.refresh(); }, { cls: st.musicSource === 'datei' ? 'active' : '' })}
      </div>
      <p class="small">„Generativ“ erzeugt ruhige Lo-Fi-Musik direkt im Browser. Für „Eigene Datei“ lege eine freie Musikdatei (z.B. CC0 von freepd.com oder opengameart.org) als <code>public/music/track.mp3</code> ab.</p>
      <div class="line">${this.btn(g.music.playing ? '⏹ Musik stoppen' : '▶ Musik starten', () => { if (g.music.playing) g.music.stop(); else g.music.start(); this.refresh(); })}</div>`;
  }

  private onInput(el: HTMLInputElement): void {
    const g = this.g;
    const key = el.dataset.set;
    if (!key) return;
    if (key === 'music') { g.state.settings.music = Number(el.value); g.music.setVolume(Number(el.value)); }
    else if (key === 'sfx') { g.state.settings.sfx = Number(el.value); g.sfx.volume = Number(el.value); }
    else if (key === 'shopName') {
      const v = el.value.trim() || 'Froyo Corner';
      g.state.shopName = v;
      this.refs.name.textContent = v;
      g.shop.updateSign(v);
    } else if (key.startsWith('ap.')) {
      // Farbwähler im Charakter-Editor
      const field = key.slice(3) as keyof Appearance;
      (g.state.player as unknown as Record<string, unknown>)[field] = parseInt(el.value.slice(1), 16);
      g.player.ch.build(g.state.player);
      g.player.refreshHeld();
    }
  }

  // ---------------- Charakter

  private charPanel(): string {
    const g = this.g;
    const a = g.state.player;
    const apply = () => { g.player.ch.build(a); g.player.refreshHeld(); this.refresh(); };
    const cycle = <T extends string>(field: keyof Appearance, list: readonly T[], title: string) => {
      const cur = a[field] as unknown as T;
      const i = Math.max(0, list.indexOf(cur));
      const set = (d: number) => { (a as unknown as Record<string, unknown>)[field] = list[(i + d + list.length) % list.length]; apply(); };
      return `<div class="line"><span class="grow">${title}</span>${this.btn('◀', () => set(-1))}<span class="cycle-val">${esc(LABELS[cur] ?? cur)}</span>${this.btn('▶', () => set(1))}</div>`;
    };
    const colors = (field: keyof Appearance, list: number[], title: string) => {
      const cur = a[field] as unknown as number;
      return `<div class="line col"><span>${title}</span><div class="swatches">${list.map((c) =>
        `<button class="swatch-btn ${c === cur ? 'sel' : ''}" style="background:${hex(c)}" data-a="${this.act(() => { (a as unknown as Record<string, unknown>)[field] = c; apply(); })}"></button>`).join('')}
        <input type="color" value="${hex(cur)}" data-set="ap.${String(field)}" title="Eigene Farbe"></div></div>`;
    };
    return `<p class="small">Änderungen siehst du sofort an deiner Figur.</p>
      ${colors('skin', SKIN_TONES, 'Hautton')}
      ${cycle('hairStyle', HAIR_STYLES, 'Frisur')}
      ${colors('hairColor', HAIR_COLORS, 'Haarfarbe')}
      ${cycle('hat', HATS, 'Kopfbedeckung')}
      ${a.hat !== 'kein' ? colors('hatColor', CLOTH_COLORS, 'Farbe Kopfbedeckung') : ''}
      ${cycle('shirt', SHIRTS, 'Oberteil')}
      ${colors('shirtColor', CLOTH_COLORS, 'Farbe Oberteil')}
      ${colors('shirtColor2', CLOTH_COLORS, 'Zweitfarbe')}
      ${cycle('pants', PANTS, 'Hose')}
      ${colors('pantsColor', PANTS_COLORS, 'Farbe Hose')}
      ${colors('shoes', SHOE_COLORS, 'Schuhe')}
      ${cycle('glasses', GLASSES, 'Brille')}
      ${cycle('accessory', ACCESSORIES, 'Accessoire')}
      ${a.accessory !== 'keins' ? colors('accessoryColor', CLOTH_COLORS, 'Farbe Accessoire') : ''}
      <div class="line"><span class="grow">Bart</span>${this.btn(a.beard ? 'Ja' : 'Nein', () => { a.beard = !a.beard; apply(); })}</div>
      <div class="line"><span class="grow">Größe</span>${this.btn('−', () => { a.height = Math.max(0.85, a.height - 0.04); apply(); })}<span class="cycle-val">${Math.round(a.height * 100)} %</span>${this.btn('+', () => { a.height = Math.min(1.15, a.height + 0.04); apply(); })}</div>
      <div class="line">${this.btn('🎲 Zufällig', () => {
    const r = randomAppearance();
    Object.assign(a, r, { kid: false, accessory: 'schuerze' });
    apply();
  })}${this.btn('Fertig', () => this.closePanel(), { cls: 'primary' })}</div>`;
  }

  // ---------------- Tagesabschluss

  private summaryPanel(): string {
    const g = this.g;
    const d = g.lastSummary;
    if (!d) return this.btn('Weiter', () => g.startDay(), { cls: 'primary' });
    const row = (l: string, v: number, cls = '') => `<div class="line ${cls}"><span class="grow">${l}</span><b>${money(v)}</b></div>`;
    const mood = d.net > 150 ? 'Was für ein Tag! 🎉' : d.net > 0 ? 'Ein solider Tag. 🍦' : 'Heute lief’s nicht so… morgen wird besser! 🌱';
    return `<p class="big-rating">Tag ${d.day} ist geschafft. ${mood}</p>
      <div class="line"><span class="grow">Bediente Gäste</span><b>${d.served}</b></div>
      <div class="line"><span class="grow">Verärgerte Gäste</span><b>${d.angry}</b></div>
      <div class="line"><span class="grow">Bewertung</span><span class="stars">${stars(d.rating)}</span>&nbsp;${d.rating.toFixed(1)}</div>
      ${row('Umsatz', d.revenue)}${row('Trinkgeld', d.tips)}
      ${row('Miete', -d.rent, 'neg')}${d.wages ? row('Löhne', -d.wages, 'neg') : ''}${d.loans ? row('Kreditraten', -d.loans, 'neg') : ''}
      ${row('Bilanz heute', d.net, d.net >= 0 ? 'pos total' : 'neg total')}
      ${row('Kontostand', g.state.money, 'total')}
      <p class="small">Spielstand wurde gespeichert.</p>
      <div class="line">${this.btn(`☀️ Weiter zu Tag ${g.state.day} <span class="kh">(Enter)</span>`, () => g.startDay(), { cls: 'primary big' })}</div>`;
  }

  // ---------------- Hilfe & Menü

  private helpPanel(): string {
    const useKey = isTouch() ? '<kbd>✋</kbd>' : '<kbd>E</kbd>';
    const touch = `
      <h3>Steuerung</h3>
      <div class="line"><kbd>🕹️</kbd><span class="grow">Links: Daumen aufsetzen & ziehen zum Laufen</span></div>
      <div class="line"><kbd>✋</kbd><span class="grow">Benutzen (Kasse, Maschinen, Ausgabe…)</span></div>
      <div class="line"><kbd>🔨</kbd><span class="grow">Baumodus – Möbel antippen, ziehen & loslassen</span></div>
      <div class="line"><kbd>☰</kbd><span class="grow">Aktionen: Shop, Lager, Preise, Personal…</span></div>
      <div class="line"><kbd>🤏</kbd><span class="grow">Zwei Finger: Zoom</span></div>
      <p class="small">Am besten im Querformat spielen.</p>`;
    return `<div class="cols2"><div>${isTouch() ? touch : `
      <h3>Steuerung</h3>
      <div class="line"><kbd>WASD</kbd>/<kbd>Pfeile</kbd><span class="grow">Laufen</span></div>
      <div class="line"><kbd>E</kbd>/<kbd>Leertaste</kbd><span class="grow">Benutzen (Kasse, Maschinen, Ausgabe…)</span></div>
      <div class="line"><kbd>1</kbd>–<kbd>0</kbd><span class="grow">Sorte / Topping wählen</span></div>
      <div class="line"><kbd>B</kbd><span class="grow">Baumodus (Möbel)</span></div>
      <div class="line"><kbd>O</kbd><span class="grow">Laden öffnen</span></div>
      <div class="line"><kbd>F</kbd> / <kbd>P</kbd><span class="grow">Tempo / Pause</span></div>
      <div class="line"><kbd>Mausrad</kbd><span class="grow">Zoom</span></div>
      <div class="line"><kbd>Esc</kbd><span class="grow">Menü</span></div>`}
    </div><div>
      <h3>So läuft ein Tag</h3>
      <ol>
        <li>Morgens (8–9 Uhr) einkaufen, Preise setzen und dekorieren.</li>
        <li>Gäste stellen sich an der <b>Kasse</b> an – drück dort ${useKey}, um die Bestellung aufzunehmen.</li>
        <li>Hol das Produkt an der richtigen Station: <b>Zapfer/Eismaschine</b>, <b>Waffeleisen</b> (nicht anbrennen lassen!), <b>Kaffeemaschine</b> oder <b>Matcha-Bar</b>.</li>
        <li>An der <b>Topping-Bar</b> die gewünschten Toppings drauf.</li>
        <li>An der <b>Ausgabe</b> übergeben. Richtig = Trinkgeld, falsch = schlechte Bewertung.</li>
        <li>Ein <b>Dieb</b> an der Topping-Bar? Hin und ${useKey} – Löffel auf die Finger!</li>
        <li>Geht ein Joghurt zur Neige? Im <b>Nebenraum</b> (Tür in der Rückwand) am <b>Rührwerk</b> frisch anrühren und den Kanister zur Maschine tragen.</li>
        <li>Um 19 Uhr schließt der Laden. Abends werden Miete, Löhne und Kredite fällig.</li>
      </ol>
      <p class="small">Tipp: Tische mit Stühlen locken Gruppen zum Kaffeeklatsch an – die bestellen gern Kaffee & Matcha nach.</p>
    </div></div>
    <div class="line">${this.btn('Los geht’s!', () => { this.g.state.tutorialDone = true; this.closePanel(); }, { cls: 'primary' })}</div>`;
  }

  private menuPanel(): string {
    const g = this.g;
    return `<div class="menu-list">
      ${this.btn('▶ Weiterspielen', () => this.closePanel(), { cls: 'primary big' })}
      ${this.btn('❓ Hilfe', () => this.openPanel('hilfe'))}
      ${this.btn('⚙️ Einstellungen', () => this.openPanel('einstellungen'))}
      ${this.btn('🎨 Figur anpassen', () => this.openPanel('charakter'))}
      ${canInstall() ? this.btn('📲 Als App installieren', () => this.install()) : ''}
      ${isTouch() && !isInstalled() && document.fullscreenEnabled ? this.btn(document.fullscreenElement ? '🗗 Vollbild beenden' : '⛶ Vollbild', () => this.toggleFullscreen()) : ''}
      ${this.btn('💾 Speichern', () => { saveState(g.state); g.toast('Gespeichert. (Laufender Tag wird beim Laden neu gestartet.)', 'good'); })}
      ${this.btn(this.confirmNew ? '⚠️ Wirklich alles löschen?' : '🗑️ Neues Spiel', () => {
    if (!this.confirmNew) { this.confirmNew = true; this.renderPanel(); return; }
    clearSave();
    location.reload();
  }, { cls: this.confirmNew ? 'danger' : '' })}
    </div>`;
  }

  private async install(): Promise<void> {
    if (await promptInstall()) { this.renderPanel(); return; }
    if (isIos()) this.g.toast('So geht’s: in Safari unten auf Teilen (□↑) tippen, dann „Zum Home-Bildschirm“.', 'info');
  }

  private async toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else {
        await document.documentElement.requestFullscreen();
        // nicht überall erlaubt (z.B. iOS) – dann eben nicht
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
      }
    } catch { /* Vollbild abgelehnt */ }
    this.renderPanel();
  }

  // ------------------------------------------------------------ HUD-Update

  update(dt: number): void {
    const g = this.g;
    this.updateBuildStatus();
    // Auswahl schließen, wenn man sich entfernt hat
    if (this.choice) {
      const st = g.shop.stations.get(this.choice.station);
      if (st && Math.hypot(g.player.pos.x - st.ix, g.player.pos.z - st.iz) > 1.6) this.closeChoice();
    }
    // Arbeitsfortschritt (jedes Frame)
    const w = g.interact.work;
    this.refs.work.classList.toggle('show', !!w);
    if (w) {
      this.refs.workLabel.textContent = `${w.label}…`;
      this.refs.workFill.style.width = `${Math.min(100, (w.t / w.max) * 100)}%`;
    }
    this.hudT -= dt;
    if (this.hudT > 0) return;
    this.hudT = 0.15;
    const s = g.state;
    const set = (k: string, v: string) => { if (this.refs[k].textContent !== v) this.refs[k].textContent = v; };
    set('money', money(s.money));
    this.refs.money.classList.toggle('neg', s.money < 0);
    set('day', `Tag ${s.day}`);
    set('clock', fmtTime(g.minute));
    const phase = g.phase === 'prep' ? 'Vorbereitung' : g.phase === 'open' ? 'Geöffnet' : g.phase === 'closing' ? 'Feierabend naht' : 'Geschlossen';
    set('phase', phase);
    this.refs.phase.className = `badge ${g.phase}`;
    const avg = avgRating(s);
    set('rating', stars(avg));
    set('ratingNum', avg.toFixed(1));
    set('cozy', String(g.shop.cozy));
    set('seats', String(g.shop.seatCount()));
    set('speed', g.speed === 1 ? '▶' : g.speed === 2 ? '▶▶' : '▶▶▶');
    set('pause', g.paused ? '▶ Weiter' : '⏸');
    this.refs.openBtn.style.display = g.phase === 'prep' ? '' : 'none';
    // Tickets
    const tickets = g.cm.tickets;
    const th = !tickets.length ? '' : isTouch() ? this.compactTickets() : `<div class="tickets-title">🧾 Bestellungen (${tickets.length})</div>` + tickets.slice(0, 7).map((t) => {
        const wait = Math.floor(g.time - t.t);
        const frac = t.customer.patience / t.customer.patienceMax;
        const what = describeOrder(t.order);
        return `<div class="ticket ${frac < 0.3 ? 'urgent' : ''}" title="${esc(what)}">${productImg(t.order, 'px-m', what)}<div class="ticket-txt"><b>${esc(t.customer.name)}</b>${t.assignee ? ' <span class="tag">👩‍🍳</span>' : ''}<br><span class="small">${esc(what)} · ${wait}s</span></div></div>`;
      }).join('') + (tickets.length > 7 ? `<div class="small">+${tickets.length - 7} weitere</div>` : '');
    if (this.lastTickets !== th) { this.lastTickets = th; this.refs.tickets.innerHTML = th; }
    this.refs.tickets.style.display = th ? '' : 'none';
    // Hand
    const held = g.player.held;
    const carry = g.player.carry ? VARIANT_BY_ID.get(g.player.carry) : null;
    const hh = held ? `${productImg(held, 'px-m', describeOrder(held))}<span>${esc(describeOrder(held))}</span>${held.burnt ? ' <span class="tag bad">verbrannt</span>' : ''}`
      : carry ? `${productImg({ base: 'froyo', variant: carry.id, toppings: [] }, 'px-m', carry.name)}<span>Kanister ${esc(carry.name)} → ${carry.machine === 'zapfer' ? 'Zapfer' : 'Eismaschine'}</span>` : '';
    if (this.lastHeld !== hh) { this.lastHeld = hh; this.refs.held.innerHTML = hh; }
    this.refs.held.style.display = hh ? '' : 'none';
    // Prompt
    let prompt = '';
    if (!g.build.active && !this.panel) {
      const t = g.interact.nearest();
      if (t) prompt = `${isTouch() ? '✋' : '<kbd>E</kbd>'} ${esc(t.label)}`;
      else if (g.interact.waffle) prompt = g.interact.waffle.t >= 6.5 ? '🧇 Die Waffel ist fertig!' : '';
    }
    if (this.refs.prompt.innerHTML !== prompt) this.refs.prompt.innerHTML = prompt;
    this.refs.prompt.style.display = prompt ? '' : 'none';
    if (g.build.active && !this.panel && this.buildEl.dataset.money !== String(Math.floor(s.money))) {
      this.buildEl.dataset.money = String(Math.floor(s.money));
      this.renderBuild();
    }
  }
}
