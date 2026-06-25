import React, { useState } from "react";
import { Dumbbell, TreePine, BookOpen } from "lucide-react";
import FieldSessions from "@/pages/FieldSessions";
import StrengthSessions from "@/pages/StrengthSessions";
import ExercisesLibrary from "@/pages/ExercisesLibrary";

export default function Sessions() {
  const [tab, setTab] = useState("field"); // "field" | "strength" | "exercises"

  const tabs = [
    { key: "field",      label: "Campo",      icon: TreePine },
    { key: "strength",   label: "Fuerza",     icon: Dumbbell },
    { key: "exercises",  label: "Ejercicios", icon: BookOpen },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sesiones</h1>
        <p className="text-zinc-500 text-sm mt-1">Organizá y registrá los entrenamientos del equipo</p>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === key ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "field"     && <FieldSessions />}
      {tab === "strength"  && <StrengthSessions />}
      {tab === "exercises" && <ExercisesLibrary />}
    </div>
  );
}