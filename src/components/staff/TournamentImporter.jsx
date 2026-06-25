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
        prompt: `Analiza esta URL: ${url}\n\nBusca las tablas de clasificación. Si encuentras encabezados como "Grupo A" o "Apertura - Grupo A", todos los equipos listados debajo pertenecen a "Zona A". Si encuentras "Grupo B" o "Clausura - Grupo B", asigna "Zona B". Si hay una tabla general sin grupo específico, asigna "General".\n\nExtrae TODOS los equipos con estos campos exactos:\n- position (número del 1 al 18)\n- team_name (nombre limpio sin "(Reserva)" ni paréntesis)\n- matches_played (partidos jugados)\n- wins (victorias)\n- draws (empates)\n- losses (derrotas)\n- goals_for (goles a favor)\n- goals_against (goles en contra)\n- points (puntos totales)\n- group ("Zona A", "Zona B" o "General")\n\nDevuelve solo el JSON como array, sin explicaciones:\n[\n  {"position": 1, "team_name": "Equipo1", "matches_played": 18, "wins": 14, "draws": 2, "losses": 2, "goals_for": 40, "goals_against": 11, "points": 44, "group": "Zona A"},\n  ...\n]`,
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

      // Extraer array de la respuesta (puede estar en diferentes formatos)
      let data = Array.isArray(response) ? response : response.standings || response.data || [];
      
      // Si la respuesta es un objeto con propiedades de equipo, convertirlo a array
      if (data.length === 0 && typeof response === "object") {
        data = Object.values(response).filter(item => item.team_name && item.position);
      }

      if (!Array.isArray(data) || data.length === 0) {
        console.error("Respuesta del LLM:", response);
        setError("No se encontraron datos en esa página. Verifica que la URL tenga tablas de clasificación.");
        return;
      }

      // Validar y limpiar datos
      const validData = data.filter(item => 
        item.team_name && 
        typeof item.position === "number" && 
        typeof item.points === "number"
      ).map(item => ({
        position: parseInt(item.position) || 0,
        team_name: String(item.team_name).replace(/\s*\(Reserva\)\s*/i, "").trim(),
        matches_played: parseInt(item.matches_played) || parseInt(item.j) || 0,
        wins: parseInt(item.wins) || parseInt(item.g) || 0,
        draws: parseInt(item.draws) || parseInt(item.e) || 0,
        losses: parseInt(item.losses) || parseInt(item.p) || 0,
        goals_for: parseInt(item.goals_for) || parseInt(item.gf) || 0,
        goals_against: parseInt(item.goals_against) || parseInt(item.gc) || 0,
        points: parseInt(item.points) || parseInt(item.pts) || 0,
        group: (item.group || "General").includes("B") ? "Zona B" : (item.group || "General").includes("A") ? "Zona A" : "General"
      }));

      if (validData.length === 0) {
        setError("No se pudieron procesar los datos. Intenta con otra URL.");
        return;
      }

      // Borrar tabla anterior
      await base44.entities.TournamentStanding.deleteMany({});

      // Crear nuevos registros
      await base44.entities.TournamentStanding.bulkCreate(validData);

      toast({
        description: `✓ Tabla actualizada con ${validData.length} equipos`,
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