import React, { useState } from "react";
import { Trophy, Loader2, AlertCircle, RefreshCw, Calendar, ListOrdered } from "lucide-react";
import { useFootballData } from "@/components/futbol/useFootballData";
import StandingsTable from "@/components/futbol/StandingsTable";
import FixturesList from "@/components/futbol/FixturesList";

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

export default function FutbolArgentino() {
  const { data, loading, error, refetch } = useFootballData();
  const [tab, setTab] = useState("standings"); // standings | fixtures

  const competition = (data?.competitions || [])[0];
  const competitionId = competition?.id;
  const standings = competitionId ? data?.standings?.[competitionId] : null;
  const fixtures = data?.fixtures || [];
  const updatedAt = standings?.[0]?.updatedAt || data?.updatedAt;

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
            <p className="text-sm text-zinc-500">{competition?.name || "Liga Profesional de Fútbol"}{competition?.season ? ` · ${competition.season}` : ""}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500">Última actualización</p>
          <p className="text-sm text-zinc-300 font-medium">{fmtUpdated(updatedAt)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800">
        <button
          onClick={() => setTab("standings")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "standings" ? "border-yellow-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
          <ListOrdered size={16} /> Tabla de Posiciones
        </button>
        <button
          onClick={() => setTab("fixtures")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === "fixtures" ? "border-yellow-400 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
          <Calendar size={16} /> Fixture
        </button>
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
      ) : (
        <>
          {tab === "standings" && <StandingsTable standings={standings} competitionName={competition?.name} />}
          {tab === "fixtures" && <FixturesList fixtures={fixtures} />}
        </>
      )}
    </div>
  );
}