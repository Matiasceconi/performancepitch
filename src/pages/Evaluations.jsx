import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardCheck, CalendarDays, BarChart3, Users, Upload, Settings2, Download, Loader2 } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { evaluationsGateway } from "@/lib/evaluationsApi";
import EvaluationsSummary from "@/components/evaluations/EvaluationsSummary";
import EvaluationsSessions from "@/components/evaluations/EvaluationsSessions";
import EvaluationsSquadAnalysis from "@/components/evaluations/EvaluationsSquadAnalysis";
import EvaluationsPlayers from "@/components/evaluations/EvaluationsPlayers";
import EvaluationsImportWizard from "@/components/evaluations/EvaluationsImportWizard";
import EvaluationsConfig from "@/components/evaluations/EvaluationsConfig";

const TABS = [
  { key: "resumen", label: "Resumen", icon: ClipboardCheck },
  { key: "sesiones", label: "Fechas", icon: CalendarDays },
  { key: "plantel", label: "Análisis del plantel", icon: BarChart3 },
  { key: "jugadores", label: "Jugadores", icon: Users },
  { key: "importaciones", label: "Importaciones", icon: Upload },
  { key: "config", label: "Configuración", icon: Settings2 },
];

export default function Evaluations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "resumen");
  const [selectedPlayerId, setSelectedPlayerId] = useState(searchParams.get("player_id") || null);
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [capabilities, setCapabilities] = useState(null);
  const [accessError, setAccessError] = useState("");
  const { activeSquad } = useWorkspace();

  useEffect(() => {
    if (!activeSquad?.id) return;
    let cancelled = false;
    evaluationsGateway("overview", { squad_id: activeSquad.id })
      .then((data) => {
        if (!cancelled) {
          setCapabilities(data.capabilities || {});
          setAccessError("");
        }
      })
      .catch((error) => {
        if (!cancelled) setAccessError(error?.response?.data?.error || error.message || "Sin acceso a Evaluaciones");
      });
    return () => { cancelled = true; };
  }, [activeSquad?.id]);

  useEffect(() => {
    if (!capabilities) return;
    if (activeTab === "config" && !capabilities.can_admin) setActiveTab("resumen");
    if (activeTab === "importaciones" && !capabilities.can_create) setActiveTab("resumen");
  }, [capabilities, activeTab]);

  async function handleExportCSV() {
    setExporting(true);
    try {
      const data = await evaluationsGateway("export", { squad_id: activeSquad?.id });
      const sessions = data.sessions || [];
      const results = data.results || [];
      const players = data.players || [];
      const playerMap = new Map(players.map((p) => [p.id, p]));

      const rows = results.map((r) => {
        const player = r.player_id ? playerMap.get(r.player_id) : null;
        const session = sessions.find((s) => s.session_id === r.session_id);
        return {
          fecha: r.assessment_date,
          sesion: session?.name || "",
          plantel: r.squad_name || "",
          jugador: player?.full_name || r.player_name_csv || "",
          posicion: player?.position || "",
          fuente: r.source_key || "",
          prueba: r.test_key || "",
          lado: r.test_side || "",
          intento: r.attempt_number || 1,
          retest: r.retest ? "Sí" : "No",
          principal: r.is_primary ? "Sí" : "No",
          motivo_principal: r.primary_reason || "",
          estado_vinculacion: r.linking_status || "",
          ...r.metrics,
        };
      });

      if (!rows.length) { alert("No hay datos para exportar"); return; }

      const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
      const csv = [
        headers.join(","),
        ...rows.map((r) => headers.map((h) => {
          const v = r[h];
          if (v === null || v === undefined) return "";
          if (typeof v === "number") return v;
          const s = String(v).replace(/"/g, '""');
          return s.includes(",") || s.includes("\n") ? `"${s}"` : s;
        }).join(","))
      ].join("\n");

      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `evaluaciones_${activeSquad?.name || "club"}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error al exportar: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  // Sync tab to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeTab) params.set("tab", activeTab); else params.delete("tab");
    setSearchParams(params, { replace: true });
  }, [activeTab]);

  // Select player and switch to jugadores tab
  const handleSelectPlayer = useCallback((playerId) => {
    setSelectedPlayerId(playerId);
    setActiveTab("jugadores");
    const params = new URLSearchParams(searchParams);
    params.set("tab", "jugadores");
    params.set("player_id", playerId);
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center shrink-0">
            <ClipboardCheck size={24} className="text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Evaluaciones</h1>
            <p className="text-xs text-zinc-500">Evaluaciones multisistema · ForceDecks · NordBord · ISO y más</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {capabilities?.can_export && <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-semibold hover:bg-zinc-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} /> {exporting ? "Exportando..." : "Exportar CSV"}
          </button>}
          {capabilities?.can_create && <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors flex items-center gap-2"
          >
            <Upload size={16} /> Importar CSV
          </button>}
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
        {TABS.filter((tab) =>
          (tab.key !== "config" || capabilities?.can_admin)
          && (tab.key !== "importaciones" || capabilities?.can_create)
        ).map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                isActive
                  ? "text-blue-400 border-blue-400"
                  : "text-zinc-400 hover:text-white border-transparent"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="min-h-[400px]">
        {accessError && <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-sm text-red-300">{accessError}</div>}
        {!accessError && !capabilities && <div className="py-12 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>}
        {!accessError && capabilities && <>
        {activeTab === "resumen" && <EvaluationsSummary key={refreshKey} onSelectPlayer={handleSelectPlayer} />}
        {activeTab === "sesiones" && <EvaluationsSessions key={refreshKey} onSelectPlayer={handleSelectPlayer} />}
        {activeTab === "plantel" && <EvaluationsSquadAnalysis key={refreshKey} onSelectPlayer={handleSelectPlayer} />}
        {activeTab === "jugadores" && <EvaluationsPlayers key={refreshKey} selectedPlayerId={selectedPlayerId} onSelectPlayer={handleSelectPlayer} />}
        {activeTab === "importaciones" && capabilities?.can_create && <EvaluationsImportWizard embedded onImported={() => setRefreshKey((k) => k + 1)} />}
        {activeTab === "config" && capabilities?.can_admin && <EvaluationsConfig />}
        </>}
      </div>

      {/* Import wizard modal */}
      {showImport && capabilities?.can_create && (
        <EvaluationsImportWizard
          onClose={() => setShowImport(false)}
          onImported={() => {
            setRefreshKey((k) => k + 1);
            setActiveTab("resumen");
          }}
        />
      )}
    </div>
  );
}
