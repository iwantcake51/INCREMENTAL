import type { Game } from '../../core/game';
import { SKILLS, SKILL_MAP, BRANCH_HUE, BRANCH_LABEL, skillCost, skillUnlocked, type SkillDef } from '../../data/skills';
import { fmt } from '../../core/format';
import { h, setText, setHtml, toggle, replay } from '../dom';
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
  label = 'Constellation';
  icon = 'star-swirl';
  el = h('div', { class: 'view view-skills' });
  private tree = h('div', { class: 'tree' });
  private canvas = h('div', { class: 'tree-canvas' });
  private detail = h('div', { class: 'tree-detail' });
  private shardsEl: HTMLElement;
  private noteEl: HTMLElement;
  private nodes = new Map<string, HTMLButtonElement>();
  private edges: { line: SVGLineElement; from: string; to: string }[] = [];
  private selected = 'ignition';
  private view = { x: 0, y: 0, k: 1 };
  private minX = 0;
  private minY = 0;
  private width = 0;
  private height = 0;
  private placed = false;
  private detailKey = '';

  constructor(private game: Game) {
    const bar = h('div', { class: 'tree-bar' });
    bar.innerHTML = `<h2 class="view-title">Constellation</h2>
      <span class="tree-shards">${ic('crystal-cluster')} <span></span></span><span class="view-sub"></span><span class="spacer"></span>`;
    this.shardsEl = bar.querySelector('.tree-shards span')!;
    this.noteEl = bar.querySelector('.view-sub')!;
    const center = h('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, `${ic('compass')} Center`);
    center.addEventListener('click', () => this.fit(true));
    bar.append(center);

    this.buildGraph();
    this.tree.append(this.canvas);
    const zoom = h('div', { class: 'tree-zoom' });
    const zin = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom in' }, '+');
    const zout = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zoom out' }, '−');
    zin.addEventListener('click', () => this.zoomAt(1.25));
    zout.addEventListener('click', () => this.zoomAt(0.8));
    zoom.append(zin, zout);
    const legend = h('div', { class: 'tree-legend' }, 'Drag to pan · scroll or pinch to zoom · click a star twice to learn it');
    this.tree.append(zoom, legend);
    this.el.append(bar, this.tree, this.detail);
    this.bindPanZoom();
    new ResizeObserver(() => {
      if (!this.placed && this.tree.clientWidth > 0) {
        this.placed = true;
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
    this.height = Math.max(...ys) * UNIT + PAD - this.minY;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.classList.add('tree-edges');
    svg.setAttribute('width', String(this.width));
    svg.setAttribute('height', String(this.height));
    const ox = -this.minX;
    const oy = -this.minY;
    const rings = document.createElementNS(SVG_NS, 'g');
    rings.classList.add('tree-rings');
    for (const r of [1.2, 2.6, 4.05, 5.4, 6.2, 7.8]) {
      const c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', String(ox));
      c.setAttribute('cy', String(oy));
      c.setAttribute('r', String(r * UNIT));
      rings.append(c);
    }
    svg.append(rings);
    for (const s of SKILLS) {
      for (const req of s.req) {
        const p = SKILL_MAP.get(req)!;
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', String(p.x * UNIT + ox));
        line.setAttribute('y1', String(p.y * UNIT + oy));
        line.setAttribute('x2', String(s.x * UNIT + ox));
        line.setAttribute('y2', String(s.y * UNIT + oy));
        svg.append(line);
        this.edges.push({ line, from: req, to: s.id });
      }
    }
    this.canvas.append(svg);

    for (const s of SKILLS) {
      const node = h('button', {
        class: `node${BIG.has(s.id) ? ' big' : ''}`,
        type: 'button',
        style: `left:${s.x * UNIT + ox}px;top:${s.y * UNIT + oy}px;--hue:${BRANCH_HUE[s.branch]}`,
        'aria-label': s.name,
      }) as HTMLButtonElement;
      node.innerHTML = `${ic(s.icon)}<span class="node-lvl"></span>`;
      node.addEventListener('click', (e) => {
        if (this.dragMoved) return;
        if (this.selected === s.id || e.shiftKey) this.learn(s.id);
        this.select(s.id);
      });
      tip(node, () => this.tipFor(s));
      this.canvas.append(node);
      this.nodes.set(s.id, node);
    }
  }

  private tipFor(s: SkillDef): string {
    const lvl = this.game.skillLevel(s.id);
    const cost = lvl < s.max ? skillCost(s, lvl) : 0;
    return `<div class="tip-kicker">${BRANCH_LABEL[s.branch]} · ${lvl}/${s.max}</div><h4>${s.name}</h4><p>${s.desc}</p>
      ${lvl < s.max ? `<div class="tip-meta"><span>Next level</span><span class="tip-cost ${this.game.s.shards >= cost ? 'ok' : ''}">${fmt(cost)} shards</span></div>` : '<div class="tip-meta"><span>Mastered</span></div>'}`;
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
  private bindPanZoom(): void {
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0, vx: 0, vy: 0 };
    let pinch = 0;
    this.tree.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest('.tree-zoom')) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.tree.setPointerCapture(e.pointerId);
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
        return;
      }
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!this.dragMoved && Math.hypot(dx, dy) < 5) return;
      this.dragMoved = true;
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
    const k = Math.min(1.8, Math.max(0.3, this.view.k * factor));
    const f = k / this.view.k;
    this.view.x = cx - (cx - this.view.x) * f;
    this.view.y = cy - (cy - this.view.y) * f;
    this.view.k = k;
    this.apply();
  }

  private fit(animate: boolean): void {
    const w = this.tree.clientWidth;
    const hh = this.tree.clientHeight;
    if (!w || !hh) return;
    const k = Math.min(1, Math.max(0.5, Math.min(w / (10.5 * UNIT), hh / (8.5 * UNIT))));
    this.view = { k, x: w / 2 + this.minX * k, y: hh / 2 + this.minY * k };
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
    if (!this.placed && this.tree.clientWidth > 0) {
      this.placed = true;
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
      <div class="td-name">${s.name}<span class="td-branch">${BRANCH_LABEL[s.branch]} · ${lvl}/${s.max}</span></div>
      <div class="td-desc">${s.desc}</div>
      <div class="td-fx">${lvl > 0 ? `Now: <b>${s.fx(lvl)}</b>` : ''}${!maxed ? `${lvl > 0 ? ' → ' : 'Learn: '}<b>${s.fx(lvl + 1)}</b>` : ' · Mastered'}${
        !unlocked ? ` · Requires ${reqNames}` : ''
      }</div>
      <div class="td-actions">
        <button class="btn nova-btn" type="button" data-act="buy" ${can ? '' : 'disabled'}>${maxed ? 'Mastered' : `${ic('crystal-cluster')} ${fmt(cost)}`}</button>
        ${s.max > 1 && !maxed ? `<button class="btn btn-ghost btn-sm" type="button" data-act="max" ${can ? '' : 'disabled'}>Learn max</button>` : ''}
      </div>`,
    );
    this.detail.querySelector('[data-act="buy"]')?.addEventListener('click', () => this.learn(s.id));
    this.detail.querySelector('[data-act="max"]')?.addEventListener('click', () => this.learnMax(s.id));
  }

  update(): void {
    const g = this.game;
    const sk = g.s.skills;
    setText(this.shardsEl, `${fmt(g.s.shards)} shards`);
    setText(this.noteEl, g.mods.noSkills ? 'Dormant during Nova Drought' : '');
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

  available(): boolean {
    return this.game.s.rebirths > 0 || this.game.s.shards > 0 || this.game.shardGain() > 0;
  }
}
