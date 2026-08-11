import React, { useState, useEffect, useCallback } from "react";
import { Loader2, AlertCircle, Calendar, Users, TrendingUp, TrendingDown, Minus, Info, ArrowUp, ArrowDown, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { evaluationsSummary } from "@/lib/evaluationsApi";
import ReviewTray from "@/components/evaluations/ReviewTray";
import ChangeMap from "@/components/evaluations/ChangeMap";
import PlayerPhoto from "@/components/player/PlayerPhoto";

function fmtDate(iso) {
  if (!iso) return "—";
  try { return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

function fmtVal(v, d = 1) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  return Number(v).toFixed(d);
}

function fmtPct(v) {
  if (v === null || v === undefined || !isFinite(v)) return "—";
  const s = v > 0 ? "+" : "";
  return `${s}${Number(v).toFixed(1)}%`;
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
      const summary = await evaluationsSummary({
        session_id: sessionId,
        squad_id: activeSquad?.id,
      });
      setData(summary);
      if (summary?.session && !sessionId) {
        setSelectedSession(summary.session.session_id);
      }
      if (summary?.change_map?.metrics?.length) {
        setSelectedMetric((current) => summary.change_map.metrics.includes(current) ? current : summary.change_map.metrics[0]);
      }
    } catch (e) {
      setError(e.message || "Error al cargar el resumen");
    } finally {
      setLoading(false);
    }
  }, [activeSquad?.id]);

  useEffect(() => { fetchSummary(selectedSession); }, [fetchSummary, selectedSession]);

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
          <p className="text-zinc-400 text-sm font-medium">No hay fechas de evaluación</p>
          <p className="text-zinc-600 text-xs mt-1">Importá un CSV de ForceDecks para crear la primera batería</p>
        </div>
      </div>
    );
  }

  const { session, review_tray, improvements, declines, mixed_signals, change_map, secondary_info, sessions_list, previous_session } = data;

  return (
    <div className="space-y-5">
      {/* ── 1. Session header ──────────────────────────────────────────────── */}
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

        {/* Session stats */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-zinc-500" />
            <div><p className="text-sm font-bold text-white">{session.total_players || 0}</p><p className="text-[10px] text-zinc-500">Jugadores</p></div>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-zinc-500" />
            <div><p className="text-sm font-bold text-white">{session.total_results || 0}</p><p className="text-[10px] text-zinc-500">Resultados</p></div>
          </div>
          {previous_session && (
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-zinc-500" />
              <div><p className="text-sm font-bold text-white truncate">{fmtDate(previous_session.assessment_date)}</p><p className="text-[10px] text-zinc-500">Fecha anterior</p></div>
            </div>
          )}
        </div>

        {/* Session selector */}
        {sessions_list?.length > 1 && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs text-zinc-500 font-medium">Fecha:</span>
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

      {/* ── 2. Data review (identities, quality, pending) ─────────────────── */}
      <ReviewTray items={review_tray} onSelectPlayer={onSelectPlayer} />

      {/* ── 3. Improvements ───────────────────────────────────────────────── */}
      {improvements?.length > 0 && (
        <SignalBlock
          title="Mejoras"
          icon={ArrowUp}
          iconColor="text-emerald-400"
          bgClass="bg-emerald-500/10"
          borderClass="border-emerald-500/30"
          badgeClass="bg-emerald-500/15 text-emerald-300"
          players={improvements}
          onSelectPlayer={onSelectPlayer}
          valueField="change_pct"
          positive
        />
      )}

      {/* ── 4. Declines ────────────────────────────────────────────────────── */}
      {declines?.length > 0 && (
        <SignalBlock
          title="Caídas"
          icon={ArrowDown}
          iconColor="text-red-400"
          bgClass="bg-red-500/10"
          borderClass="border-red-500/30"
          badgeClass="bg-red-500/15 text-red-300"
          players={declines}
          onSelectPlayer={onSelectPlayer}
          valueField="change_pct"
          positive={false}
        />
      )}

      {/* ── 5. Mixed signals ──────────────────────────────────────────────── */}
      {mixed_signals?.length > 0 && (
        <SignalBlock
          title="Señales mixtas"
          icon={AlertTriangle}
          iconColor="text-yellow-400"
          bgClass="bg-yellow-500/10"
          borderClass="border-yellow-500/30"
          badgeClass="bg-yellow-500/15 text-yellow-300"
          players={mixed_signals}
          onSelectPlayer={onSelectPlayer}
          valueField="change_pct"
          mixed
        />
      )}

      {/* ── 6. Change map ─────────────────────────────────────────────────── */}
      {change_map?.players?.length > 0 && (
        <ChangeMap players={change_map.players} metricKey={selectedMetric} allMetrics={change_map.metrics} onSelectPlayer={onSelectPlayer} />
      )}

      {/* ── 7. Coverage info ──────────────────────────────────────────────── */}
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

function SignalBlock({ title, icon: Icon, iconColor, bgClass, borderClass, badgeClass, players, onSelectPlayer, valueField, positive, mixed }) {
  const [expanded, setExpanded] = useState(new Set());
  const totalCases = players.reduce((sum, p) => sum + p.metrics.length, 0);

  function toggle(pid) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }

  return (
    <div className={`bg-zinc-900 border ${borderClass} rounded-xl overflow-hidden`}>
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg ${bgClass} flex items-center justify-center`}>
            <Icon size={16} className={iconColor} />
          </div>
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <span className={`px-2 py-0.5 rounded ${badgeClass} text-xs font-bold`}>{players.length} jugadores · {totalCases} casos</span>
        </div>
        <p className="text-xs text-zinc-500 hidden sm:block">Ordenado por magnitud relativa</p>
      </div>

      <div className="divide-y divide-zinc-800/50">
        {players.map((p) => {
          const isOpen = expanded.has(p.player_id);
          const topMetric = p.metrics[0];
          return (
            <div key={p.player_id} className="p-3">
              <button
                onClick={() => { if (p.player_id && onSelectPlayer) onSelectPlayer(p.player_id); else toggle(p.player_id); }}
                className="w-full flex items-center gap-3 text-left"
              >
                <PlayerPhoto player={{ photo_url: p.player_photo_url, full_name: p.player_name }} className="w-8 h-8 rounded-full object-cover border border-zinc-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{p.player_name}</p>
                  <p className="text-xs text-zinc-500">{p.position} · {p.metrics.length} métrica(s)</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {topMetric && (
                    <span className={`text-sm font-bold tabular-nums ${mixed ? "text-yellow-400" : positive ? "text-emerald-400" : "text-red-400"}`}>
                      {fmtPct(topMetric[valueField])}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(p.player_id); }}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
                  >
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </button>

              {isOpen && (
                <div className="mt-2 ml-11 space-y-1">
                  {p.metrics.map((m, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs py-1">
                      <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 font-bold uppercase text-[10px] shrink-0">{m.test_key}</span>
                      <span className="text-zinc-300 flex-1 min-w-0 truncate">{m.metric_label || m.metric_key}</span>
                      <span className="text-zinc-500 tabular-nums">{fmtVal(m.current_value)}{m.unit ? ` ${m.unit}` : ""}</span>
                      <span className={`tabular-nums font-semibold ${mixed ? "text-yellow-400" : positive ? "text-emerald-400" : "text-red-400"}`}>
                        {fmtPct(m[valueField])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
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
