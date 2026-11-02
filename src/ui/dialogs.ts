import type { Game } from '../core/game';
import type { Settings, Palette } from '../core/state';
import { fmt, fmtTime, setNotation, type Notation } from '../core/format';
import { exportSave, importSave, saveLocal, clearLocal } from '../core/save';
import { h } from './dom';
import { ic } from './icons';
import { makeDialog, openDialog, closeDialog, confirmDialog } from './modal';
import { sound } from './audio';
import { fx, sky } from './fx';
import { toast } from './toast';

const PALETTES: { id: Palette; name: string; color: string; hue: number }[] = [
  { id: 'lumen', name: 'Lumen green', color: '#78f2cf', hue: 165 },
  { id: 'coral', name: 'Coral pink', color: '#ff9eb0', hue: 350 },
  { id: 'amber', name: 'Anglerfish amber', color: '#ffcf6e', hue: 40 },
  { id: 'violet', name: 'Hadal violet', color: '#b9a4ff', hue: 255 },
];

export function applySettings(st: Settings): void {
  const root = document.documentElement;
  setNotation(st.notation);
  root.dataset.palette = st.palette;
  root.style.setProperty('--ui-scale', String(st.uiScale));
  if (st.reducedMotion === 'system') delete root.dataset.motion;
  else root.dataset.motion = st.reducedMotion;
  fx.particles = st.particles;
  fx.floatingText = st.floatingText;
  sky.setEnabled(st.starfield);
  const rgb = getComputedStyle(root).getPropertyValue('--lumen-rgb').trim();
  sky.setAccent(rgb);
  fx.rgb = rgb.split(/\s+/).join(',');
  fx.hue = PALETTES.find((p) => p.id === st.palette)?.hue ?? 165;
  sound.setVolume(st.volume, st.muted);
  sound.tapSounds = st.tapSounds;
  document.getElementById('ticker')!.hidden = !st.newsTicker;
}

