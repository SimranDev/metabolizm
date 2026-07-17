import { useState } from "react";

import { AddView } from "./add-view";
import { BrowseView } from "./browse-view";

type Tab = "add" | "browse";

export function App() {
  const [tab, setTab] = useState<Tab>("add");

  return (
    <div className="shell">
      <header>
        <h1>Metabolizm · catalog admin</h1>
        <nav>
          <button
            className={tab === "add" ? "tab active" : "tab"}
            onClick={() => setTab("add")}
          >
            Add
          </button>
          <button
            className={tab === "browse" ? "tab active" : "tab"}
            onClick={() => setTab("browse")}
          >
            Browse
          </button>
        </nav>
        <span className="hint">system catalog · dev-only</span>
      </header>
      <main>{tab === "add" ? <AddView /> : <BrowseView />}</main>
    </div>
  );
}
