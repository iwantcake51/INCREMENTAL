import { ctl } from "./ctl";
import { GodPanel } from "./panels/GodPanel";
import { NewsPanel } from "./panels/NewsPanel";
import { PlanetPanel } from "./panels/PlanetPanel";
import { TechPanel } from "./panels/TechPanel";
import { WarPanel } from "./panels/WarPanel";
import { Icon } from "./common";
import { panelOpen, tab, tick, unread, type Tab } from "./store";

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: "planet", label: "World", key: "P" },
  { id: "god", label: "God", key: "G" },
  { id: "wars", label: "Wars", key: "W" },
  { id: "tech", label: "Tech", key: "Y" },
  { id: "news", label: "News", key: "B" },
];

export function SidePanel() {
  tick.value;
  const w = ctl().world;
  if (!panelOpen.value) return null;
  return (
    <aside class="side" aria-label="Details">
      <div class="tabs" role="tablist">
        {TABS.map(t => (
          <button key={t.id} role="tab" aria-selected={tab.value === t.id} class={tab.value === t.id ? "on" : ""} onClick={() => (tab.value = t.id)} data-tip={`Key ${t.key}`}>
            {t.label}
            {t.id === "news" && unread.value > 0 && <span class="badge">{unread.value > 99 ? "99+" : unread.value}</span>}
            {t.id === "wars" && w.civ.wars.length > 0 && <span class="badge red">{w.civ.wars.length}</span>}
          </button>
        ))}
        <button class="tab-close" onClick={() => (panelOpen.value = false)} aria-label="Close panel"><Icon name="close" size={16} /></button>
      </div>
      <div class="side-scroll">
        {tab.value === "planet" && <PlanetPanel />}
        {tab.value === "god" && <GodPanel />}
        {tab.value === "wars" && <WarPanel />}
        {tab.value === "tech" && <TechPanel />}
        {tab.value === "news" && <NewsPanel />}
      </div>
    </aside>
  );
}
