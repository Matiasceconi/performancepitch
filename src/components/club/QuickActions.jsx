import React from "react";
import { ListOrdered, Table2, Share2 } from "lucide-react";

export default function QuickActions({ onFixture, onTable }) {
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "PerformancePitch", url: window.location.href }); } catch {}
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={onFixture} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">
        <ListOrdered size={15} /> Ver Fixture
      </button>
      <button onClick={onTable} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">
        <Table2 size={15} /> Ver Tabla
      </button>
      <button onClick={share} className="flex items-center gap-2 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors">
        <Share2 size={15} /> Compartir
      </button>
    </div>
  );
}