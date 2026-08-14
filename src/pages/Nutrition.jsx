import React, { useCallback, useEffect, useMemo, useState } from "react";
import moment from "moment";
import { CheckCircle2, Clock3, FileSpreadsheet, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import NutritionDashboard from "@/components/nutrition/NutritionDashboard";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { useToast } from "@/components/ui/use-toast";

const SOURCE_FILE_ID = "1tiZoeF9KjPyvntjBreRSsUhRsh1huMjm";

export default function Nutrition() {
  const [assessments, setAssessments] = useState([]);
  const [interpretations, setInterpretations] = useState([]);
  const [players, setPlayers] = useState([]);
  const [syncState, setSyncState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const { activeSquad, activeSeasonId } = useWorkspace();
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!activeSquad?.id) {
      setPlayers([]);
      setAssessments([]);
      setInterpretations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [assessmentRows, interpretationRows, playerRows, membershipRows, syncRows] = await Promise.all([
        base44.entities.NutritionAssessment.list("-fecha", 5000),
        base44.entities.NutritionInterpretation.list("-fecha", 5000),
        base44.entities.Player.list("full_name", 5000),
        base44.entities.SquadMembership.filter({ squad_id: activeSquad.id, status: "activo" }, "-effective_from", 1000),
        base44.entities.NutritionSyncState.filter({ source_file_id: SOURCE_FILE_ID }, "-updated_date", 5),
      ]);
      const rosterIds = new Set(membershipRows.filter((membership) => !membership.effective_to).map((membership) => membership.player_id));
      playerRows.forEach((player) => {
        if (player.squad_id === activeSquad.id && player.active !== false) rosterIds.add(player.id);
      });
      const rosterPlayers = playerRows.filter((player) => rosterIds.has(player.id) && player.active !== false);
      setPlayers(rosterPlayers);
      setAssessments(assessmentRows.filter((row) => rosterIds.has(row.player_id) && (!row.squad_id || row.squad_id === activeSquad.id)));
      setInterpretations(interpretationRows.filter((row) => rosterIds.has(row.player_id) && (!row.squad_id || row.squad_id === activeSquad.id)));
      setSyncState(syncRows[0] || null);
    } catch (error) {
      toast({ title: "No se pudo cargar Nutrición", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [activeSquad?.id, toast]);

  useEffect(() => { load(); }, [load, activeSeasonId]);

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await base44.functions.invoke("syncNutritionFromSheet", { force: true });
      const result = response.data || response;
      if (result?.success === false) throw new Error(result.error || "La sincronización no pudo completarse");
      await load();
      const unresolved = (result?.unresolved_assessments || 0) + (result?.unresolved_interpretations || 0);
      toast({
        title: "Nutrición actualizada",
        description: unresolved ? `${result.rows_read || 0} mediciones procesadas · ${unresolved} sin vincular` : `${result.rows_read || 0} mediciones procesadas desde Antros grupales.xlsx`,
      });
    } catch (error) {
      toast({ title: "Error de sincronización", description: error.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  const syncLabel = syncState?.last_synced_at ? moment(syncState.last_synced_at).format("DD/MM/YYYY HH:mm") : "Pendiente";
  const nextSyncLabel = syncState?.next_sync_at ? moment(syncState.next_sync_at).format("HH:mm") : "cada 60 min";
  const unresolvedCount = useMemo(() => {
    const result = syncState?.last_sync_result || {};
    return (result.unresolved_assessments || 0) + (result.unresolved_interpretations || 0);
  }, [syncState]);

  if (loading) {
    return <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-zinc-950"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400" /></div>;
  }

  return (
    <div className="min-h-[calc(100vh-64px)] space-y-5 bg-zinc-950 p-4 text-white md:p-6">
      <header className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-5 md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-300"><FileSpreadsheet size={18} /><span className="text-xs font-semibold uppercase tracking-[0.18em]">Control antropométrico</span></div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Nutrición · {activeSquad?.name || "Plantel"}</h1>
            <p className="mt-1 text-sm text-zinc-500">Informe de lectura, pliegues y peso del plantel activo {activeSeasonId ? `· Temporada ${activeSeasonId}` : ""}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2"><p className="flex items-center gap-1.5 text-zinc-600"><CheckCircle2 size={13} className="text-emerald-400" />Última actualización</p><p className="mt-1 font-semibold text-zinc-300">{syncLabel}</p></div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2"><p className="flex items-center gap-1.5 text-zinc-600"><Clock3 size={13} className="text-blue-400" />Próxima revisión</p><p className="mt-1 font-semibold text-zinc-300">{nextSyncLabel}</p></div>
            </div>
            <button onClick={handleSync} disabled={syncing} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"><RefreshCw size={16} className={syncing ? "animate-spin" : ""} />{syncing ? "Actualizando..." : "Actualizar ahora"}</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">Fuente: Antros grupales.xlsx</span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">Sincronización automática cada hora</span>
          <span className="rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5">Solo jugadores del plantel activo</span>
          {unresolvedCount > 0 && <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-300">{unresolvedCount} registro{unresolvedCount === 1 ? "" : "s"} sin vincular</span>}
        </div>
      </header>

      <NutritionDashboard players={players} assessments={assessments} interpretations={interpretations} activeSquad={activeSquad} />
    </div>
  );
}
