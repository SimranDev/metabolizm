import { useState } from "react";

import { AddView } from "./add-view";
import { BrowseView } from "./browse-view";
import { ReviewView } from "./review-view";

type Tab = "add" | "browse" | "review";

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
        </nav>
        <span className="hint">
          {tab === "review" ? "user foods · dev-only" : "system catalog · dev-only"}
        </span>
      </header>
      <main>
        {tab === "add" ? (
          <AddView />
        ) : tab === "browse" ? (
          <BrowseView />
        ) : (
          <ReviewView />
        )}
      </main>
    </div>
  );
}
