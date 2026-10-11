import type { Game } from '../game/game';

/** Radius, den der Joystick-Knopf maximal ausschlagen darf (px) */
const STICK_R = 52;
const DEADZONE = 0.15;

export function isTouch(): boolean {
  return document.body.classList.contains('touch');
}

/**
 * Touch-Modus erkennen: an bei Touch-Geräten bzw. sobald der Bildschirm berührt wird,
 * aus, sobald Maus oder Tastatur benutzt werden (z.B. Tablet mit Tastatur).
 */
export function initTouchDetection(): void {
  const set = (on: boolean) => document.body.classList.toggle('touch', on);
  set(matchMedia('(pointer: coarse)').matches);
  window.addEventListener('pointerdown', (e) => set(e.pointerType === 'touch' || (e.pointerType === 'pen' && isTouch())), { capture: true });
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    set(false);
  }, { capture: true });
}

/** Virtueller Joystick links, Aktionsknöpfe rechts, Pinch-Zoom auf der Spielfläche. */
export class TouchControls {
  /** Joystick-Ausschlag: x nach rechts, y nach oben, Länge ≤ 1 */
  readonly stick = { x: 0, y: 0 };
  private root: HTMLDivElement;
  private zone: HTMLDivElement;
  private base: HTMLDivElement;
  private knob: HTMLDivElement;
  private btnA: HTMLButtonElement;
  private btnB: HTMLButtonElement;
  private stickId: number | null = null;
  private ox = 0;
  private oy = 0;
  private pinch = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private pinchZoom = 1;
  private t = 0;

  constructor(private g: Game, container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'touch-ui';
    this.root.innerHTML = `
      <div class="stick-zone"><div class="stick-base"><div class="stick-knob"></div></div></div>
      <button class="tbtn tbtn-b"></button>
      <button class="tbtn tbtn-a">✋</button>`;
    // unter die UI-Ebene, damit Karten & Auswahl darüber bedienbar bleiben
    container.insertBefore(this.root, container.querySelector('.ui-root'));
    this.zone = this.root.querySelector('.stick-zone')!;
    this.base = this.root.querySelector('.stick-base')!;
    this.knob = this.root.querySelector('.stick-knob')!;
    this.btnA = this.root.querySelector('.tbtn-a')!;
    this.btnB = this.root.querySelector('.tbtn-b')!;
    this.bindStick();
    this.bindButtons();
    this.bindPinch(g.renderer.domElement);
  }

  private bindStick(): void {
    const z = this.zone;
    z.addEventListener('pointerdown', (e) => {
      if (this.stickId !== null) return;
      e.preventDefault();
      this.closeMenu();
      this.stickId = e.pointerId;
      z.setPointerCapture(e.pointerId);
      const r = z.getBoundingClientRect();
      // Mitte genau dort, wo der Daumen landet. Nicht an den Rand klemmen: sonst stünde der
      // Daumen schon neben der Mitte, und eine Richtung liefe sofort, die andere kaum.
      this.ox = e.clientX;
      this.oy = e.clientY;
      this.base.style.left = `${this.ox - r.left}px`;
      this.base.style.top = `${this.oy - r.top}px`;
      this.base.style.bottom = 'auto';
      this.base.classList.add('active');
      this.moveStick(e.clientX, e.clientY);
    });
    z.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) this.moveStick(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => { if (e.pointerId === this.stickId) this.releaseStick(); };
    z.addEventListener('pointerup', end);
    z.addEventListener('pointercancel', end);
  }

  private moveStick(cx: number, cy: number): void {
    let dx = cx - this.ox;
    let dy = cy - this.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) { dx *= STICK_R / len; dy *= STICK_R / len; }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const mag = Math.min(1, len / STICK_R);
    if (mag < DEADZONE) { this.stick.x = 0; this.stick.y = 0; return; }
    // Totzone herausrechnen, damit langsames Schleichen möglich bleibt
    const s = (mag - DEADZONE) / (1 - DEADZONE);
    this.stick.x = (dx / len) * s;
    this.stick.y = (-dy / len) * s;
    // wie bei der Tastatur: Loslaufen schließt die Stations-Auswahl
    if (mag > 0.4 && this.g.ui.choice) this.g.ui.closeChoice();
  }

  private releaseStick(): void {
    this.stickId = null;
    this.stick.x = 0;
    this.stick.y = 0;
    this.knob.style.transform = '';
    this.base.style.left = '';
    this.base.style.top = '';
    this.base.style.bottom = '';
    this.base.classList.remove('active');
  }

  private bindButtons(): void {
    const press = (b: HTMLButtonElement, fn: () => void) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        b.classList.add('down');
        fn();
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    };
    press(this.btnA, () => this.g.useAction());
    press(this.btnB, () => {
      const g = this.g;
      g.sfx.play('click');
      if (g.ui.choice) g.ui.closeChoice();
      else g.build.toggle(true);
    });
  }

  /** Zwei Finger auf der Spielfläche: Zoom */
  private bindPinch(cv: HTMLCanvasElement): void {
    const dist = () => {
      const [a, b] = [...this.pinch.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'touch') return;
      this.closeMenu();
      this.pinch.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch.size === 2) { this.pinchDist = dist(); this.pinchZoom = this.g.zoom; }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pinch.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pinch.size === 2 && this.pinchDist > 0) {
        this.g.zoom = Math.min(1.6, Math.max(0.55, this.pinchZoom * (this.pinchDist / dist())));
      }
    });
    const end = (e: PointerEvent) => {
      this.pinch.delete(e.pointerId);
      if (this.pinch.size < 2) this.pinchDist = 0;
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
  }

  private closeMenu(): void {
    document.querySelector('.hud.menu-open')?.classList.remove('menu-open');
  }

  get pinching(): boolean { return this.pinch.size > 1; }

  update(dt: number): void {
    const g = this.g;
    const hidden = !isTouch() || g.build.active || !!g.ui.panel || g.phase === 'summary';
    this.root.classList.toggle('hidden', hidden);
    if (hidden && this.stickId !== null) this.releaseStick();
    this.t -= dt;
    if (hidden || this.t > 0) return;
    this.t = 0.15;
    const choice = !!g.ui.choice;
    this.btnA.classList.toggle('ready', choice || !!g.interact.nearest());
    // bei offener Auswahl schließt ✋ sie – dann auch so beschriften
    const a = choice ? '✓' : '✋';
    if (this.btnA.textContent !== a) this.btnA.textContent = a;
    const b = choice ? '✕' : '🔨';
    if (this.btnB.textContent !== b) this.btnB.textContent = b;
    this.btnB.title = choice ? 'Schließen' : 'Bauen';
  }
}
