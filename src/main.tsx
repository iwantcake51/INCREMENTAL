import { render } from "preact";
import "./styles.css";
import { Engine } from "./render/Engine";
import { World } from "./sim/world";
import { App } from "./ui/App";
import { Controller } from "./ui/controller";
import { setCtl } from "./ui/ctl";
import { hover, selected, thumbVersion } from "./ui/store";
import { onThumbs } from "./render/thumbs";

onThumbs(() => { thumbVersion.value++; });

const root = document.getElementById("app")!;
root.innerHTML = `<div class="stage"><canvas id="sky" aria-label="3D view of the solar system"></canvas><div class="labels" id="labels"></div></div><div id="ui"></div>`;

const world = new World();
let controller: Controller;
const engine = new Engine(document.getElementById("sky") as HTMLCanvasElement, document.getElementById("labels")!, world, {
  onSelect: id => controller.select(id),
  onHover: info => { hover.value = info; },
});
controller = new Controller(world, engine);
setCtl(controller);
controller.init();
engine.selected = selected.value;

render(<App />, document.getElementById("ui")!);
engine.renderer.setAnimationLoop(() => engine.frame());

// Debug handle for the console.
(window as any).orrery = { world, engine, controller };
