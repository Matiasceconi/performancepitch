import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function TournamentImporter() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());

      if (lines.length < 2) {
        setError("El archivo debe contener datos de clasificación");
        return;
      }

      // Parse CSV o tabla texto
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p) => p.trim());
        if (parts.length >= 9) {
          records.push({
            position: parseInt(parts[0]) || i,
            team_name: parts[1] || "",
            matches_played: parseInt(parts[2]) || 0,
            wins: parseInt(parts[3]) || 0,
            draws: parseInt(parts[4]) || 0,
            losses: parseInt(parts[5]) || 0,
            goals_for: parseInt(parts[6]) || 0,
            goals_against: parseInt(parts[7]) || 0,
            points: parseInt(parts[8]) || 0,
            group: parts[9] || "General",
          });
        }
      }

      if (records.length === 0) {
        setError("No se pudieron procesar los datos del archivo");
        return;
      }

      // Borrar tabla anterior
      await base44.entities.TournamentStanding.deleteMany({});

      // Crear nuevos registros
      await base44.entities.TournamentStanding.bulkCreate(records);

      toast({
        description: `✓ Tabla actualizada con ${records.length} equipos`,
      });

      e.target.value = "";
    } catch (err) {
      setError("Error al procesar el archivo: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      <label className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
        <Upload size={18} className="text-blue-400" />
        <span className="text-sm font-medium text-white">
          {loading ? "Cargando..." : "Importar CSV de clasificación"}
        </span>
        <input
          type="file"
          accept=".csv,.txt"
          onChange={handleImport}
          disabled={loading}
          className="hidden"
        />
      </label>
      {error && (
        <div className="mt-3 flex gap-2 text-xs text-red-400 p-2 bg-red-500/10 rounded">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      <p className="text-xs text-zinc-500 mt-2">Formato: posición, equipo, PJ, G, E, P, GF, GC, Pts, grupo</p>
    </div>
  );
}