/* ============================================================== Settings */
export function buildSettings(game: Game, onReset: () => void): HTMLDialogElement {
  const { dialog, body, foot } = makeDialog('dlg-settings', 'Settings', 'settings-knobs');
  const st = () => game.s.settings;
  const changed = () => {
    applySettings(st());
    sound.tick();
  };

  const group = (title: string) => {
    const g = h('div', { class: 'set-group' }, `<h3>${title}</h3>`);
    body.append(g);
    return g;
  };
  const row = (g: HTMLElement, label: string, hint: string, control: HTMLElement) => {
    const id = 'set-' + label.toLowerCase().replace(/[^a-z]+/g, '-');
    control.id = id;
    const r = h('div', { class: 'set-row' }, `<label for="${id}">${label}${hint ? `<small>${hint}</small>` : ''}</label>`);
    r.append(control);
    g.append(r);
  };
  const toggleCtl = (key: keyof Settings) => {
    const sw = h('input', { type: 'checkbox', class: 'switch', role: 'switch' }) as HTMLInputElement;
    sw.checked = st()[key] as boolean;
    sw.addEventListener('change', () => {
      (st()[key] as boolean) = sw.checked;
      changed();
    });
    return sw;
  };
  const select = <T extends string | number>(key: keyof Settings, options: [T, string][], cast: (v: string) => T) => {
    const sel = h('select') as HTMLSelectElement;
    for (const [v, label] of options) sel.append(new Option(label, String(v), false, st()[key] === v));
    sel.addEventListener('change', () => {
      (st()[key] as T) = cast(sel.value);
      changed();
    });
    return sel;
  };

  /* Display */
  const display = group('Display');
  const notation = select<Notation>(
    'notation',
    [
      ['standard', `Standard (${fmt(1.23e15, 'standard')})`],
      ['scientific', `Scientific (${fmt(1.23e15, 'scientific')})`],
      ['engineering', `Engineering (${fmt(1.23e15, 'engineering')})`],
      ['letters', `Letters (${fmt(1.23e15, 'letters')})`],
    ],
    (v) => v as Notation,
  );
  row(display, 'Number format', '', notation);

  const sw = h('div', { class: 'swatches', role: 'group' });
  for (const p of PALETTES) {
    const b = h('button', { class: 'swatch', type: 'button', style: `background:${p.color}`, 'aria-label': p.name, 'data-tip': p.name, 'aria-pressed': String(st().palette === p.id) });
    b.addEventListener('click', () => {
      st().palette = p.id;
      game.s.flags.add('palette');
      sw.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      changed();
    });
    sw.append(b);
  }
  row(display, 'Water colour', 'What colour the deep glows', sw);

  const scale = h('input', { type: 'range', min: 0.85, max: 1.25, step: 0.05, value: st().uiScale }) as HTMLInputElement;
  scale.addEventListener('change', () => {
    st().uiScale = Number(scale.value);
    changed();
  });
  row(display, 'Interface size', '', scale);
  row(display, 'Particles', 'Bubbles, glowing motes and ripples', toggleCtl('particles'));
  row(display, 'Floating numbers', 'Show what each tap earns', toggleCtl('floatingText'));
  row(display, 'Moving water', 'Light shafts and drifting marine snow', toggleCtl('starfield'));
  row(
    display,
    'Reduce motion',
    'Calmer animations',
    select<Settings['reducedMotion']>('reducedMotion', [['system', 'Follow system'], ['on', 'Reduce'], ['off', 'Full motion']], (v) => v as Settings['reducedMotion']),
  );
  row(display, 'Radio', 'The chatter along the bottom', toggleCtl('newsTicker'));

  /* Sound */
  const audio = group('Sound & feel');
  const vol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: st().volume }) as HTMLInputElement;
  vol.addEventListener('input', () => {
    st().volume = Number(vol.value);
    applySettings(st());
  });
  vol.addEventListener('change', () => sound.click(12, false));
  row(audio, 'Volume', '', vol);
  row(audio, 'Mute', 'Shortcut: M', toggleCtl('muted'));
  row(audio, 'Tap sounds', 'The little note on every tap', toggleCtl('tapSounds'));
  row(audio, 'Vibration', 'Haptic taps on supported phones', toggleCtl('haptics'));

  /* Gameplay */
  const play = group('Gameplay');
  row(play, 'Confirm descents', '', toggleCtl('confirmRebirth'));
  row(play, 'Confirm trenches', '', toggleCtl('confirmTrial'));
  row(play, 'Work while away', 'Harvesters keep going while the game is closed', toggleCtl('offlineProgress'));
  row(play, 'Autosave', '', select<number>('autosaveSeconds', [[10, 'Every 10 seconds'], [30, 'Every 30 seconds'], [60, 'Every minute'], [120, 'Every 2 minutes']], Number));

  /* Save */
  const saves = group('Save data');
  const area = h('textarea', { class: 'text-area', 'aria-label': 'Save code', placeholder: 'Paste a save code here to import, or press Export to get yours.', spellcheck: 'false' }) as HTMLTextAreaElement;
  const btns = h('div', { class: 'btn-row', style: 'margin-top:8px' });
  const mk = (label: string, icon: string, cls = 'btn-ghost') => {
    const b = h('button', { class: `btn btn-sm ${cls}`, type: 'button' }, `${ic(icon)} ${label}`);
    btns.append(b);
    return b;
  };
  mk('Save now', 'save').addEventListener('click', () => {
    if (saveLocal(game.s)) toast({ icon: 'save', title: 'Game saved' });
  });
  mk('Export', 'cloud-upload').addEventListener('click', async () => {
    const code = exportSave(game.s);
    area.value = code;
    area.select();
    try {
      await navigator.clipboard.writeText(code);
      toast({ icon: 'check-mark', title: 'Save copied to clipboard' });
    } catch {
      toast({ icon: 'cloud-upload', title: 'Save code ready', body: 'Copy it from the box.' });
    }
  });
  mk('Download', 'cloud-download').addEventListener('click', () => {
    const blob = new Blob([exportSave(game.s)], { type: 'text/plain' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `lanterndeep-${new Date().toISOString().slice(0, 10)}.txt` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  mk('Import', 'cloud-download').addEventListener('click', async () => {
    const code = area.value.trim();
    if (!code) {
      area.focus();
      return toast({ icon: 'help', title: 'Paste a save code first' });
    }
    let next;
    try {
      next = importSave(code);
    } catch {
      sound.denied();
      return toast({ icon: 'cross-mark', title: "That save code didn't work", body: 'Check that you copied all of it.' });
    }
    const ok = await confirmDialog({ title: 'Import this save?', icon: 'sands-of-time', html: '<p>Your current progress will be replaced.</p>', confirm: 'Import', danger: true });
    if (!ok) return;
    next.flags.add('import');
    game.s = next;
    game.invalidate();
    game.recalc();
    saveLocal(game.s);
    void closeDialog(dialog);
    onReset();
    toast({ icon: 'sands-of-time', title: 'Save imported' });
  });
  const reset = mk('Hard reset', 'trash-can', 'btn-danger');
  reset.addEventListener('click', async () => {
    const first = await confirmDialog({ title: 'Erase everything?', icon: 'trash-can', html: '<p>This deletes everything: lumen, harvesters, Black Pearls, the Reef and your finds. Settings stay.</p>', confirm: 'Continue', danger: true });
    if (!first) return;
    const second = await confirmDialog({ title: 'Really, truly?', icon: 'trash-can', html: '<p>There is no undo. Consider exporting your save first.</p>', confirm: 'Wipe it all', danger: true });
    if (!second) return;
    clearLocal();
    game.hardReset();
    saveLocal(game.s);
    void closeDialog(dialog);
    onReset();
    toast({ icon: 'water-drop', title: 'Back at the surface. Fresh start.' });
  });
  saves.append(area, btns);

  /* Credits */
  const credits = group('Credits');
  credits.append(
    h(
      'p',
      { class: 'credits' },
      `Icons from <a href="https://game-icons.net" target="_blank" rel="noopener">game-icons.net</a> by Lorc, Delapouite and contributors, licensed under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Type: Young Serif and Bricolage Grotesque (SIL Open Font License). Every sound is made live in your browser.`,
    ),
  );

  const done = h('button', { class: 'btn', type: 'button', autofocus: true }, 'Done');
  done.addEventListener('click', () => closeDialog(dialog));
  foot.append(done);
  return dialog;
}

/* ============================================================== How to play */
export function buildHelp(): HTMLDialogElement {
  const { dialog, body, foot } = makeDialog('dlg-help', 'How to play', 'open-book');
  const steps: [string, number, string, string][] = [
    ['pointing', 45, 'Tap the lure', 'Every tap gathers lumen. Tap in a steady rhythm to build a streak, and sometimes a tap gets lucky.'],
    ['sun-radiations', 48, 'Make it flare', 'Taps fill the gold ring around the lure. When it is full the lure flares: eight seconds of ×10 taps and ×3 production.'],
    ['fishing-net', 170, 'Build harvesters', 'Nets, traps, jellyfish and stranger things gather lumen for you every second. Each one improves as you own more.'],
    ['upgrade', 190, 'Visit the workshop', 'Upgrades multiply your taps, your harvesters, or everything at once. Hover, or press and hold on a phone, for details.'],
    ['clownfish', 175, 'Catch glimmerfish', 'Now and then a glowing fish swims past. Tap it for a pile of lumen or a short boost.'],
    ['high-tide', 200, 'Ride the sea events', 'Every few minutes the sea changes: plankton blooms, black tides, whale song. Each bends the rules for a while.'],
    ['anchor', 270, 'Descend', 'Once a dive has gathered a hundred million lumen you can sink deeper. You start over, but bring back Black Pearls that boost everything for good.'],
    ['coral', 150, 'Grow the Reef', 'Spend Black Pearls on the Reef, a big skill tree with autobuyers, longer away time, fish tricks and more.'],
    ['compass', 10, 'Brave the trenches', 'Later on, hard dives with odd rules give permanent rewards if you make it through.'],
  ];

  body.innerHTML = `<div class="howto">${steps
    .map(([icon, hue, t, d]) => `<div class="howto-step"><span class="gen-ic" style="--hue:${hue}">${ic(icon)}</span><div><b>${t}</b><span>${d}</span></div></div>`)
    .join('')}</div>
    <div class="section-h">Shortcuts</div>
    <div class="keys"><span><kbd>1</kbd>–<kbd>7</kbd></span><span>Switch tabs</span>
      <span><kbd>B</kbd></span><span>Cycle buy amount (×1, ×10, ×100, Next, Max)</span>
      <span><kbd>Space</kbd></span><span>Tap the lure</span>
      <span><kbd>X</kbd></span><span>Spend all: buy the cheapest harvesters until you run out</span>
      <span><kbd>U</kbd></span><span>Buy all affordable upgrades</span>
      <span><kbd>M</kbd></span><span>Mute or unmute</span>
      <span><kbd>Ctrl</kbd> + <kbd>S</kbd></span><span>Save now</span>
      <span><kbd>Enter</kbd></span><span>Tap the lure when it has focus</span></div>`;
  const go = h('button', { class: 'btn', type: 'button', autofocus: true }, 'Start diving');
  go.addEventListener('click', () => closeDialog(dialog));
  foot.append(go);
  return dialog;
}

/* ============================================================== Offline */
export function showOffline(r: { seconds: number; gain: number; capped: boolean }, capH: number, eff: number): void {
  const { dialog, body, foot } = makeDialog('dlg-offline', 'Welcome back down', 'diving-helmet');
  body.innerHTML = `<div class="dlg-hero"><p>You were gone ${fmtTime(r.seconds)}. Your harvesters kept at it and brought in</p>
    <div class="dlg-hero-v">+${fmt(r.gain)}</div><p>lumen</p></div>
    <p class="view-sub" style="text-align:center">While you're away they work at ${Math.round(eff * 100)}% for up to ${capH} hours.${
      r.capped ? ' You went past that, so some was lost. The Abyss branch of the Reef can stretch it.' : ''
    }</p>`;
  const ok = h('button', { class: 'btn', type: 'button', autofocus: true }, `${ic('water-drop')} Collect`);
  ok.addEventListener('click', () => {
    sound.unlock();
    sound.cometCatch();
    const r2 = ok.getBoundingClientRect();
    fx.burst(r2.left + r2.width / 2, r2.top + r2.height / 2, 60, { speed: 6 });
    void closeDialog(dialog);
  });
  dialog.addEventListener('close', () => setTimeout(() => dialog.remove(), 50));
  foot.append(ok);
  openDialog(dialog);
}

export { openDialog };
