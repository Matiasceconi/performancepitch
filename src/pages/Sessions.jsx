import React, { useState } from "react";
import { Dumbbell, TreePine } from "lucide-react";
import FieldSessions from "@/pages/FieldSessions";
import StrengthSessions from "@/pages/StrengthSessions";

export default function Sessions() {
  const [tab, setTab] = useState("field"); // "field" | "strength"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sesiones</h1>
        <p className="text-zinc-500 text-sm mt-1">Organizá y registrá los entrenamientos del equipo</p>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1 w-fit">
        <button
          onClick={() => setTab("field")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "field" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
          }`}
        >
          <TreePine size={15} /> Campo
        </button>
        <button
          onClick={() => setTab("strength")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "strength" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
          }`}
        >
          <Dumbbell size={15} /> Fuerza
        </button>
      </div>

      {tab === "field" && <FieldSessions />}
      {tab === "strength" && <StrengthSessions />}
    </div>
  );
}