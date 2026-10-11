import * as THREE from 'three';
import { Ctx } from './context';
import { GameState, saveState, StaffMember, avgRating } from './state';
import { Shop } from '../world/shop';
import { City } from '../world/city';
import { Lighting } from '../world/lighting';
import { Sfx } from '../audio/sfx';
import { Music } from '../audio/music';
import { Bubbles } from '../ui/bubbles';
import { UI } from '../ui/ui';
import { TouchControls } from '../ui/touch';
import { Player } from '../entities/player';
import { CustomerManager } from './customers';
import { Interactions } from './interact';
import { BuildMode } from './build';
import { StockAlerts } from './alerts';
import { Hints } from './hints';
import type { Persona } from '../data/dialogue';
import { StaffWorker } from '../entities/staff';
import { Thief } from '../entities/thief';
import { Character } from '../entities/character';
import { LEVELS } from '../data/catalog';
import { clamp, chance, damp, money } from '../core/util';

export type Phase = 'prep' | 'open' | 'closing' | 'summary';

/** Spielminuten pro echter Sekunde (1 Spielstunde ≈ 48 s) */
const MIN_PER_SEC = 60 / 48;
const OPEN_AT = 9 * 60;
const CLOSE_AT = 19 * 60;

export interface DaySummary {
  day: number;
  served: number;
  revenue: number;
  tips: number;
  angry: number;
  rent: number;
  wages: number;
  loans: number;
  net: number;
  rating: number;
}

