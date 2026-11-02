import type { Game } from '../../core/game';
import { SKILLS, SKILL_MAP, BRANCH_HUE, BRANCH_LABEL, skillCost, skillUnlocked, type SkillDef } from '../../data/skills';
import { fmt } from '../../core/format';
import { h, setText, setHtml, toggle, replay, rollNumber } from '../dom';
import { ic } from '../icons';
import { tip } from '../tooltip';
import { sound } from '../audio';
import { fx } from '../fx';
import type { Panel } from './panel';

const UNIT = 92;
const PAD = 90;
const SVG_NS = 'http://www.w3.org/2000/svg';
const BIG = new Set(['ignition', 'k_god', 'p_horizon', 'c_meteor', 'n_theory', 'apex']);

export class SkillsPanel implements Panel {
  id = 'skills';
  label = 'The Reef';
  icon = 'coral';
  el = h('div', { class: 'view view-skills' });
  private tree = h('div', { class: 'tree' });
  private canvas = h('div', { class: 'tree-canvas' });
  private detail = h('div', { class: 'tree-detail' });
  private shardsEl: HTMLElement;
  private noteEl: HTMLElement;
  private nodes = new Map<string, HTMLButtonElement>();
  private edges: { line: SVGPathElement; from: string; to: string }[] = [];
  private selected = 'ignition';
  private view = { x: 0, y: 0, k: 1 };
  private minX = 0;
  private minY = 0;
  private width = 0;
  private height = 0;
  private detailKey = '';

  constructor(private game: Game) {
    const bar = h('div', { class: 'tree-bar' });
    bar.innerHTML = `<h2 class="view-title">The Reef</h2>
      <span class="tree-shards">${ic('oyster-pearl')} <span></span></span><span class="view-sub"></span><span class="spacer"></span>`;
    this.shardsEl = bar.querySelector('.tree-shards span')!;
    this.noteEl = bar.querySelector('.view-sub')!;
    const center = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `${ic('compass')} Center`);
    center.addEventListener('click', () => {
      this.userMoved = false;
      this.fit(true);
    });
    bar.append(center);

