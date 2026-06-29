import React, { useState } from "react";
import MinutesTracker from "@/components/performance/MinutesTracker";
import MinutesByMatch from "@/components/performance/MinutesByMatch";

const SUB_TABS = [
  { id: "summary", label: "Resumen por jugador" },
  { id: "matches", label: "Detalle por partido" },
];

export default function MinutesSubPanel() {
  const [subTab, setSubTab] = useState("summary");

  return (
    <div className="space-y-5">
      <div className="flex gap-0 border-b border-zinc-800">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all -mb-px ${
              subTab === t.id
                ? "border-yellow-400 text-yellow-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "summary" && <MinutesTracker />}
      {subTab === "matches" && <MinutesByMatch />}
    </div>
  );
}