export class Game implements Ctx {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.5, 220);
  readonly shop: Shop;
  readonly city: City;
  readonly lighting: Lighting;
  readonly sfx = new Sfx();
  readonly music = new Music();
  readonly bubbles: Bubbles;
  readonly ui: UI;
  readonly touch: TouchControls;
  readonly player: Player;
  readonly cm: CustomerManager;
  readonly interact: Interactions;
  readonly build: BuildMode;
  readonly alerts: StockAlerts;
  readonly hints: Hints;
  staff: StaffWorker[] = [];
  thief: Thief | null = null;

  time = 0;
  minute = 8 * 60;
  phase: Phase = 'prep';
  speed = 1;
  paused = false;
  zoom = 1;
  lastSummary: DaySummary | null = null;

  private keys = new Set<string>();
  private camTarget = new THREE.Vector3();
  private lastFrame = performance.now();
  private hourMark = -1;
  private width = 1;
  private height = 1;

  constructor(public state: GameState, private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = state.settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x9fd3ff);
    this.lighting = new Lighting(this.scene);
    this.lighting.setShadows(state.settings.shadows);
    this.shop = new Shop(this.scene);
    this.shop.rebuild(state);
    this.city = new City(this.scene);
    this.city.buildNeighbors(this.shop.layout.W, this.shop.layout.D);
    this.city.onSay = (ch, text) => this.say(ch, text);

    this.bubbles = new Bubbles(container);
    this.player = new Player(state.player, this.scene);
    this.resetPlayerPos();
    this.cm = new CustomerManager(this);
    this.interact = new Interactions(this);
    this.build = new BuildMode(this);
    this.alerts = new StockAlerts(this);
    this.hints = new Hints(this);
    this.bubbles.onAlertClick = (id) => {
      if (this.build.active) return;
      if (id === 'zapfer' || id === 'eismaschine') this.toast('🥣 Frischen Joghurt rührst du im Nebenraum an – durch die Tür in der Rückwand.');
      else this.ui.openPanel('lager');
    };
    this.syncStaff();

    this.sfx.volume = state.settings.sfx;
    this.music.volume = state.settings.music;
    this.music.source = state.settings.musicSource;
    this.music.onFileError = () => {
      this.state.settings.musicSource = 'generativ';
      this.toast('Keine Datei unter public/music/track.mp3 gefunden – spiele generative Musik.');
    };

    this.ui = new UI(this, container);
    this.touch = new TouchControls(this, container);
    this.bindInput();
    window.addEventListener('resize', () => this.resize());
    // Beim Drehen des Handys meldet der Browser die neue Größe oft zu früh (altes Seitenverhältnis →
    // verzerrte Szene). Darum zusätzlich auf die tatsächliche Größe des Containers hören und nach dem
    // Drehen noch ein paar Mal nachmessen, bis das Layout sich gesetzt hat.
    new ResizeObserver(() => this.resize()).observe(container);
    const settle = () => { for (const ms of [0, 120, 350, 800]) setTimeout(() => this.resize(), ms); };
    window.addEventListener('orientationchange', settle);
    screen.orientation?.addEventListener('change', settle);
    window.visualViewport?.addEventListener('resize', settle);
    document.addEventListener('fullscreenchange', settle);
    this.resize();
    const L = this.shop.layout;
    this.camTarget.set(this.player.pos.x, 0, clamp(this.player.pos.z, -L.D + 2, 0));
  }

  // ------------------------------------------------------------ Ctx

  say(ch: Character, text: string, kind: 'normal' | 'order' | 'angry' | 'happy' | 'thief' = 'normal', html?: string): void {
    this.bubbles.say(ch.bubbleAnchor, text, kind, html);
  }

  floatText(pos: THREE.Vector3, text: string, color?: string): void {
    this.bubbles.floatText(pos, text, color);
  }

  wish(ch: Character, persona: Persona): void {
    this.hints.maybeWish(ch, persona);
  }

  toast(text: string, kind: 'info' | 'good' | 'bad' = 'info'): void {
    this.ui?.toast(text, kind);
  }

  earn(amount: number, pos?: THREE.Vector3, label?: string): void {
    this.state.money = Math.round((this.state.money + amount) * 100) / 100;
    if (pos) this.floatText(pos, `+${money(amount)}${label ? ' ' + label : ''}`, '#7dffa8');
  }

  spend(amount: number): boolean {
    if (this.state.money < amount) return false;
    this.state.money = Math.round((this.state.money - amount) * 100) / 100;
    return true;
  }

  isOpen(): boolean {
    return this.phase === 'open';
  }

  // ------------------------------------------------------------ Hilfen

  canBuild(): boolean {
    if (this.phase === 'summary') return false;
    return true;
  }

  resetPlayerPos(): void {
    const L = this.shop.layout;
    this.player.pos.set(L.regX - 1.2, 0, L.counterZ - 0.9);
    this.player.ch.root.rotation.y = 0;
  }

  syncStaff(): void {
    const ids = new Set(this.state.staff.map((s) => s.id));
    for (const w of this.staff) if (!ids.has(w.member.id)) w.dispose();
    this.staff = this.staff.filter((w) => ids.has(w.member.id));
    for (const m of this.state.staff) {
      if (!this.staff.some((w) => w.member.id === m.id)) this.staff.push(new StaffWorker(m, this, this.cm));
    }
  }

  hire(m: StaffMember): void {
    this.state.staff.push(m);
    this.syncStaff();
  }

  fire(id: number): void {
    this.state.staff = this.state.staff.filter((s) => s.id !== id);
    this.syncStaff();
  }

  /** Nach Kauf von Ausstattung / Sorten / Design: Laden neu aufbauen */
  rebuildShop(): void {
    this.shop.rebuild(this.state);
    this.shop.updateSign(this.state.shopName);
    this.player.unstick(this.shop.colliders, new THREE.Vector3(this.shop.layout.regX - 1.2, 0, this.shop.layout.counterZ - 0.9));
    for (const w of this.staff) w.reset();
  }

  /** Umzug in größere Räume (nur vor Ladenöffnung) */
  expand(): boolean {
    const next = LEVELS[this.state.level + 1];
    if (!next) return false;
    if (this.phase !== 'prep') { this.toast('Umbauen geht nur vor Ladenöffnung.', 'bad'); return false; }
    if (!this.spend(next.cost)) { this.toast(`Dafür brauchst du ${money(next.cost)}.`, 'bad'); return false; }
    this.state.level++;
    this.cm.clearAll();
    this.shop.rebuild(this.state);
    // Möbel, die nicht mehr passen, ins Lager
    const keep = [];
    for (const it of this.state.placed) {
      if (this.shop.canPlace(this.state, it.type, it.x, it.z, it.rot, it.uid)) keep.push(it);
      else this.state.inventory.push(it.type);
    }
    this.state.placed = keep;
    this.shop.rebuild(this.state);
    this.shop.updateSign(this.state.shopName);
    this.city.buildNeighbors(this.shop.layout.W, this.shop.layout.D);
    this.resetPlayerPos();
    for (const w of this.staff) w.dispose();
    this.staff = [];
    this.syncStaff();
    this.build.toggle(false);
    this.sfx.play('buy');
    this.toast(`Willkommen im „${next.name}“! Mehr Platz für Tische & Deko.`, 'good');
    saveState(this.state);
    return true;
  }

  get hour(): number { return this.minute / 60; }

  // ------------------------------------------------------------ Tagesablauf

  openNow(): void {
    if (this.phase !== 'prep') return;
    this.minute = Math.max(this.minute, OPEN_AT);
    this.phase = 'open';
    this.sfx.play('bell');
    this.toast(`Tag ${this.state.day}: Der Laden ist geöffnet!`, 'good');
    this.ui.refresh();
  }

  private closeShop(): void {
    this.phase = 'closing';
    this.cm.closeAll();
    this.sfx.play('bell');
    this.toast('19:00 – Ladenschluss! Bediene noch die letzten Gäste.');
  }

  private endDay(): void {
    const s = this.state;
    this.phase = 'summary';
    this.cm.clearAll();
    if (this.thief) { this.thief.ch.dispose(); this.thief = null; }
    const rent = LEVELS[s.level].rent;
    const wages = s.staff.reduce((a, m) => a + m.wage, 0);
    let loans = 0;
    for (const l of s.loans) {
      const pay = Math.min(l.daily, l.remaining);
      loans += pay;
      l.remaining = Math.round((l.remaining - pay) * 100) / 100;
      l.daysLeft--;
    }
    s.loans = s.loans.filter((l) => l.remaining > 0.01);
    const costs = rent + wages + loans;
    s.money = Math.round((s.money - costs) * 100) / 100;
    this.lastSummary = {
      day: s.day,
      served: this.cm.servedToday,
      revenue: this.cm.revenueToday,
      tips: this.cm.tipsToday,
      angry: this.cm.angryToday,
      rent, wages, loans,
      net: this.cm.revenueToday + this.cm.tipsToday - costs,
      rating: avgRating(s),
    };
    s.day++;
    saveState(s);
    this.ui.openPanel('tagesabschluss');
  }

  startDay(): void {
    this.phase = 'prep';
    this.minute = 8 * 60;
    this.hourMark = -1;
    this.cm.resetDay();
    this.interact.waffle = null;
    this.interact.work = null;
    this.player.setHeld(null);
    this.resetPlayerPos();
    for (const w of this.staff) w.reset();
    this.ui.closePanel();
    this.toast(`Guten Morgen! Tag ${this.state.day}. Kaufe ein, dekoriere – und öffne, wenn du bereit bist.`);
    if (this.state.money < 0) this.toast('Dein Konto ist im Minus – vielleicht hilft ein Kredit bei der Bank.', 'bad');
  }

  // ------------------------------------------------------------ Eingabe

  private bindInput(): void {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (this.ui.handleKey(e)) { e.preventDefault(); return; }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k);
        e.preventDefault();
        return;
      }
      if (this.build.active) {
        if (k === 'r') this.build.rotate();
        else if (k === 'x' || k === 'delete' || k === 'backspace') this.build.sell();
        else if (k === 'q') this.build.store();
        else if (k === 'escape') { if (this.build.sel) this.build.cancel(); else this.build.toggle(false); }
        else if (k === 'b') this.build.toggle(false);
        return;
      }
      if (k === 'e' || k === ' ') { e.preventDefault(); if (!e.repeat) this.interact.interact(); }
      else if (k === 'b') this.build.toggle();
      else if (k === 'p') this.togglePause();
      else if (k === 'f') this.cycleSpeed();
      else if (k === 'o') this.openNow();
      else if (k === 'escape') this.ui.openPanel('menu');
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    const cv = this.renderer.domElement;
    // Touch im Baumodus: Möbel antippen = auswählen, ziehen & loslassen = platzieren
    let drag: { x: number; y: number; picked: boolean; moved: boolean } | null = null;
    cv.addEventListener('pointermove', (e) => {
      if (!this.build.active) {
        // Maus über einem Möbelstück: zeigen, dass man es anfassen kann
        if (e.pointerType === 'mouse' && !this.ui.panel) cv.style.cursor = this.build.furnitureAt(e.clientX, e.clientY) !== null ? 'grab' : '';
        return;
      }
      if (e.pointerType !== 'touch') { this.build.pointerMove(e.clientX, e.clientY); return; }
      if (!drag || !e.isPrimary) return;
      if (this.touch.pinching) { drag = null; return; }
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 12) drag.moved = true;
      this.build.pointerMove(e.clientX, e.clientY);
    });
    cv.addEventListener('pointerdown', (e) => {
      if (!this.build.active) {
        // Möbelstück antippen/anklicken: direkt in den Baumodus und anheben
        if (!e.isPrimary || e.button !== 0 || this.ui.panel || this.ui.choice || !this.canBuild()) return;
        const uid = this.build.furnitureAt(e.clientX, e.clientY);
        if (uid === null) return;
        cv.style.cursor = '';
        this.build.grab(uid, e.clientX, e.clientY);
        if (e.pointerType === 'touch' && this.build.sel) drag = { x: e.clientX, y: e.clientY, picked: true, moved: false };
        return;
      }
      if (e.pointerType === 'touch') {
        if (!e.isPrimary) return;
        this.build.pointerMove(e.clientX, e.clientY);
        const picked = !this.build.sel;
        if (picked) this.build.click();
        drag = { x: e.clientX, y: e.clientY, picked, moved: false };
        return;
      }
      if (e.button === 2) { this.build.rotate(); return; }
      this.build.pointerMove(e.clientX, e.clientY);
      this.build.click();
    });
    cv.addEventListener('pointerup', (e) => {
      if (!drag || !e.isPrimary) return;
      const d = drag;
      drag = null;
      if (!this.build.active || !this.build.sel) return;
      // nur angetippt: ausgewählt lassen (für Drehen / Verkaufen / Lager)
      if (d.picked && !d.moved) return;
      this.build.click();
    });
    cv.addEventListener('pointercancel', () => { drag = null; });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => {
      this.zoom = clamp(this.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.55, 1.6);
    }, { passive: true });
  }

  /** E / Leertaste / ✋-Knopf: Auswahl schließen oder mit der nächsten Station interagieren */
  useAction(): void {
    if (this.ui.panel) return;
    if (this.ui.choice) { this.ui.closeChoice(); return; }
    if (this.build.active) return;
    this.interact.interact();
  }

  togglePause(): void {
    this.paused = !this.paused;
    this.ui.refresh();
  }

  cycleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.ui.refresh();
  }

  private moveInput(): THREE.Vector2 {
    const v = new THREE.Vector2();
    if (this.ui.blocksMovement()) return v;
    const k = this.keys;
    // Kamera schaut nach +z, Bildschirm-rechts ist Welt −x
    if (k.has('w') || k.has('arrowup')) v.y += 1;
    if (k.has('s') || k.has('arrowdown')) v.y -= 1;
    if (k.has('a') || k.has('arrowleft')) v.x += 1;
    if (k.has('d') || k.has('arrowright')) v.x -= 1;
    v.x -= this.touch.stick.x;
    v.y += this.touch.stick.y;
    if (v.lengthSq() > 1) v.normalize();
    return v;
  }

  // ------------------------------------------------------------ Rendering

  applyPixel(): void {
    const px = this.state.settings.pixel;
    this.renderer.setPixelRatio(px <= 1 ? Math.min(window.devicePixelRatio, 2) : 1 / px);
    this.resize();
  }

  applyShadows(): void {
    const on = this.state.settings.shadows;
    this.renderer.shadowMap.enabled = on;
    this.lighting.setShadows(on);
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (m) m.needsUpdate = true;
    });
  }

  private resize(): void {
    this.width = this.container.clientWidth || window.innerWidth;
    this.height = this.container.clientHeight || window.innerHeight;
    const px = this.state.settings.pixel;
    this.renderer.setPixelRatio(px <= 1 ? Math.min(window.devicePixelRatio, 2) : 1 / px);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    const loop = () => {
      requestAnimationFrame(loop);
      this.frame();
    };
    this.lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  private frame(): void {
    const now = performance.now();
    const real = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const running = !this.paused && this.phase !== 'summary' && !this.ui.pausesGame();
    if (running) {
      let simT = real * this.speed;
      while (simT > 0) {
        const dt = Math.min(0.04, simT);
        simT -= dt;
        this.step(dt);
      }
    } else {
      // Figuren weiter animieren, damit nichts "einfriert" wirkt
      this.player.ch.animate(real, false);
    }
    this.updateCamera(real);
    this.lighting.update(this.hour, this.shop.lights, this.city.streetLights);
    this.build.update();
    this.renderer.render(this.scene, this.camera);
    this.bubbles.setMarkers(this.build.active && !this.build.sel ? this.shop.furnitureMeshes.values() : []);
    this.alerts.update(real);
    this.hints.update(real);
    this.bubbles.setAlerts(this.build.active ? [] : this.alerts.alerts);
    this.bubbles.update(real, this.camera, this.width, this.height);
    this.updateBars();
    this.ui.update(real);
    this.touch.update(real);
  }

  private step(dt: number): void {
    this.time += dt;
    // Uhr
    if (this.phase === 'prep') {
      this.minute += dt * MIN_PER_SEC;
      if (this.minute >= OPEN_AT) this.openNow();
    } else if (this.phase === 'open') {
      this.minute += dt * MIN_PER_SEC;
      if (this.minute >= CLOSE_AT) this.closeShop();
    } else if (this.phase === 'closing') {
      this.minute = Math.min(this.minute + dt * MIN_PER_SEC * 1.5, 23 * 60);
      const inside = this.cm.customers.some((c) => c.state !== 'gone' && c.state !== 'leaving');
      if (!inside && !this.thief && this.cm.customers.every((c) => c.state === 'gone' || c.ch.position.z > 0.5)) {
        this.endDay();
        return;
      }
      if (this.minute >= 21 * 60) {
        this.cm.closeAll();
        for (const c of [...this.cm.customers]) if (c.state !== 'leaving' && c.state !== 'gone') this.cm.leave(c, false);
      }
    }
    // stündliche Ereignisse
    const h = Math.floor(this.hour);
    if (h !== this.hourMark) {
      this.hourMark = h;
      if (this.phase === 'open' && this.state.day >= 2 && !this.thief && h >= 10 && h <= 17 && chance(0.13 + Math.min(0.12, this.state.day * 0.01))) {
        this.thief = new Thief(this);
      }
    }

    // Spieler
    const L = this.shop.layout;
    const B = L.back;
    const bounds = (x: number, z: number) => (x > -L.W / 2 + 0.35 && x < L.W / 2 - 0.35 && z > -L.D + 0.35 && z < -0.3)
      // Nebenraum (die Rückwand hat Kollision – rein geht's nur durch den Durchgang)
      || (x > B.x0 + 0.35 && x < B.x1 - 0.35 && z > B.z0 + 0.35 && z < -L.D + 0.4);
    const input = this.interact.busy ? new THREE.Vector2() : this.moveInput();
    this.player.update(dt, input, this.shop.colliders, bounds);

    this.interact.update(dt);
    this.cm.update(dt, this.hour);
    for (const w of this.staff) w.update(dt);
    if (this.thief) {
      this.thief.update(dt);
      if (this.thief.state === 'gone') {
        this.thief.ch.dispose();
        this.thief = null;
      }
    }
    const night = this.lighting.night;
    this.city.update(dt, night);
  }

  private updateCamera(dt: number): void {
    const L = this.shop.layout;
    const p = this.player.pos;
    const tx = this.build.active ? 0 : clamp(p.x, -L.W / 2 + 3, L.W / 2 - 3);
    // im Nebenraum darf die Kamera weiter nach hinten
    const tz = this.build.active ? -L.D / 2 + 0.5 : clamp(p.z, p.z < -L.D + 0.2 ? -L.D - 1.4 : -L.D + 2.5, -1.5);
    this.camTarget.x = damp(this.camTarget.x, tx, 4, dt);
    this.camTarget.z = damp(this.camTarget.z, tz, 4, dt);
    const base = this.build.active ? 1.25 + L.W / 40 : 0.95 + L.W / 60;
    // Hochformat (Handy): weiter rauszoomen, damit der Laden in die Breite passt
    const narrow = Math.max(1, 1.25 / this.camera.aspect) ** 0.7;
    const z = this.zoom * base * narrow;
    this.camera.position.set(this.camTarget.x, 13 * z, this.camTarget.z - 10.5 * z);
    this.camera.lookAt(this.camTarget.x, 0.6, this.camTarget.z + 1.6);
  }

  /** Geduldsbalken über wartenden Kund:innen */
  private updateBars(): void {
    const keep = new Set<THREE.Object3D>();
    for (const c of this.cm.customers) {
      let icon = '';
      if (c.state === 'queue' || c.state === 'toQueue') icon = '🧾';
      else if (c.state === 'waitPickup' || c.state === 'toPickup') icon = '⏳';
      else if (c.state === 'atFridge') icon = '🥤';
      else continue;
      const a = c.ch.bubbleAnchor;
      keep.add(a);
      this.bubbles.setBar(a, clamp(c.patience / c.patienceMax, 0, 1), icon);
    }
    this.bubbles.pruneBars(keep);
  }
}
