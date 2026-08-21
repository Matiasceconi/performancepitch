import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, FileText, Save, Download, Send, ChevronRight, Check, Search, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { loadPlayerMatchGpsOptions, buildMatchReportData, REPORT_METRICS } from "@/lib/matchReportData";
import { exportMatchReportPdf } from "@/lib/reports/matchReportPdf";
import MatchReportPreview from "./MatchReportPreview";

export default function MatchReportBuilder({ embedded, onClose, onSaved }) {
  const { activeSquad, squads, activeSeasonId } = useWorkspace();
  const [step, setStep] = useState(1); // 1=squad/player, 2=matches, 3=preview
  const [selectedSquadId, setSelectedSquadId] = useState(activeSquad?.id || "");
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [matchOptions, setMatchOptions] = useState([]);
  const [selectedMatchIds, setSelectedMatchIds] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [staffComment, setStaffComment] = useState("");
  const [evolutionMetricKey, setEvolutionMetricKey] = useState("total_distance");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [savedReportId, setSavedReportId] = useState(null);

  useEffect(() => {
    if (!selectedSquadId) return;
    base44.entities.Player.filter({ squad_id: selectedSquadId }, "-full_name", 500)
      .then((rows) => setPlayers(rows.filter((p) => p.active !== false)))
      .catch(() => setPlayers([]));
  }, [selectedSquadId]);

  // Cargar partidos con GPS al seleccionar jugador
  useEffect(() => {
    if (!selectedPlayerId || !selectedSquadId) return;
    setLoadingOptions(true);
    setSelectedMatchIds([]);
    loadPlayerMatchGpsOptions({ playerId: selectedPlayerId, squadId: selectedSquadId, seasonId: activeSeasonId })
      .then((opts) => setMatchOptions(opts))
      .catch(() => setMatchOptions([]))
      .finally(() => setLoadingOptions(false));
  }, [selectedPlayerId, selectedSquadId, activeSeasonId]);

  const selectedPlayer = useMemo(() => players.find((p) => p.id === selectedPlayerId), [players, selectedPlayerId]);

  const toggleMatch = (matchId) => {
    setSelectedMatchIds((prev) => prev.includes(matchId) ? prev.filter((id) => id !== matchId) : [...prev, matchId]);
  };

  const goToPreview = useCallback(async () => {
    setLoadingReport(true);
    try {
      const data = await buildMatchReportData({ playerId: selectedPlayerId, matchIds: selectedMatchIds });
      setReportData(data);
      setStep(3);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReport(false);
    }
  }, [selectedPlayerId, selectedMatchIds]);

  const buildTitle = () => {
    if (!reportData) return "Informe";
    const name = reportData.player?.full_name || "Jugador";
    if (reportData.isMulti) return `Informe Individual · Últimos ${reportData.selected.length} partidos`;
    const m = reportData.selected[0]?.match;
    return `Informe Individual · DyJ vs ${m?.rival || "Rival"} · ${m?.date || ""}`;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const payload = {
        title: buildTitle(),
        report_type: reportData.isMulti ? "multi_match" : "single_match",
        status: "draft",
        player_id: selectedPlayerId,
        player_name: reportData.player?.full_name,
        squad_id: selectedSquadId,
        squad_name: squads.find((s) => s.id === selectedSquadId)?.name || "",
        season_id: activeSeasonId || "",
        match_ids: selectedMatchIds,
        match_labels: reportData.selected.map((s) => `vs ${s.match.rival} (${s.match.date})`),
        match_dates: reportData.selected.map((s) => s.match.date),
        staff_comment: staffComment,
      };
      const record = await base44.entities.PlayerMatchReport.create(payload);
      setSavedReportId(record.id);
      onSaved?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      const payload = {
        title: buildTitle(),
        report_type: reportData.isMulti ? "multi_match" : "single_match",
        status: "published",
        player_id: selectedPlayerId,
        player_name: reportData.player?.full_name,
        squad_id: selectedSquadId,
        squad_name: squads.find((s) => s.id === selectedSquadId)?.name || "",
        season_id: activeSeasonId || "",
        match_ids: selectedMatchIds,
        match_labels: reportData.selected.map((s) => `vs ${s.match.rival} (${s.match.date})`),
        match_dates: reportData.selected.map((s) => s.match.date),
        staff_comment: staffComment,
        published_at: new Date().toISOString(),
      };
      let record;
      if (savedReportId) {
        record = await base44.entities.PlayerMatchReport.update(savedReportId, { ...payload, status: "published", published_at: new Date().toISOString() });
      } else {
        record = await base44.entities.PlayerMatchReport.create(payload);
        setSavedReportId(record.id);
      }
      onSaved?.();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      await exportMatchReportPdf({ reportData, reportMeta: { title: buildTitle() }, staffComment, evolutionMetricKey });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const filteredPlayers = search
    ? players.filter((p) => (p.full_name || "").toLowerCase().includes(search.toLowerCase()))
    : players;

  const content = (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs">
        {["Jugador", "Partidos", "Vista previa"].map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <React.Fragment key={label}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold ${active ? "bg-emerald-500 text-white" : done ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${active ? "bg-white/20" : done ? "bg-emerald-500 text-white" : "bg-zinc-700"}`}>{done ? <Check size={11} /> : n}</span>
                {label}
              </div>
              {i < 2 && <ChevronRight size={14} className="text-zinc-600" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step 1: Plantel + Jugador */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 block mb-1.5">Plantel</label>
            <select value={selectedSquadId} onChange={(e) => { setSelectedSquadId(e.target.value); setSelectedPlayerId(""); }} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white">
              <option value="">Seleccionar plantel</option>
              {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {selectedSquadId && (
            <div>
              <label className="text-xs text-zinc-500 block mb-1.5">Jugador</label>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {filteredPlayers.map((p) => (
                  <button key={p.id} onClick={() => setSelectedPlayerId(p.id)} className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${selectedPlayerId === p.id ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
                    <PlayerPhoto player={p} className="w-10 h-10 rounded-lg object-cover border border-zinc-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium truncate">{p.full_name}</p>
                      <p className="text-xs text-zinc-500">{p.position} {p.jersey_number ? `· #${p.jersey_number}` : ""}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={() => setStep(2)} disabled={!selectedPlayerId} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">Continuar <ChevronRight size={15} /></button>
          </div>
        </div>
      )}

      {/* Step 2: Partidos */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-semibold">{selectedPlayer?.full_name}</p>
              <p className="text-xs text-zinc-500">Seleccioná uno o varios partidos con GPS disponible</p>
            </div>
            <button onClick={() => setStep(1)} className="text-xs text-zinc-400 hover:text-white">Cambiar jugador</button>
          </div>
          {loadingOptions ? (
            <div className="py-12 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>
          ) : matchOptions.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">No hay partidos con GPS cargado para este jugador.</div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {matchOptions.map((opt) => {
                const checked = selectedMatchIds.includes(opt.match.id);
                return (
                  <label key={opt.match.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleMatch(opt.match.id)} className="accent-emerald-500 w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">vs {opt.match.rival || "Rival"}</p>
                      <p className="text-xs text-zinc-500">{opt.match.date ? new Date(opt.match.date + "T00:00:00").toLocaleDateString("es-AR") : "—"} · {opt.match.competition || ""} · {opt.match.location || ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">{opt.gpsRow.total_distance ? Math.round(opt.gpsRow.total_distance).toLocaleString("es-AR") + " m" : "—"}</p>
                      <p className="text-[10px] text-zinc-600">{opt.minutesPlayed != null ? `${opt.minutesPlayed}'` : "GPS ✓"}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm">Volver</button>
            <button onClick={goToPreview} disabled={selectedMatchIds.length === 0 || loadingReport} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
              {loadingReport ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              {selectedMatchIds.length === 1 ? "Ver informe" : `Comparar ${selectedMatchIds.length} partidos`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Vista previa */}
      {step === 3 && reportData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button onClick={() => setStep(2)} className="text-xs text-zinc-400 hover:text-white">← Cambiar partidos</button>
            <div className="flex items-center gap-2">
              <button onClick={handleSaveDraft} disabled={saving} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Guardar borrador
              </button>
              <button onClick={handleDownloadPdf} disabled={exporting} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50">
                {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Descargar PDF
              </button>
              <button onClick={handlePublish} disabled={saving} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Publicar para jugador
              </button>
            </div>
          </div>
          {savedReportId && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              <Check size={14} /> Informe guardado. El jugador lo verá en su portal cuando esté publicado.
            </div>
          )}
          <MatchReportPreview
            reportData={reportData}
            staffComment={staffComment}
            onCommentChange={setStaffComment}
            evolutionMetricKey={evolutionMetricKey}
            onEvolutionMetricChange={setEvolutionMetricKey}
          />
        </div>
      )}
    </div>
  );

  if (embedded) return content;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <FileText size={20} className="text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Reporte individual de partido</h2>
              <p className="text-xs text-zinc-500">GPS del partido → Análisis individual → Reporte → Jugador</p>
            </div>
          </div>
          {onClose && <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>}
        </div>
        <div className="p-5">{content}</div>
      </div>
    </div>
  );
}