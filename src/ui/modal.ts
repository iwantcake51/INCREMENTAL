import { h, escapeHtml } from './dom';
import { ic } from './icons';

/* Native <dialog> helpers: showModal() for focus/inert/Esc, CSS @starting-style for entry,
   and an animated close that also works where display/overlay can't transition. */

let supportsDisplayTransition: boolean | undefined;
function canTransitionDisplay(): boolean {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) return (supportsDisplayTransition = false);
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}
const supportsTopLayerExit = () => !!window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();

export async function closeDialog(dialog: HTMLDialogElement, value = ''): Promise<void> {
  if (!dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const anims = dialog.getAnimations({ subtree: true });
    await Promise.race([Promise.allSettled(anims.map((a) => a.finished)), new Promise((r) => setTimeout(r, 320))]);
    dialog.removeAttribute('data-closing');
  }
  dialog.close(value);
}

const outside = (e: PointerEvent, d: HTMLDialogElement) => {
  const r = d.getBoundingClientRect();
  return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
};

/** Creates a dialog shell; content goes into the returned body/foot. */
export function makeDialog(id: string, title: string, icon?: string): { dialog: HTMLDialogElement; body: HTMLElement; foot: HTMLElement } {
  const dialog = h('dialog', { id, 'aria-labelledby': `${id}-title`, closedby: 'any' });
  dialog.innerHTML = `<div class="dlg">
    <div class="dlg-head">${icon ? `<span style="font-size:1.5rem;color:var(--accent)">${ic(icon)}</span>` : ''}
      <h2 id="${id}-title">${escapeHtml(title)}</h2>
      <button class="icon-btn" type="button" aria-label="Close" data-close><svg class="x-ic" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12"/></svg></button></div>
    <div class="dlg-body"></div><div class="dlg-foot"></div></div>`;
  document.body.append(dialog);
  dialog.querySelector('[data-close]')!.addEventListener('click', () => closeDialog(dialog));
  // Animate Esc / light-dismiss closes too.
  dialog.addEventListener('cancel', (e) => {
    e.preventDefault();
    void closeDialog(dialog);
  });
  // Light-dismiss fallback where closedby isn't supported.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => (pressedOutside = outside(e, dialog)));
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && outside(e, dialog)) void closeDialog(dialog);
    });
  }
  return { dialog, body: dialog.querySelector('.dlg-body')!, foot: dialog.querySelector('.dlg-foot')! };
}

export function openDialog(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal();
}

/** Promise-based confirmation. The safe action gets initial focus. */
export function confirmDialog(o: { title: string; html: string; confirm: string; icon?: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => {
    const { dialog, body, foot } = makeDialog('dlg-confirm-' + Math.random().toString(36).slice(2, 7), o.title, o.icon);
    body.innerHTML = o.html;
    const cancel = h('button', { class: 'btn btn-ghost', type: 'button', autofocus: true }, 'Cancel');
    const ok = h('button', { class: `btn ${o.danger ? 'btn-danger' : ''}`, type: 'button' }, escapeHtml(o.confirm));
    foot.append(cancel, ok);
    let result = false;
    cancel.addEventListener('click', () => closeDialog(dialog));
    ok.addEventListener('click', () => {
      result = true;
      void closeDialog(dialog);
    });
    dialog.addEventListener('close', () => {
      resolve(result);
      setTimeout(() => dialog.remove(), 50);
    });
    openDialog(dialog);
  });
}
