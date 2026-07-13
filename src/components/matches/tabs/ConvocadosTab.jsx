import React, { useEffect, useMemo, useRef, useState } from "react";
import moment from "moment";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { AlertTriangle, Download, FileText, LayoutGrid, List, RefreshCw, Save, Search, Sparkles, Upload, Users } from "lucide-react";

import { base44 } from "@/api/base44Client";
import TransparentPlayerPhoto from "@/components/player/PlayerPhoto";
import { useToast } from "@/components/ui/use-toast";
import { buildNameVariants, getPlayerName, getPlayerNumber, getPositionGroup, isUnavailableStatus, loadMatchCallupState, normalizeText, saveMatchCallups } from "@/lib/matchCallupUtils";

const GROUPS = ["Arquero", "Defensor", "Mediocampista", "Delantero", "Sin categoría"];
const EXPORT_SIZES = {
  whatsapp: { label: "WhatsApp 1080x1350", width: 1080, height: 1350 },
  story: { label: "Story 1080x1920", width: 1080, height: 1920 },
};

function getStatusClass(status) {
  const normalized = normalizeText(status);
  if (normalized.includes("lesion")) return "bg-red-500/15 text-red-300 border-red-500/30";
  if (normalized.includes("no disponible") || normalized.includes("suspend")) return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (normalized.includes("dispon")) return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  return "bg-zinc-800 text-zinc-300 border-zinc-700";
}

