import { Dialogs } from "./DialogHost";
import { Dock } from "./Dock";
import { Flash, HoverTip, Ticker, Toasts } from "./Overlays";
import { SidePanel } from "./SidePanel";
import { Timeline } from "./Timeline";
import { TopBar, Transport } from "./TopBar";
import { hideUI, panelOpen } from "./store";

/** Everything drawn over the 3D view. */
export function App() {
  if (hideUI.value) return <button class="unhide" onClick={() => (hideUI.value = false)}>Show interface (U)</button>;
  return (
    <div class={`hud ${panelOpen.value ? "with-panel" : ""}`}>
      <TopBar />
      <Toasts />
      <SidePanel />
      <div class="bottom">
        <Ticker />
        <div class="timebar"><Transport /><Timeline /></div>
        <Dock />
      </div>
      <HoverTip />
      <Flash />
      <Dialogs />
    </div>
  );
}
