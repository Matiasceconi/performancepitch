import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, AlertCircle, Loader } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function TournamentImporter() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImport = async () => {
    if (!url.trim()) {
      setError("Ingresa una URL");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Usar LLM para extraer datos de la página
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Extrae la tabla de clasificación de esta URL: ${url}\n\nDevuelve un JSON con un array de objetos así:\n[\n  {\n    "position": número,\n    "team_name": "nombre del equipo",\n    "matches_played": número,\n    "wins": número,\n    "draws": número,\n    "losses": número,\n    "goals_for": número,\n    "goals_against": número,\n    "points": número,\n    "group": "General" o "Zona A" o "Zona B"\n  }\n]\n\nSolo devuelve el JSON válido, sin explicaciones.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: "object",
          properties: {
            standings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  position: { type: "number" },
                  team_name: { type: "string" },
                  matches_played: { type: "number" },
                  wins: { type: "number" },
                  draws: { type: "number" },
                  losses: { type: "number" },
                  goals_for: { type: "number" },
                  goals_against: { type: "number" },
                  points: { type: "number" },
                  group: { type: "string" },
                },
              },
            },
          },
        },
      });

      const data = response.standings || response;
      if (!Array.isArray(data) || data.length === 0) {
        setError("No se encontraron datos en esa página");
        return;
      }

      // Borrar tabla anterior
      await base44.entities.TournamentStanding.deleteMany({});

      // Crear nuevos registros
      await base44.entities.TournamentStanding.bulkCreate(data);

      toast({
        description: `✓ Tabla actualizada con ${data.length} equipos`,
      });

      setUrl("");
    } catch (err) {
      setError("Error al procesar la página: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="Pega la URL de la clasificación..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          onKeyPress={(e) => e.key === "Enter" && handleImport()}
        />
        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 text-white text-sm font-medium transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <Loader size={16} className="animate-spin" /> Cargando...
            </>
          ) : (
            <>
              <Upload size={16} /> Importar
            </>
          )}
        </button>
      </div>
      {error && (
        <div className="mt-3 flex gap-2 text-xs text-red-400 p-2 bg-red-500/10 rounded">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}
      <p className="text-xs text-zinc-500 mt-2">Pega el enlace de cualquier página con la tabla de posiciones</p>
    </div>
  );
}