import React from "react";
import FieldLibraryPanel from "@/components/sessions/FieldLibraryPanel";

export default function FieldLibrary() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white">Biblioteca de Campo</h1>
        <p className="text-xs text-zinc-500 mt-1">Ejercicios reutilizables para cualquier sesión de campo</p>
      </div>
      <FieldLibraryPanel />
    </div>
  );
}