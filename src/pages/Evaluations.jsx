import React, { useState } from "react";
import { ClipboardCheck, CalendarDays, BarChart3, Users, Upload, Settings2 } from "lucide-react";
import EvaluationsSummary from "@/components/evaluations/EvaluationsSummary";
import EvaluationsSessions from "@/components/evaluations/EvaluationsSessions";
import EvaluationsSquadAnalysis from "@/components/evaluations/EvaluationsSquadAnalysis";
import EvaluationsPlayers from "@/components/evaluations/EvaluationsPlayers";
import EvaluationsImportWizard from "@/components/evaluations/EvaluationsImportWizard";
import EvaluationsConfig from "@/components/evaluations/EvaluationsConfig";

const TABS = [
  { key: "resumen", label: "Resumen", icon: ClipboardCheck },
  { key: "sesiones", label: "Sesiones", icon: CalendarDays },
  { key: "plantel", label: "Análisis del plantel", icon: BarChart3 },
  { key: "jugadores", label: "Jugadores", icon: Users },
  { key: "importaciones", label: "Importaciones", icon: Upload },
  { key: "config", label: "Configuración", icon: Settings2 },
];

export default function Evaluations() {
  const [activeTab, setActiveTab] = useState("resumen");
  const [showImport, setShowImport] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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
        <button
          onClick={() => setShowImport(true)}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors flex items-center gap-2"
        >
          <Upload size={16} /> Importar CSV
        </button>
      </div>

      {/* Tab navigation */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-zinc-800 pb-px">
        {TABS.map((tab) => {
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
        {activeTab === "resumen" && <EvaluationsSummary key={refreshKey} />}
        {activeTab === "sesiones" && <EvaluationsSessions key={refreshKey} />}
        {activeTab === "plantel" && <EvaluationsSquadAnalysis key={refreshKey} />}
        {activeTab === "jugadores" && <EvaluationsPlayers key={refreshKey} />}
        {activeTab === "importaciones" && <EvaluationsImportWizard embedded onImported={() => setRefreshKey((k) => k + 1)} />}
        {activeTab === "config" && <EvaluationsConfig />}
      </div>

      {/* Import wizard modal */}
      {showImport && (
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