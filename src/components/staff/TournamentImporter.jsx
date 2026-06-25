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
        prompt: `Extrae TODAS las tablas de clasificación de esta URL: ${url}\n\nIDENTIFICACIÓN DE GRUPOS - SER EXACTO:\n- Si la tabla está encabezada por "Grupo A", "Apertura - Grupo A", "Apertura Grupo A", o está debajo de ese título: asigna group: "Zona A"\n- Si la tabla está encabezada por "Grupo B", "Apertura - Grupo B", "Apertura Grupo B", o está debajo de ese título: asigna group: "Zona B"\n- Si la tabla está encabezada por "Tabla Anual", "Tabla General", "Tabla Anual - Tabla Anual" o similar: asigna group: "Tabla Anual"\n\nPARA CADA EQUIPO EXTRAE:\nposition (número), team_name (sin "(Reserva)"), matches_played, wins, draws, losses, goals_for, goals_against, points, team_logo_url (URL del escudo)\n\nRETORNA: Un array JSON con TODOS los equipos de TODAS las tablas. Sin texto adicional.`,
        add_context_from_internet: true,
        response_json_schema: {
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
              team_logo_url: { type: "string" },
            },
            required: ["position", "team_name", "matches_played", "wins", "draws", "losses", "goals_for", "goals_against", "points", "group"],
          },
        },
      });

      // Validar que la respuesta sea un array
      if (!Array.isArray(response) || response.length === 0) {
        console.error("Respuesta del LLM:", response);
        setError("No se encontraron datos. Asegúrate de que la URL tenga tablas con Grupo A y Grupo B.");
        return;
      }

      // Limpiar y validar datos
      const validData = response
        .filter(item => item.team_name && typeof item.position === "number" && typeof item.points === "number")
        .map(item => ({
          position: parseInt(item.position),
          team_name: String(item.team_name).replace(/\s*\(Reserva\)\s*/i, "").trim(),
          matches_played: parseInt(item.matches_played),
          wins: parseInt(item.wins),
          draws: parseInt(item.draws),
          losses: parseInt(item.losses),
          goals_for: parseInt(item.goals_for),
          goals_against: parseInt(item.goals_against),
          points: parseInt(item.points),
          group: ["Zona A", "Zona B", "Tabla Anual"].includes(item.group) ? item.group : "General",
          team_logo_url: item.team_logo_url || null,
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