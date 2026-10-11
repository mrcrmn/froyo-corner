export interface P2 { x: number; z: number }

/** Einfaches Raster mit A*-Wegfindung (8 Richtungen) und Sichtlinien-Glättung. */
export class NavGrid {
  readonly blocked: Uint8Array;

  constructor(
    public readonly x0: number,
    public readonly z0: number,
    public readonly cols: number,
    public readonly rows: number,
    public readonly cell: number,
  ) {
    this.blocked = new Uint8Array(cols * rows);
  }

  clone(): NavGrid {
    const g = new NavGrid(this.x0, this.z0, this.cols, this.rows, this.cell);
    g.blocked.set(this.blocked);
    return g;
  }

  col(x: number): number { return Math.floor((x - this.x0) / this.cell); }
  row(z: number): number { return Math.floor((z - this.z0) / this.cell); }
  cx(c: number): number { return this.x0 + (c + 0.5) * this.cell; }
  cz(r: number): number { return this.z0 + (r + 0.5) * this.cell; }

  inside(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  isFree(c: number, r: number): boolean {
    return this.inside(c, r) && this.blocked[r * this.cols + c] === 0;
  }

  freeAt(x: number, z: number): boolean {
    return this.isFree(this.col(x), this.row(z));
  }

  /** Blockiert alle Zellen, deren Mittelpunkt im Rechteck (plus Rand) liegt. */
  blockRect(xmin: number, zmin: number, xmax: number, zmax: number, pad = 0, v = 1): void {
    xmin -= pad; zmin -= pad; xmax += pad; zmax += pad;
    for (let r = 0; r < this.rows; r++) {
      const z = this.cz(r);
      if (z < zmin || z > zmax) continue;
      for (let c = 0; c < this.cols; c++) {
        const x = this.cx(c);
        if (x >= xmin && x <= xmax) this.blocked[r * this.cols + c] = v;
      }
    }
  }

  nearestFree(c: number, r: number): [number, number] | null {
    if (this.isFree(c, r)) return [c, r];
    for (let rad = 1; rad < 12; rad++) {
      let best: [number, number] | null = null;
      let bd = Infinity;
      for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          if (this.isFree(c + dc, r + dr)) {
            const d = dc * dc + dr * dr;
            if (d < bd) { bd = d; best = [c + dc, r + dr]; }
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  private lineFree(x1: number, z1: number, x2: number, z2: number): boolean {
    const dist = Math.hypot(x2 - x1, z2 - z1);
    const steps = Math.ceil(dist / (this.cell * 0.35));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = x1 + (x2 - x1) * t;
      const z = z1 + (z2 - z1) * t;
      // etwas Körperbreite berücksichtigen
      const o = this.cell * 0.35;
      if (!this.freeAt(x, z) || !this.freeAt(x + o, z) || !this.freeAt(x - o, z) || !this.freeAt(x, z + o) || !this.freeAt(x, z - o)) {
        return false;
      }
    }
    return true;
  }

  findPath(sx: number, sz: number, tx: number, tz: number): P2[] | null {
    const s = this.nearestFree(this.col(sx), this.row(sz));
    const t = this.nearestFree(this.col(tx), this.row(tz));
    if (!s || !t) return null;
    const N = this.cols * this.rows;
    const start = s[1] * this.cols + s[0];
    const goal = t[1] * this.cols + t[0];
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap: [number, number][] = [];
    const push = (f: number, i: number) => {
      heap.push([f, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p][0] <= heap[k][0]) break;
        [heap[p], heap[k]] = [heap[k], heap[p]];
        k = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1;
          let m = k;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k], heap[m]];
          k = m;
        }
      }
      return top;
    };
    const h = (i: number) => {
      const c = i % this.cols, r = (i / this.cols) | 0;
      const dx = Math.abs(c - t[0]), dz = Math.abs(r - t[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[start] = 0;
    push(h(start), start);
    let found = false;
    while (heap.length) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) { found = true; break; }
      const c = cur % this.cols, r = (cur / this.cols) | 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc, nr = r + dr;
          if (!this.isFree(nc, nr)) continue;
          if (dr && dc && (!this.isFree(c + dc, r) || !this.isFree(c, r + dr))) continue;
          const ni = nr * this.cols + nc;
          if (closed[ni]) continue;
          const ng = g[cur] + (dr && dc ? 1.414 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            came[ni] = cur;
            push(ng + h(ni), ni);
          }
        }
      }
    }
    if (!found) return null;
    const cells: P2[] = [];
    let cur = goal;
    while (cur !== -1) {
      cells.push({ x: this.cx(cur % this.cols), z: this.cz((cur / this.cols) | 0) });
      cur = came[cur];
    }
    cells.reverse();
    // exakte Endpunkte
    cells[cells.length - 1] = { x: tx, z: tz };
    // Glätten
    const out: P2[] = [];
    let anchor = { x: sx, z: sz };
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineFree(anchor.x, anchor.z, cells[j].x, cells[j].z)) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return out;
  }

  reachable(sx: number, sz: number, tx: number, tz: number): boolean {
    const s = this.col(sx), sr = this.row(sz);
    const t = this.col(tx), tr = this.row(tz);
    if (!this.isFree(s, sr) || !this.isFree(t, tr)) return false;
    return this.findPath(sx, sz, tx, tz) !== null;
  }
}
