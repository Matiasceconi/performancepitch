import React, { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, Calendar, Users, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import ReviewTray from "@/components/evaluations/ReviewTray";
import ChangeMap from "@/components/evaluations/ChangeMap";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export default function EvaluationsSummary({ onSelectPlayer }) {
  const { activeSquad } = useWorkspace();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState(null);

  const fetchSummary = useCallback(async (sessionId) => {
    setLoading(true);
    setError("");
    try {
      const resp = await base44.functions.invoke("getEvaluationsSummary", {
        session_id: sessionId,
        squad_id: activeSquad?.id,
      });
      setData(resp.data);
      if (resp.data?.session && !sessionId) {
        setSelectedSession(resp.data.session.session_id);
      }
      // Auto-select first metric for change map
      if (resp.data?.change_map?.metrics?.length && !selectedMetric) {
        setSelectedMetric(resp.data.change_map.metrics[0]);
      }
    } catch (e) {
      setError(e.message || "Error al cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, [activeSquad?.id, selectedMetric]);

  useEffect(() => { fetchSummary(selectedSession); }, [fetchSummary]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-64 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
        <div className="h-40 bg-zinc-900 border border-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-zinc-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data?.session) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <Calendar size={28} className="text-zinc-600" />
        <div>
          <p className="text-zinc-400 text-sm font-medium">No hay sesiones de evaluación</p>
          <p className="text-zinc-600 text-xs mt-1">Importá un CSV de ForceDecks para crear la primera batería</p>
        </div>
      </div>
    );
  }

  const { session, review_tray, change_map, secondary_info, sessions_list } = data;

  return (
    <div className="space-y-5">
      {/* Compact header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Calendar size={18} className="text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{session.name || `Batería ${fmtDate(session.assessment_date)}`}</p>
              <p className="text-xs text-zinc-500 truncate">
                {fmtDate(session.assessment_date)} · {session.squad_name || "Sin plantel"} · {session.context || "Sin contexto"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {session.test_keys?.map((tk) => (
              <span key={tk} className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 text-xs font-bold uppercase">{tk}</span>
            ))}
          </div>
        </div>

        {/* Session selector */}
        {sessions_list?.length > 1 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-medium">Sesión:</span>
            <select
              value={selectedSession || ""}
              onChange={(e) => { setSelectedSession(e.target.value); setSelectedMetric(null); }}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            >
              {sessions_list.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {fmtDate(s.assessment_date)} — {s.name || s.squad_name || "Sin nombre"}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Metric selector for change map */}
        {change_map?.metrics?.length > 0 && (
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-medium">Métrica (mapa):</span>
            <select
              value={selectedMetric || ""}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-white max-w-[260px]"
            >
              {change_map.metrics.map((mk) => (
                <option key={mk} value={mk}>{mk}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Review tray — main priority */}
      <ReviewTray items={review_tray} onSelectPlayer={onSelectPlayer} />

      {/* Change map */}
      {change_map?.players?.length > 0 && (
        <ChangeMap players={change_map.players} metricKey={selectedMetric} allMetrics={change_map.metrics} onSelectPlayer={onSelectPlayer} />
      )}

      {/* Secondary info — compact */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Info size={13} /> Información de cobertura
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SecondaryStat label="Jugadores evaluados" value={secondary_info.total_players} icon={Users} />
          <SecondaryStat label="Cobertura del plantel" value={`${secondary_info.coverage}%`} icon={TrendingUp} />
          <SecondaryStat label="Sin evaluar" value={secondary_info.players_without_eval} icon={TrendingDown} />
          <SecondaryStat label="Sin línea base" value={secondary_info.players_without_baseline} icon={Minus} />
          <SecondaryStat label="Baterías completas" value={secondary_info.complete_batteries} icon={Users} />
          <SecondaryStat label="Baterías incompletas" value={secondary_info.incomplete_batteries} icon={Minus} />
          <SecondaryStat label="Resultados pendientes" value={secondary_info.pending_results} icon={AlertCircle} />
          <SecondaryStat label="Advertencias calidad" value={secondary_info.quality_warnings} icon={AlertCircle} />
        </div>
      </div>
    </div>
  );
}

function SecondaryStat({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={14} className="text-zinc-500 shrink-0" />
      <div>
        <p className="text-lg font-bold text-white leading-tight">{value}</p>
        <p className="text-[11px] text-zinc-500 leading-tight">{label}</p>
      </div>
    </div>
  );
}