function downloadBlob(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export default function ConvocadosTab({ match, players = [], onMatchUpdated, onRegisterSave, onCallupsUpdated }) {
  const { toast } = useToast();
  const previewRef = useRef(null);
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [savedCallups, setSavedCallups] = useState([]);
  const [allCallups, setAllCallups] = useState([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingCallups, setLoadingCallups] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [positionFilter, setPositionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [linkedMinutes, setLinkedMinutes] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState("whatsapp");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSummary, setImportSummary] = useState(null);

  async function reload() {
    setLoadingPlayers(true);
    setLoadingCallups(true);
    setLoadError("");
    try {
      const [state, minutesRows] = await Promise.all([
        loadMatchCallupState(match, players),
        base44.entities.MinutesRecord.filter({ match_id: match.id }, "-created_date", 300).catch(() => []),
      ]);
      setAvailablePlayers(state.availablePlayers);
      setSavedCallups(state.savedCallups);
      setAllCallups(state.allCallups);
      setSelectedPlayerIds(state.selectedPlayerIds);
      setLinkedMinutes(minutesRows || []);
      setDirty(false);
    } catch (error) {
      setLoadError(error.message || "No se pudo cargar la convocatoria");
    } finally {
      setLoadingPlayers(false);
      setLoadingCallups(false);
    }
  }

  useEffect(() => { reload(); }, [match.id, match.squad_id]);

  const visiblePlayers = useMemo(() => availablePlayers.filter((player) => {
    const name = normalizeText(getPlayerName(player));
    const status = normalizeText(player.status || "sin estado");
    const position = getPositionGroup(player.position);
    if (search && !name.includes(normalizeText(search))) return false;
    if (positionFilter !== "all" && position !== positionFilter) return false;
    if (statusFilter !== "all" && status !== statusFilter) return false;
    return true;
  }), [availablePlayers, positionFilter, search, statusFilter]);

  const groupedPlayers = useMemo(() => {
    const groups = Object.fromEntries(GROUPS.map((group) => [group, []]));
    visiblePlayers.forEach((player) => groups[getPositionGroup(player.position)].push(player));
    return groups;
  }, [visiblePlayers]);

  const selectedSet = useMemo(() => new Set(selectedPlayerIds), [selectedPlayerIds]);
  const selectedPlayers = useMemo(() => availablePlayers.filter((player) => selectedSet.has(player.id)), [availablePlayers, selectedSet]);
  const linkedPlayersMap = useMemo(() => Object.fromEntries(linkedMinutes.map((row) => [row.player_id, row])), [linkedMinutes]);
  const distinctStatuses = useMemo(() => Array.from(new Set(availablePlayers.map((player) => normalizeText(player.status || "sin estado")))).filter(Boolean), [availablePlayers]);

  async function saveConvocados() {
    if (saving) return;
    const removedWithMinutes = savedCallups.filter((callup) => !selectedSet.has(callup.player_id) && linkedPlayersMap[callup.player_id]);
    if (removedWithMinutes.length) {
      const confirmed = window.confirm(`Vas a quitar ${removedWithMinutes.length} jugador(es) que ya tienen minutos cargados. Los minutos se conservarán, pero dejarán de verse como convocados. ¿Confirmás?`);
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const state = await saveMatchCallups({ match, selectedPlayerIds, availablePlayers, allCallups });
      setAvailablePlayers(state.availablePlayers);
      setSavedCallups(state.savedCallups);
      setAllCallups(state.allCallups);
      setSelectedPlayerIds(state.selectedPlayerIds);
      setDirty(false);
      onMatchUpdated?.({ squad_called: state.selectedPlayerIds, squad_names: state.selectedPlayerIds.map((id) => getPlayerName(state.playerMap.get(id))).filter(Boolean) });
      onCallupsUpdated?.();
      toast({ title: `Convocatoria guardada correctamente: ${state.selectedPlayerIds.length} jugadores` });
    } catch (error) {
      toast({ title: error.message || "No se pudo guardar la convocatoria", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    onRegisterSave?.({ action: saveConvocados, disabled: !dirty || saving, pending: dirty, label: "convocados" });
  }, [dirty, onRegisterSave, saving, selectedPlayerIds, allCallups, availablePlayers]);

  function togglePlayer(player) {
    const alreadySelected = selectedSet.has(player.id);
    if (!alreadySelected && isUnavailableStatus(player.status)) {
      const confirmed = window.confirm(`⚠️ ${getPlayerName(player)} figura como "${player.status || "no disponible"}". ¿Querés convocarlo igualmente?`);
      if (!confirmed) return;
    }
    setSelectedPlayerIds((current) => alreadySelected ? current.filter((id) => id !== player.id) : [...current, player.id]);
    setDirty(true);
  }

  function selectAvailable() {
    setSelectedPlayerIds(availablePlayers.filter((player) => !isUnavailableStatus(player.status)).map((player) => player.id));
    setDirty(true);
  }

  function loadImportFile(file) {
    const reader = new FileReader();
    reader.onload = () => setImportText(String(reader.result || ""));
    reader.readAsText(file);
  }

  function applyAiImport() {
    const normalizedText = normalizeText(importText);
    if (!normalizedText) return toast({ title: "Pegá o cargá un texto para importar", variant: "destructive" });
    const detected = new Set();
    availablePlayers.forEach((player) => {
      if (buildNameVariants(player).some((variant) => variant && normalizedText.includes(variant))) detected.add(player.id);
    });
    if (!detected.size) return toast({ title: "No se detectaron jugadores en el texto", variant: "destructive" });
    setSelectedPlayerIds(Array.from(detected));
    setDirty(true);
    setImportSummary({ convocados: detected.size });
    toast({ title: `Importación aplicada: ${detected.size} convocados detectados` });
  }

  async function exportImage() {
    if (!previewRef.current) return;
    const size = EXPORT_SIZES[exportFormat];
    const canvas = await html2canvas(previewRef.current, { backgroundColor: "#09090b", scale: 2, useCORS: true });
    const output = document.createElement("canvas");
    output.width = size.width;
    output.height = size.height;
    const ctx = output.getContext("2d");
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, output.width, output.height);
    const ratio = Math.min(output.width / canvas.width, output.height / canvas.height);
    ctx.drawImage(canvas, (output.width - canvas.width * ratio) / 2, (output.height - canvas.height * ratio) / 2, canvas.width * ratio, canvas.height * ratio);
    downloadBlob(output.toDataURL("image/png"), `convocatoria-${match.rival || "partido"}-${exportFormat}.png`);
  }

  async function exportPdf() {
    if (!previewRef.current) return;
    const canvas = await html2canvas(previewRef.current, { backgroundColor: "#09090b", scale: 2, useCORS: true });
    const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width, canvas.height] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width, canvas.height);
    pdf.save(`convocatoria-${match.rival || "partido"}.pdf`);
  }

  const countByGroup = useMemo(() => {
    const base = Object.fromEntries(GROUPS.map((group) => [group, []]));
    selectedPlayers.forEach((player) => base[getPositionGroup(player.position)].push(player));
    return base;
  }, [selectedPlayers]);

  if (loadError) return <StateCard title="No se pudo cargar la convocatoria" description={loadError} action={<button onClick={reload} className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-zinc-950"><RefreshCw size={14} className="mr-1 inline" /> Reintentar</button>} />;
  if (loadingPlayers) return <StateCard title="Cargando jugadores…" />;
  if (loadingCallups) return <StateCard title="Cargando convocatoria…" />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Users size={16} className="text-yellow-400" /> Convocatoria del partido</h2>
            <p className="mt-1 text-xs text-zinc-500">Plantel del partido: {match.squad_name || "sin plantel asignado"}. La convocatoria se guarda por jugador y partido.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={selectAvailable} disabled={saving || !availablePlayers.length} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 transition hover:bg-zinc-700 disabled:opacity-50">Seleccionar disponibles</button>
            <button onClick={() => setImportOpen(true)} disabled={saving} className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"><Sparkles size={13} className="mr-1 inline" /> Importar IA</button>
            <button onClick={() => setExportOpen(true)} disabled={!selectedPlayers.length} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 transition hover:bg-yellow-500/20 disabled:opacity-50"><Download size={13} className="mr-1 inline" /> Exportar convocatoria</button>
            <button onClick={saveConvocados} disabled={!dirty || saving} className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"><Save size={13} className="mr-1 inline" /> {saving ? "Guardando…" : "Guardar"}</button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador" className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-white outline-none transition focus:border-yellow-500" /></div>
            <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-500"><option value="all">Todas las posiciones</option>{GROUPS.map((group) => <option key={group} value={group}>{group}</option>)}</select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none transition focus:border-yellow-500"><option value="all">Todos los estados</option>{distinctStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-1"><button onClick={() => setViewMode("cards")} className={`rounded-md px-2 py-1 text-xs transition ${viewMode === "cards" ? "bg-yellow-500 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><LayoutGrid size={14} /></button><button onClick={() => setViewMode("list")} className={`rounded-md px-2 py-1 text-xs transition ${viewMode === "list" ? "bg-yellow-500 text-zinc-950" : "text-zinc-400 hover:text-white"}`}><List size={14} /></button></div>
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300">{selectedPlayerIds.length} convocados</div>
          </div>
        </div>
      </div>

      {!availablePlayers.length ? <StateCard title="Este plantel todavía no tiene jugadores" description="Asigná jugadores al plantel del partido para poder convocarlos." /> : viewMode === "cards" ? (
        <div className="space-y-4">{Object.entries(groupedPlayers).map(([group, groupPlayers]) => <PlayerGroup key={group} group={group} players={groupPlayers} selectedSet={selectedSet} onToggle={togglePlayer} />)}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
          <div className="grid grid-cols-[52px_1.4fr_1fr_80px_150px] gap-3 border-b border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500"><span /><span>Jugador</span><span>Posición</span><span>N°</span><span>Estado</span></div>
          {visiblePlayers.length === 0 ? <div className="px-4 py-8 text-center text-sm text-zinc-500">Todavía no seleccionaste convocados o el filtro no tiene resultados.</div> : visiblePlayers.map((player) => <PlayerListRow key={player.id} player={player} checked={selectedSet.has(player.id)} onToggle={() => togglePlayer(player)} />)}
        </div>
      )}

      {exportOpen && <ExportModal match={match} exportFormat={exportFormat} setExportFormat={setExportFormat} onClose={() => setExportOpen(false)} onExportImage={exportImage} onExportPdf={exportPdf} previewRef={previewRef} countByGroup={countByGroup} />}
      {importOpen && <ImportModal importText={importText} setImportText={setImportText} loadImportFile={loadImportFile} importSummary={importSummary} onClose={() => setImportOpen(false)} onApply={applyAiImport} />}
    </div>
  );
}

function StateCard({ title, description, action }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center"><h2 className="text-lg font-semibold text-white">{title}</h2>{description && <p className="mt-2 text-sm text-zinc-500">{description}</p>}{action && <div className="mt-4">{action}</div>}</div>;
}

function PlayerGroup({ group, players, selectedSet, onToggle }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{group}</h3><span className="text-xs text-zinc-500">{players.length} jugadores</span></div>{players.length === 0 ? <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">Sin jugadores en esta categoría.</div> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">{players.map((player) => <PlayerCard key={player.id} player={player} checked={selectedSet.has(player.id)} onToggle={() => onToggle(player)} />)}</div>}</div>;
}

function PlayerCard({ player, checked, onToggle }) {
  return <button onClick={onToggle} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? "border-yellow-500/40 bg-yellow-500/10" : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900"}`}><input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-yellow-500" /><TransparentPlayerPhoto player={player} className="h-12 w-12 rounded-full border border-zinc-700 object-cover" fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800" textClassName="text-sm font-bold text-zinc-400" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="truncate text-sm font-semibold text-white">{getPlayerName(player)}</p><p className="text-xs text-zinc-500">{player.position || "Sin posición"}</p></div><div className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-300">#{getPlayerNumber(player)}</div></div><span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[11px] ${getStatusClass(player.status)}`}>{player.status || "Sin estado"}</span>{isUnavailableStatus(player.status) && <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-orange-300"><AlertTriangle size={11} /> advertencia</span>}</div></button>;
}

function PlayerListRow({ player, checked, onToggle }) {
  return <button onClick={onToggle} className={`grid w-full grid-cols-[52px_1.4fr_1fr_80px_150px] items-center gap-3 border-b border-zinc-800 px-4 py-3 text-left transition last:border-b-0 ${checked ? "bg-yellow-500/10" : "hover:bg-zinc-950/50"}`}><input type="checkbox" checked={checked} readOnly className="h-4 w-4 accent-yellow-500" /><div className="flex min-w-0 items-center gap-3"><TransparentPlayerPhoto player={player} className="h-10 w-10 rounded-full border border-zinc-700 object-cover" fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800" textClassName="text-xs font-bold text-zinc-400" /><span className="truncate text-sm font-medium text-white">{getPlayerName(player)}</span></div><span className="text-sm text-zinc-400">{player.position || "—"}</span><span className="text-sm text-zinc-300">#{getPlayerNumber(player)}</span><span className={`inline-flex w-fit rounded-full border px-2 py-1 text-[11px] ${getStatusClass(player.status)}`}>{player.status || "Sin estado"}</span></button>;
}

function ExportModal({ match, exportFormat, setExportFormat, onClose, onExportImage, onExportPdf, previewRef, countByGroup }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl shadow-black/40"><div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><h3 className="text-lg font-semibold text-white">Previsualización de convocatoria</h3><p className="text-sm text-zinc-500">Exportá en formato WhatsApp, Story o PDF.</p></div><div className="flex flex-wrap gap-2">{Object.entries(EXPORT_SIZES).map(([key, option]) => <button key={key} onClick={() => setExportFormat(key)} className={`rounded-lg px-3 py-2 text-xs transition ${exportFormat === key ? "bg-yellow-500 text-zinc-950" : "border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"}`}>{option.label}</button>)}<button onClick={onExportImage} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 transition hover:bg-yellow-500/20">Descargar imagen</button><button onClick={onExportPdf} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"><FileText size={13} className="mr-1 inline" /> PDF</button><button onClick={onClose} className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800">Cerrar</button></div></div><div className="overflow-auto rounded-2xl border border-zinc-800 bg-black/30 p-4"><div ref={previewRef} className={`mx-auto overflow-hidden rounded-[28px] border border-yellow-500/20 bg-zinc-950 shadow-2xl shadow-black/50 ${exportFormat === "story" ? "w-[360px] min-h-[640px]" : "w-[360px] min-h-[450px]"}`}><div className="border-b border-zinc-800 bg-gradient-to-br from-yellow-500/20 via-zinc-950 to-zinc-950 px-6 py-6"><p className="text-[11px] uppercase tracking-[0.3em] text-yellow-300">PerformancePitch</p><h4 className="mt-2 text-2xl font-black text-white">Convocatoria oficial</h4><div className="mt-4 flex flex-wrap gap-2 text-[11px] text-zinc-300"><span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1">vs {match.rival}</span><span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1">{moment(match.date).format("DD/MM/YYYY")}</span>{match.squad_name && <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1">{match.squad_name}</span>}</div></div><div className="space-y-4 px-6 py-6">{Object.entries(countByGroup).filter(([, players]) => players.length > 0).map(([group, players]) => <div key={group} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold text-white">{group}</p><span className="text-xs text-zinc-500">{players.length}</span></div><div className="grid grid-cols-2 gap-2 text-sm text-zinc-200">{players.map((player) => <div key={player.id} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2"><span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10 text-xs font-black text-yellow-300">{getPlayerNumber(player)}</span><span className="truncate">{getPlayerName(player)}</span></div>)}</div></div>)}</div></div></div></div></div>;
}

function ImportModal({ importText, setImportText, loadImportFile, importSummary, onClose, onApply }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"><div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl shadow-black/40"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-semibold text-white">Importar convocatoria con IA</h3><p className="text-sm text-zinc-500">Pegá el texto o subí un archivo para buscar jugadores por nombre.</p></div><button onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-900">Cerrar</button></div><div className="space-y-3"><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800"><Upload size={13} /> Cargar archivo<input type="file" accept=".txt,.csv,.md,.doc,.docx" className="hidden" onChange={(e) => e.target.files?.[0] && loadImportFile(e.target.files[0])} /></label><textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={12} className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-sm text-white outline-none transition focus:border-yellow-500" />{importSummary && <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">Detectados: {importSummary.convocados} convocados.</div>}<div className="flex justify-end gap-2"><button onClick={onClose} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900">Cancelar</button><button onClick={onApply} className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-yellow-400">Aplicar importación</button></div></div></div></div>;
}