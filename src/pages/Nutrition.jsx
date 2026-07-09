import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import moment from "moment";
import NutritionDashboard from "@/components/nutrition/NutritionDashboard";
import NutritionTable from "@/components/nutrition/NutritionTable";
import NutritionRepairPanel from "@/components/nutrition/NutritionRepairPanel";
import NutritionInsights from "@/components/nutrition/NutritionInsights";
import NutritionCharts from "@/components/nutrition/NutritionCharts";
import { useToast } from "@/components/ui/use-toast";

const TABS = [
  { id: "table", label: "Tabla Nutricional" },
  { id: "evolution", label: "Evolución por Jugador" },
  { id: "charts", label: "Gráficos" },
  { id: "alerts", label: "Alertas" },
  { id: "unlinked", label: "Jugadores sin vincular" },
];

export default function Nutrition() {
  const [assessments, setAssessments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [syncState, setSyncState] = useState(null);
  const [activeTab, setActiveTab] = useState("table");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    const [rows, playerRows, syncRows] = await Promise.all([
      base44.entities.NutritionAssessment.list("-fecha", 3000),
      base44.entities.Player.list("full_name", 3000),
      base44.entities.NutritionSyncState.list("-updated_date", 5),
    ]);
    setAssessments(rows);
    setPlayers(playerRows);
    setSyncState(syncRows[0] || null);
    setLoading(false);
  }

  async function sync() {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("syncNutritionFromSheet", {});
      toast({ title: `Nutrición sincronizada: ${res.data?.created || 0} nuevas, ${res.data?.updated || 0} actualizadas` });
      await load();
    } catch (e) {
      toast({ title: "Error al sincronizar nutrición", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => { load(); }, []);

  const lastSync = syncState?.last_synced_at ? moment(syncState.last_synced_at).format("DD/MM/YYYY HH:mm") : "Sin sincronizar";
  const unlinkedCount = useMemo(() => assessments.filter(a => !a.linked || !a.player_id).length, [assessments]);

  if (loading) return <div className="flex justify-center py-16"><div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="bg-slate-50 text-slate-900 rounded-2xl p-5 md:p-6 shadow-2xl shadow-black/20 min-h-[calc(100vh-64px)]">
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nutrición</h1>
          <p className="text-sm text-slate-500 mt-1">Seguimiento y análisis antropométrico</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={sync} disabled={syncing} className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg shadow-sm">
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} /> {syncing ? "Sincronizando..." : "Sincronizar Nutrición"}
          </button>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span>Última sincronización:<br /><b className="text-slate-700">{lastSync}</b></span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
        </div>
      </div>

      <NutritionDashboard assessments={assessments} playerCount={players.length} />

      <div className="flex gap-7 border-b border-slate-200 mt-5 mb-4 overflow-x-auto">
        {TABS.map(tab => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-3 text-sm whitespace-nowrap border-b-2 transition-colors ${activeTab === tab.id ? "border-emerald-600 text-emerald-700 font-semibold" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab.label}{tab.id === "unlinked" && unlinkedCount > 0 ? ` (${unlinkedCount})` : ""}</button>)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4">
        <div className="space-y-4">
          {activeTab === "table" && <NutritionTable assessments={assessments} players={players} onReload={load} />}
          {(activeTab === "evolution" || activeTab === "charts") && <NutritionCharts assessments={assessments} players={players} mode={activeTab} />}
          {activeTab === "alerts" && <NutritionInsights assessments={assessments} players={players} syncState={syncState} detailed />}
          {activeTab === "unlinked" && <NutritionRepairPanel assessments={assessments} players={players} onReload={load} />}
        </div>
        <NutritionInsights assessments={assessments} players={players} syncState={syncState} />
      </div>
    </div>
  );
}