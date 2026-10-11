import * as THREE from 'three';
import { GameState } from './state';
import { Shop } from '../world/shop';
import { Character } from '../entities/character';
import { OrderItem } from './orders';
import type { Sfx } from '../audio/sfx';
import type { Persona } from '../data/dialogue';

export interface Ticket {
  id: number;
  customer: CustomerRef;
  order: OrderItem;
  price: number;
  /** Spielzeit in Sekunden, zu der bestellt wurde */
  t: number;
  assignee: unknown | null;
  blockedUntil: number;
}

/** Minimale Sicht auf eine Kund:in, damit Personal & UI nicht vom ganzen Manager abhängen. */
export interface CustomerRef {
  id: number;
  name: string;
  ch: Character;
  state: string;
  patience: number;
  patienceMax: number;
}

/** Dreck im Laden – Gäste kleckern und lassen Geschirr stehen */
export interface MessApi {
  leftover(tableUid: number, seat: { x: number; z: number }, color: number): void;
  spill(x: number, z: number, color: number): void;
  spillAt(x: number, z: number, r?: number): boolean;
  /** 0 = blitzblank */
  level(): number;
}

export interface Ctx {
  state: GameState;
  scene: THREE.Scene;
  shop: Shop;
  sfx: Sfx;
  mess: MessApi;
  /** echte Sekunden seit Spielstart (skaliert mit Spieltempo) */
  time: number;
  say(ch: Character, text: string, kind?: 'normal' | 'order' | 'angry' | 'happy' | 'thief', html?: string): void;
  floatText(pos: THREE.Vector3, text: string, color?: string): void;
  toast(text: string, kind?: 'info' | 'good' | 'bad'): void;
  earn(amount: number, pos?: THREE.Vector3, label?: string): void;
  spend(amount: number): boolean;
  isOpen(): boolean;
  /** zufriedene Gäste äußern ab und zu einen Wunsch */
  wish(ch: Character, persona: Persona): void;
}
