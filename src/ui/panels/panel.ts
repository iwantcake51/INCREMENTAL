export interface Panel {
  id: string;
  label: string;
  icon: string;
  el: HTMLElement;
  /** Called ~10×/s while the panel is visible. */
  update(): void;
  /** Show a "something to do here" dot on the tab. */
  badge?(): boolean;
  onShow?(): void;
  /** Hidden from the tab bar until this returns true. */
  available?(): boolean;
}
