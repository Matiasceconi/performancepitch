import React from "react";
import StrengthLibraryPanel from "@/components/sessions/StrengthLibraryPanel";

export default function StrengthLibrary() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Biblioteca de Fuerza</h1>
        <p className="text-xs text-zinc-500 mt-1">Ejercicios reutilizables para cualquier sesión de fuerza</p>
      </div>
      <StrengthLibraryPanel />
    </div>
  );
}