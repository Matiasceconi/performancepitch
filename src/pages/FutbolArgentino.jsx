import React, { useState, useMemo } from "react";
import { Trophy, Loader2, AlertCircle, RefreshCw, Calendar, ListOrdered, CalendarDays, Info, Layers } from "lucide-react";
import { useFootballData } from "@/components/futbol/useFootballData";
import StandingsTable from "@/components/futbol/StandingsTable";
import FixturesList from "@/components/futbol/FixturesList";
import CalendarTab from "@/components/futbol/CalendarTab";
import CompetitionSelector from "@/components/futbol/CompetitionSelector";

function fmtUpdated(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

const TABS = [
  { id: "standings", label: "Tabla de Posiciones", icon: ListOrdered },
  { id: "fixtures", label: "Fixture", icon: Calendar },
  { id: "calendar", label: "Calendario", icon: CalendarDays },
];

export default function FutbolArgentino() {
  const { data, loading, refreshing, error, refetch } = useFootballData();
  const [tab, setTab] = useState("standings");
  const [selectedCompId, setSelectedCompId] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const competitions = data?.competitions || [];
  const activeCompId = selectedCompId || competitions[0]?.id || null;
  const competition = competitions.find((c) => c.id === activeCompId) || competitions[0];

  const allStandings = activeCompId ? data?.standings?.[activeCompId] : null;

  // Zones derived from standings group field
  const zones = useMemo(() => {
    if (!allStandings) return [];
    return [...new Set(allStandings.map((s) => s.group).filter(Boolean))];
  }, [allStandings]);

  // Reset zone if it's no longer valid for the current competition
  const activeZone = zones.includes(selectedZone) ? selectedZone : zones[0] || null;

  const zoneStandings = useMemo(() => {
    if (!allStandings) return null;
    if (!activeZone) return allStandings;
    return allStandings.filter((s) => s.group === activeZone);
  }, [allStandings, activeZone]);

  const compFixtures = useMemo(
    () => (data?.fixtures || []).filter((f) => f.competitionId === activeCompId),
    [data?.fixtures, activeCompId]
  );

  // Fixtures filtered by zone (for Fixture tab only)
  const zoneFixtures = useMemo(() => {
    if (!activeZone) return compFixtures;
    return compFixtures.filter((f) => !f.group || f.group === activeZone);
  }, [compFixtures, activeZone]);

  // Most recent updatedAt
  const updatedAt = useMemo(() => {
    const times = [];
    if (allStandings) allStandings.forEach((s) => s.updatedAt && times.push(new Date(s.updatedAt).getTime()));
    (data?.fixtures || []).forEach((f) => f.updatedAt && times.push(new Date(f.updatedAt).getTime()));
    if (data?.updatedAt) times.push(new Date(data.updatedAt).getTime());
    if (!times.length) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [allStandings, data?.fixtures, data?.updatedAt]);

  const hasStandings = zoneStandings && zoneStandings.length > 0;
  const hasFixtures = compFixtures.length > 0;
  const isEmpty = !hasStandings && !hasFixtures;
  const showZoneSelector = zones.length > 1 && (tab === "standings" || tab === "fixtures");

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {competition?.logo ? (
            <img src={competition.logo} alt="" className="w-12 h-12 object-contain" onError={(e) => { e.target.style.display = "none"; }} />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
              <Trophy size={22} className="text-yellow-400" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
              <Trophy size={20} className="text-yellow-400 hidden sm:inline" />
              Fútbol Argentino
            </h1>
            <p className="text-sm text-zinc-500">{competition?.name || "Liga Profesional"}{competition?.season ? ` · ${competition.season}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-zinc-500">Última actualización</p>
            <p className="text-sm text-zinc-300 font-medium">{fmtUpdated(updatedAt)}</p>
          </div>
          <button
            onClick={refetch}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>

      {/* Competition selector */}
      {competitions.length > 0 && (
        <CompetitionSelector competitions={competitions} value={activeCompId} onChange={setSelectedCompId} />
      )}

      {/* Zone selector (standings + fixtures tabs only) */}
      {showZoneSelector && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <Layers size={13} /> Zona
          </span>
          <div className="flex gap-1.5 flex-wrap">
            {zones.map((z) => (
              <button
                key={z}
                onClick={() => setSelectedZone(z)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeZone === z ? "bg-white text-zinc-950" : "bg-zinc-900 text-zinc-400 border border-zinc-800 hover:text-white"}`}
              >
                {z}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? "border-yellow-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-zinc-600" />
          <p className="text-zinc-500 text-sm">Cargando datos...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <AlertCircle size={26} className="text-red-400" />
          </div>
          <p className="text-zinc-400 text-sm text-center max-w-xs">{error}</p>
          <button onClick={refetch} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-950 rounded-xl text-sm font-bold hover:bg-zinc-200 transition-colors">
            <RefreshCw size={15} /> Reintentar
          </button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
            <Info size={24} className="text-zinc-500" />
          </div>
          <p className="text-zinc-400 text-sm max-w-sm">No hay datos disponibles para este torneo todavía. La sincronización se realiza automáticamente todos los días.</p>
          <button onClick={refetch} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-medium transition-colors mt-1">
            <RefreshCw size={14} /> Reintentar ahora
          </button>
        </div>
      ) : (
        <>
          {tab === "standings" && <StandingsTable standings={zoneStandings} competitionName={competition?.name} />}
          {tab === "fixtures" && <FixturesList fixtures={zoneFixtures} />}
          {tab === "calendar" && <CalendarTab fixtures={compFixtures} />}
        </>
      )}
    </div>
  );
}