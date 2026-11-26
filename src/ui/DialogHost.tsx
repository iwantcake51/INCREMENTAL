import { Help, Search, Settings, Welcome } from "./Dialogs";
import { dialog } from "./store";

export function Dialogs() {
  switch (dialog.value) {
    case "help": return <Help />;
    case "search": return <Search />;
    case "settings": return <Settings />;
    case "welcome": return <Welcome />;
    default: return null;
  }
}