    this.buildGraph();
    this.tree.append(this.canvas);
    const zoom = h('div', { class: 'tree-zoom' });
    const zin = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom in' }, '+');
    const zout = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom out' }, '−');
    zin.addEventListener('click', () => this.zoomAt(1.25));
    zout.addEventListener('click', () => this.zoomAt(0.8));
    zoom.append(zin, zout);
    const legend = h('div', { class: 'tree-legend' }, 'Drag to look around, scroll or pinch to zoom. Tap a polyp twice to grow it.');
    this.tree.append(zoom, legend);
    this.el.append(bar, this.tree, this.detail);
    this.bindPanZoom();
    // Keep the default framing correct as the layout settles (fonts, the detail panel,
    // rotating a phone) until the player pans or zooms themselves.
    new ResizeObserver(() => {
      if (!this.userMoved && this.tree.clientWidth > 0) {
        this.fit(false);
      }
    }).observe(this.tree);
  }

  /* ------------------------------------------------------------ build */
  private buildGraph(): void {
    const xs = SKILLS.map((s) => s.x);
    const ys = SKILLS.map((s) => s.y);
    this.minX = Math.min(...xs) * UNIT - PAD;
    this.minY = Math.min(...ys) * UNIT - PAD;
    this.width = Math.max(...xs) * UNIT + PAD - this.minX;
    // Leave room below the root for the trunk and the rock it grows from.
    this.height = 2.6 * UNIT + PAD - this.minY;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('tree-edges');
    svg.setAttribute('width', String(this.width));
    svg.setAttribute('height', String(this.height));
    const ox = -this.minX;
    const oy = -this.minY;
    const X = (v: number) => v * UNIT + ox;
    const Y = (v: number) => v * UNIT + oy;
    const mk = (tag: string, attrs: Record<string, string | number>) => {
      const el = document.createElementNS(SVG_NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
      return el;
    };

    // Seabed rock and the trunk rising out of it.
    const ground = mk('g', { class: 'tree-ground' });
    ground.append(
      mk('path', { class: 'tree-trunk', d: `M ${X(-0.5)} ${Y(1.9)} C ${X(-0.25)} ${Y(1.1)}, ${X(-0.2)} ${Y(0.5)}, ${X(0)} ${Y(0)} C ${X(0.2)} ${Y(0.5)}, ${X(0.25)} ${Y(1.1)}, ${X(0.5)} ${Y(1.9)} Z` }),
      mk('ellipse', { class: 'tree-rock', cx: X(0), cy: Y(2.05), rx: 2.6 * UNIT, ry: 0.42 * UNIT }),
      mk('ellipse', { class: 'tree-rock-hi', cx: X(-0.4), cy: Y(1.92), rx: 1.4 * UNIT, ry: 0.14 * UNIT }),
    );
    svg.append(ground);

    // Depth of each node along its main branch, so boughs taper as they climb.
    const depth = new Map<string, number>();
    const depthOf = (id: string): number => {
      const known = depth.get(id);
      if (known !== undefined) return known;
      const def = SKILL_MAP.get(id)!;
      const d = def.req.length ? depthOf(def.req[0]) + 1 : 0;
      depth.set(id, d);
      return d;
    };

    const vines = mk('g', { class: 'tree-vines' });
    const boughs = mk('g', { class: 'tree-boughs' });
    for (const s of SKILLS) {
      s.req.forEach((req, i) => {
        const p = SKILL_MAP.get(req)!;
        const [x1, y1, x2, y2] = [X(p.x), Y(p.y), X(s.x), Y(s.y)];
        const midY = (y1 + y2) / 2;
        // Curves leave the parent going up and arrive at the child from below, like a branch.
        const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
        const primary = i === 0;
        const path = mk('path', {
          d,
          class: primary ? 'bough' : 'vine',
          style: `--hue:${BRANCH_HUE[s.branch]}`,
          'stroke-width': primary ? Math.max(3.5, 15 - depthOf(s.id) * 2.4) : 2,
        }) as SVGPathElement;
        (primary ? boughs : vines).append(path);
        this.edges.push({ line: path, from: req, to: s.id });
      });
    }
    svg.append(vines, boughs);
    this.canvas.append(svg);

    for (const s of SKILLS) {
      const node = h('button', {
        class: `node${BIG.has(s.id) ? ' big' : ''}`,
        type: 'button',
        style: `left:${X(s.x)}px;top:${Y(s.y)}px;--hue:${BRANCH_HUE[s.branch]}`,
        'aria-label': s.name,
      }) as HTMLButtonElement;
      node.innerHTML = `${ic(s.icon)}<span class="node-lvl"></span>`;
      let lastClick = 0;
      node.addEventListener('click', (e) => {
        if (this.dragMoved) return;
        const now = performance.now();
        const quickSecond = now - lastClick < 450;
        lastClick = now;
        // Shift-click, a double-click, or clicking the node that's already selected grows it.
        if (e.shiftKey || quickSecond || this.selected === s.id) this.learn(s.id);
        this.select(s.id);
      });
      tip(node, () => this.tipFor(s));
      this.canvas.append(node);
      this.nodes.set(s.id, node);
    }

    // Labels for the four boughs, just above where each one leaves the trunk.
    for (const [id, label] of [['n_yield', 'Abyss'], ['k_touch', 'Hands'], ['p_fusion', 'Harvest'], ['c_lure', 'Currents']] as const) {
      const n = SKILL_MAP.get(id)!;
      this.canvas.append(h('span', { class: 'bough-label', style: `left:${X(n.x)}px;top:${Y(n.y) + 40}px;--hue:${BRANCH_HUE[n.branch]}` }, label));
    }
  }

  private tipFor(s: SkillDef): string {
    const lvl = this.game.skillLevel(s.id);
    const cost = lvl < s.max ? skillCost(s, lvl) : 0;
    return `<div class="tip-kicker">${BRANCH_LABEL[s.branch]}, ${lvl}/${s.max}</div><h4>${s.name}</h4><p>${s.desc}</p>
      ${lvl < s.max ? `<div class="tip-meta"><span>Next level</span><span class="tip-cost ${this.game.s.shards >= cost ? 'ok' : ''}">${fmt(cost)} pearls</span></div>` : '<div class="tip-meta"><span>Fully grown</span></div>'}`;
  }

  /* ------------------------------------------------------------ actions */
  private select(id: string): void {
    this.nodes.get(this.selected)?.classList.remove('sel');
    this.selected = id;
    this.nodes.get(id)?.classList.add('sel');
    this.detailKey = '';
    this.renderDetail();
  }

  private learn(id: string, burst = true): boolean {
    const node = this.nodes.get(id)!;
    if (!this.game.buySkill(id)) {
      sound.denied();
      node.animate([{ translate: '-3px 0' }, { translate: '3px 0' }, { translate: '0 0' }], { duration: 200 });
      return false;
    }
    if (burst) {
      sound.skill();
      replay(node, 'learned');
      const r = node.getBoundingClientRect();
      const hue = BRANCH_HUE[SKILL_MAP.get(id)!.branch];
      fx.burst(r.left + r.width / 2, r.top + r.height / 2, 40, { hue, speed: 4.5, light: 72 });
      fx.ring(r.left + r.width / 2, r.top + r.height / 2, 90, `hsl(${hue} 80% 75% / 0.9)`, 2.5, 34);
    }
    this.detailKey = '';
    this.update();
    return true;
  }

  private learnMax(id: string): void {
    let n = 0;
    while (this.game.canBuySkill(id) && n < 50) {
      this.learn(id, n === 0);
      n++;
    }
    if (n === 0) sound.denied();
  }

  /* ------------------------------------------------------------ pan / zoom */
  private dragMoved = false;
  /** Set once the player pans or zooms; stops automatic re-framing. */
  private userMoved = false;
  private bindPanZoom(): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0, vx: 0, vy: 0 };
    let pinch = 0;
    this.tree.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('.tree-zoom')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      // Don't capture the pointer yet: capturing on press would retarget the click
      // away from the node under the cursor, so nodes could never be clicked.
      this.dragMoved = false;
      start = { x: e.clientX, y: e.clientY, vx: this.view.x, vy: this.view.y };
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    });
    this.tree.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) {
          const r = this.tree.getBoundingClientRect();
          this.zoomAt(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        }
        pinch = d;
        this.dragMoved = true;
        for (const id of pointers.keys()) if (!this.tree.hasPointerCapture(id)) this.tree.setPointerCapture(id);
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!this.dragMoved && Math.hypot(dx, dy) < 5) return;
      if (!this.dragMoved && !this.tree.hasPointerCapture(e.pointerId)) this.tree.setPointerCapture(e.pointerId);
      this.dragMoved = true;
      this.userMoved = true;
      this.tree.classList.add('dragging');
      this.view.x = start.vx + dx;
      this.view.y = start.vy + dy;
      this.apply();
    });
    const end = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = 0;
      if (pointers.size === 1) {
        const p = [...pointers.values()][0];
        start = { x: p.x, y: p.y, vx: this.view.x, vy: this.view.y };
      }
      this.tree.classList.remove('dragging');
      // let the click handler see dragMoved, then clear it
      setTimeout(() => (this.dragMoved = false), 0);
    };
    this.tree.addEventListener('pointerup', end);
    this.tree.addEventListener('pointercancel', end);
    this.tree.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = this.tree.getBoundingClientRect();
        this.zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false },
    );
  }

  private zoomAt(factor: number, cx = this.tree.clientWidth / 2, cy = this.tree.clientHeight / 2): void {
    this.userMoved = true;
    const k = Math.min(1.8, Math.max(0.3, this.view.k * factor));
    const f = k / this.view.k;
    this.view.x = cx - (cx - this.view.x) * f;
    this.view.y = cy - (cy - this.view.y) * f;
    this.view.k = k;
    this.apply();
  }

  /** Frame the lower tree: the root sits near the bottom of the view, first forks above it. */
  private fit(animate: boolean): void {
    const w = this.tree.clientWidth;
    const hh = this.tree.clientHeight;
    if (!w || !hh) return;
    // Show roughly the trunk plus four rows of branches, and the full width where possible.
    const k = Math.min(1, Math.max(0.4, Math.min(w / (16.5 * UNIT), (hh * 0.8) / (5.2 * UNIT))));
    const rootX = (0 - this.minX) * k;
    const rootY = (0 - this.minY) * k;
    this.view = { k, x: w / 2 - rootX, y: hh * 0.84 - rootY };
    if (animate) {
      this.canvas.style.transition = 'transform .45s cubic-bezier(.22,1,.36,1)';
      setTimeout(() => (this.canvas.style.transition = ''), 460);
    }
    this.apply();
  }

  private apply(): void {
    const { x, y, k } = this.view;
    this.canvas.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
  }

  onShow(): void {
    if (!this.userMoved && this.tree.clientWidth > 0) {
      this.fit(false);
    }
  }

  /* ------------------------------------------------------------ render */
  private renderDetail(): void {
    const s = SKILL_MAP.get(this.selected)!;
    const g = this.game;
    const lvl = g.skillLevel(s.id);
    const maxed = lvl >= s.max;
    const cost = maxed ? 0 : skillCost(s, lvl);
    const unlocked = skillUnlocked(s, g.s.skills);
    const can = g.canBuySkill(s.id);
    const key = `${s.id}|${lvl}|${can}|${unlocked}|${g.s.shards >= cost}`;
    if (key === this.detailKey) return;
    this.detailKey = key;
    const reqNames = s.req.map((r) => SKILL_MAP.get(r)!.name).join(' or ');
    setHtml(
      this.detail,
      `<span class="gen-ic" style="--hue:${BRANCH_HUE[s.branch]}">${ic(s.icon)}</span>
      <div class="td-name">${s.name}<span class="td-branch">${BRANCH_LABEL[s.branch]}, ${lvl}/${s.max}</span></div>
      <div class="td-desc">${s.desc}</div>
      <div class="td-fx">${lvl > 0 ? `Now: <b>${s.fx(lvl)}</b>` : ''}${!maxed ? `${lvl > 0 ? ' → ' : 'Grows into: '}<b>${s.fx(lvl + 1)}</b>` : ', fully grown'}${
        !unlocked ? `. Needs ${reqNames} first` : ''
      }</div>
      <div class="td-actions">
        <button class="btn nova-btn" type="button" data-act="buy" ${can ? '' : 'disabled'}>${maxed ? 'Fully grown' : `${ic('oyster-pearl')} ${fmt(cost)}`}</button>
        ${s.max > 1 && !maxed ? `<button class="btn btn-ghost btn-sm" type="button" data-act="max" ${can ? '' : 'disabled'}>Grow max</button>` : ''}
      </div>`,
    );
    this.detail.querySelector('[data-act="buy"]')?.addEventListener('click', () => this.learn(s.id));
    this.detail.querySelector('[data-act="max"]')?.addEventListener('click', () => this.learnMax(s.id));
  }

  update(): void {
    const g = this.game;
    const sk = g.s.skills;
    rollNumber(this.shardsEl, g.s.shards, (n) => `${fmt(n)} black pearls`, { speed: 7 });
    setText(
      this.noteEl,
      g.mods.noSkills
        ? 'Asleep during the Bleached Reef trench'
        : g.s.shardsTotal === 0 && g.shardGain() === 0
          ? 'Black Pearls grow the Reef. You get them by descending (see the Descent tab).'
          : '',
    );
    for (const s of SKILLS) {
      const node = this.nodes.get(s.id)!;
      const lvl = sk[s.id] ?? 0;
      const unlocked = skillUnlocked(s, sk);
      const can = unlocked && lvl < s.max && g.s.shards >= skillCost(s, lvl);
      toggle(node, 'has', lvl > 0);
      toggle(node, 'max', lvl >= s.max);
      toggle(node, 'open', unlocked && lvl === 0);
      toggle(node, 'afford', can);
      setText(node.lastElementChild!, s.max > 1 ? `${lvl}/${s.max}` : lvl ? '✓' : '');
      (node.lastElementChild as HTMLElement).hidden = lvl === 0 && !unlocked;
    }
    for (const e of this.edges) {
      const a = (sk[e.from] ?? 0) > 0;
      const b = (sk[e.to] ?? 0) > 0;
      toggle(e.line, 'lit', a && b);
      toggle(e.line, 'open', a && !b);
    }
    if (!this.nodes.get(this.selected)!.classList.contains('sel')) this.nodes.get(this.selected)!.classList.add('sel');
    this.renderDetail();
  }

  badge(): boolean {
    const g = this.game;
    if (g.s.shards <= 0) return false;
    return SKILLS.some((s) => g.canBuySkill(s.id));
  }


}
