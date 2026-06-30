import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, RefreshCw } from "lucide-react";

export default function AiDaySummary({ squadName, total, available, injured, differentiated, calledUp, nextMatch }) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  const generate = useCallback(async () => {
    setLoading(true);
    const prompt = `Sos el asistente de un cuerpo técnico de fútbol. Generá un resumen breve (máximo 3 frases, en español, tono profesional y directo, sin listas ni markdown) del estado del día para el plantel "${squadName || "del equipo"}".
Datos de hoy:
- Total de jugadores: ${total}
- Disponibles: ${available}
- Lesionados: ${injured}
- Diferenciados: ${differentiated}
- Convocados: ${calledUp}
${nextMatch ? `- Próximo partido: ${nextMatch.title} (${nextMatch.date || ""})` : "- Sin próximo partido programado"}`;
    const res = await base44.integrations.Core.InvokeLLM({ prompt });
    setSummary(typeof res === "string" ? res : "");
    setLoading(false);
  }, [squadName, total, available, injured, differentiated, calledUp, nextMatch]);

  useEffect(() => { generate(); }, [squadName, total, available, injured, differentiated, calledUp]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Sparkles size={14} className="text-violet-400" /> Resumen del día (IA)
        </h2>
        <button onClick={generate} disabled={loading} className="text-zinc-500 hover:text-white transition-colors">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {loading && !summary ? (
        <p className="text-zinc-600 text-sm">Generando resumen...</p>
      ) : (
        <p className="text-zinc-300 text-sm leading-relaxed">{summary || "Sin datos suficientes para generar un resumen."}</p>
      )}
    </div>
  );
}