import * as THREE from 'three';
import { escapeHtml } from '../core/util';

interface Bubble { el: HTMLDivElement; anchor: THREE.Object3D; life: number }
interface Floater { el: HTMLDivElement; pos: THREE.Vector3; life: number; max: number }

const v = new THREE.Vector3();

/** Sprechblasen, schwebende Texte und Geduldsbalken als HTML-Overlay. */
export class Bubbles {
  private root: HTMLDivElement;
  private bubbles = new Map<THREE.Object3D, Bubble>();
  private floaters: Floater[] = [];
  private bars = new Map<THREE.Object3D, HTMLDivElement>();
  private markers = new Map<THREE.Object3D, HTMLDivElement>();

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'bubble-layer';
    parent.appendChild(this.root);
  }

  /** `html` (z.B. Pixel-Art der Bestellung) ersetzt den Text in der Blase; `text` bleibt Alternativtext */
  say(anchor: THREE.Object3D, text: string, kind = 'normal', html?: string): void {
    const old = this.bubbles.get(anchor);
    if (old) old.el.remove();
    const el = document.createElement('div');
    el.className = `bubble bubble-${kind}`;
    el.innerHTML = html ?? escapeHtml(text).replace(/\n/g, '<br>');
    if (html) { el.classList.add('bubble-pic'); el.title = text; }
    this.root.appendChild(el);
    this.bubbles.set(anchor, { el, anchor, life: 2.8 + text.length * 0.05 + (kind === 'order' ? 3 : 0) + (html ? 2 : 0) });
  }

  floatText(pos: THREE.Vector3, text: string, color = '#ffe066'): void {
    const el = document.createElement('div');
    el.className = 'floater';
    el.style.color = color;
    el.textContent = text;
    this.root.appendChild(el);
    this.floaters.push({ el, pos: pos.clone(), life: 1.8, max: 1.8 });
  }

  /** Geduldsbalken über Kund:innen; frac 0..1, null = ausblenden */
  setBar(anchor: THREE.Object3D, frac: number | null, icon = ''): void {
    let el = this.bars.get(anchor);
    if (frac === null) {
      if (el) { el.remove(); this.bars.delete(anchor); }
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.className = 'pbar';
      el.innerHTML = '<span class="pbar-icon"></span><div class="pbar-track"><div class="pbar-fill"></div></div>';
      this.root.appendChild(el);
      this.bars.set(anchor, el);
    }
    const fill = el.querySelector('.pbar-fill') as HTMLDivElement;
    fill.style.width = `${Math.round(frac * 100)}%`;
    fill.style.background = frac > 0.5 ? '#6fd08c' : frac > 0.25 ? '#ffc658' : '#ff6b7d';
    const ic = el.querySelector('.pbar-icon') as HTMLSpanElement;
    if (ic.textContent !== icon) ic.textContent = icon;
  }

  /** Kleine ✥-Markierung über diesen Objekten (Baumodus: „lässt sich verschieben“) */
  setMarkers(objs: Iterable<THREE.Object3D>): void {
    const keep = new Set(objs);
    for (const [o, el] of this.markers) if (!keep.has(o)) { el.remove(); this.markers.delete(o); }
    for (const o of keep) {
      if (this.markers.has(o)) continue;
      const el = document.createElement('div');
      el.className = 'move-marker';
      el.textContent = '✥';
      this.root.appendChild(el);
      this.markers.set(o, el);
    }
  }

  pruneBars(keep: Set<THREE.Object3D>): void {
    for (const [a, el] of this.bars) if (!keep.has(a)) { el.remove(); this.bars.delete(a); }
  }

  update(dt: number, camera: THREE.Camera, w: number, h: number): void {
    const place = (el: HTMLElement, p: THREE.Vector3, yOff = 0) => {
      v.copy(p).project(camera);
      if (v.z > 1 || v.z < -1) { el.style.display = 'none'; return; }
      el.style.display = '';
      el.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h + yOff}px) translate(-50%, -100%)`;
    };
    for (const [a, b] of this.bubbles) {
      b.life -= dt;
      if (b.life <= 0 || !a.parent || !isInScene(a)) {
        b.el.remove();
        this.bubbles.delete(a);
        continue;
      }
      a.getWorldPosition(v);
      const p = v.clone();
      place(b.el, p, -10);
      b.el.style.opacity = String(Math.min(1, b.life * 2));
    }
    for (const [a, el] of this.bars) {
      if (!isInScene(a)) { el.remove(); this.bars.delete(a); continue; }
      a.getWorldPosition(v);
      place(el, v.clone(), 14);
    }
    for (const [o, el] of this.markers) {
      o.getWorldPosition(v);
      v.y += 1.25;
      place(el, v.clone());
    }
    this.floaters = this.floaters.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) { f.el.remove(); return false; }
      const p = f.pos.clone();
      p.y += (1 - f.life / f.max) * 1.2;
      place(f.el, p);
      f.el.style.opacity = String(Math.min(1, f.life * 1.5));
      return true;
    });
  }

  clear(): void {
    for (const b of this.bubbles.values()) b.el.remove();
    this.bubbles.clear();
    for (const el of this.bars.values()) el.remove();
    this.bars.clear();
  }
}

function isInScene(o: THREE.Object3D): boolean {
  let p: THREE.Object3D | null = o;
  while (p) {
    if ((p as THREE.Scene).isScene) return true;
    p = p.parent;
  }
  return false;
}
