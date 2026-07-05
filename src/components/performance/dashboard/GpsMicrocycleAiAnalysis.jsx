import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Brain } from "lucide-react";
import { fmt, MICRO_METRICS } from "./gpsMicrocycleReportUtils";

function buildPrompt({ dailySummaries, highlights, comparison }) {
  const payload = {
    days: dailySummaries.map((d) => ({
      date: d.date,
      md: d.md,
      sessions: d.sessions.map((s) => s.title),
      gpsPlayers: d.gpsPlayers,
      excludedPlayers: d.excludedRows.map((r) => ({ name: r.player_name, group: r.gps_group || r.exclusion_reason || "excluido" })),
      metrics: Object.fromEntries(MICRO_METRICS.map((m) => [m.key, fmt(d[m.key], m.unit)])),
    })),
    highlights: highlights.map((h) => ({ metric: h.metric.label, player: h.best?.name || null, value: h.best ? fmt(h.best.value, h.metric.unit) : null })),
    comparison: comparison.map((c) => ({ metric: c.metric.label, current: fmt(c.current, c.metric.unit), previous: fmt(c.previous, c.metric.unit), diff: c.diff == null ? null : `${c.diff.toFixed(0)}%`, trend: c.trend })),
  };
  return `Actuá como preparador físico profesional de fútbol. Analizá únicamente estos datos reales de GPS del microciclo, sin inventar información ni asumir datos ausentes. Escribí un informe breve, claro y accionable para cuerpo técnico en español. Debe mencionar: mayor volumen, mayor intensidad, carga mecánica ACC/DEC, alta velocidad, Player Load, jugadores con mayor carga, picos de velocidad, cargas altas/bajas si surgen de los datos, excluidos, y coherencia general con MD si los MD están informados. Datos JSON: ${JSON.stringify(payload)}`;
}

export default function GpsMicrocycleAiAnalysis({ dailySummaries, highlights, comparison, onAnalysisReady }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => JSON.stringify(dailySummaries.map((d) => [d.date, d.gpsPlayers, d.total_distance, d.player_load, d.acc_3, d.dec_3, d.smax])), [dailySummaries]);

  useEffect(() => {
    async function generate() {
      const hasData = dailySummaries.some((d) => d.gpsPlayers > 0);
      if (!hasData) {
        const emptyText = "Sin datos GPS suficientes para generar análisis inteligente del microciclo.";
        setAnalysis(emptyText);
        onAnalysisReady?.(emptyText);
        return;
      }
      setLoading(true);
      try {
        const text = await base44.integrations.Core.InvokeLLM({ prompt: buildPrompt({ dailySummaries, highlights, comparison }) });
        setAnalysis(text);
        onAnalysisReady?.(text);
      } catch {
        const fallback = "No se pudo generar el análisis inteligente en este momento.";
        setAnalysis(fallback);
        onAnalysisReady?.(fallback);
      } finally {
        setLoading(false);
      }
    }
    generate();
  }, [key]);

  return (
    <div className="bg-gradient-to-br from-emerald-950/40 to-zinc-950 border border-emerald-800/40 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center"><Brain size={20} className="text-emerald-300" /></div>
        <div>
          <h3 className="text-white font-bold text-lg">Análisis inteligente del microciclo</h3>
          <p className="text-zinc-500 text-sm">Generado solo con datos reales cargados.</p>
        </div>
      </div>
      {loading ? <p className="text-zinc-400 text-sm">Analizando carga semanal...</p> : <p className="text-zinc-200 text-sm leading-7 whitespace-pre-line">{analysis}</p>}
    </div>
  );
}