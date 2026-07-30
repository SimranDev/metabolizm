import { useState } from "react";

import { AddView } from "./add-view";
import { BrowseView } from "./browse-view";
import { ReviewView } from "./review-view";
import { SyncView } from "./sync-view";

type Tab = "add" | "browse" | "review" | "sync";

const HINTS: Record<Tab, string> = {
  add: "system catalog · dev-only",
  browse: "system catalog · dev-only",
  review: "user foods · dev-only",
  sync: "live → local · dev-only",
};

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
          <button
            className={tab === "review" ? "tab active" : "tab"}
            onClick={() => setTab("review")}
          >
            Review
          </button>
          <button
            className={tab === "sync" ? "tab active" : "tab"}
            onClick={() => setTab("sync")}
          >
            Sync
          </button>
        </nav>
        <span className="hint">{HINTS[tab]}</span>
      </header>
      <main>
        {tab === "add" ? (
          <AddView />
        ) : tab === "browse" ? (
          <BrowseView />
        ) : tab === "review" ? (
          <ReviewView />
        ) : (
          <SyncView />
        )}
      </main>
    </div>
  );
}
