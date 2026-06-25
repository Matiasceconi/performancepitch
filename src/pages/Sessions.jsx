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
      <div className="flex items-center gap-4">
        <img src="https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/8fd8abe30_Escudo_del_Club_Social_y_Deportivo_Defensa_y_Justiciasvg.png" alt="Escudo Defensa y Justicia" className="w-14 h-14 object-contain" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sesiones</h1>
          <p className="text-zinc-500 text-sm mt-1">Organizá y registrá los entrenamientos del equipo</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex items-center bg-gradient-to-r from-zinc-800 to-zinc-900 rounded-lg p-1 gap-1 w-fit border border-zinc-700">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              tab === key ? "bg-accent text-zinc-900 shadow-lg" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        {tab === "field"     && <FieldSessions />}
        {tab === "strength"  && <StrengthSessions />}
        {tab === "exercises" && <ExercisesLibrary />}
      </div>
    </div>
  );
}