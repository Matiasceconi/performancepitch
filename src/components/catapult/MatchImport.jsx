import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, Check, X, AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import CsvPreviewTable from "@/components/catapult/CsvPreviewTable";

// Reusar parsers del padre pasados como props
function MatchRow({ match, matchReports, onDelete, parseCSVFile }) {
  const [expanded, setExpanded] = useState(false);
  const [csvState, setCsvState] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileRef = useRef();
  const { toast } = useToast();

  const hasData = matchReports.length > 0;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    setCsvState(null);
    setImportResult(null);
    try {
      const text = await file.text();
      const parsed = parseCSVFile(text);
      if (parsed.error) { setCsvState({ error: parsed.error }); return; }
      if (parsed.rows.length === 0) { setCsvState({ error: "No se encontraron jugadores válidos." }); return; }
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCsvState({ ...parsed, file_url });
    } catch (err) {
      setCsvState({ error: "Error al procesar: " + err.message });
    } finally {
      setUploading(false);
    }
  }

  async function confirmImport() {
    if (!csvState?.rows) return;
    setImporting(true);
    try {
      await base44.entities.CatapultReport.deleteMany({ session_id: match.id });
      const records = csvState.rows.map((r) => ({
        ...r,
        date: match.date,
        session_id: match.id,
        session_label: match.label,
        file_url: csvState.file_url,
      }));
      await base44.entities.CatapultReport.bulkCreate(records);
      setImportResult({ count: records.length });
      setCsvState(null);
      toast({ title: `✓ ${records.length} jugadores importados para "${match.label}"` });
    } catch (err) {
      toast({ title: "Error al importar", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm truncate">{match.label}</p>
            <p className="text-zinc-500 text-xs mt-0.5">{moment(match.date).format("DD/MM/YYYY")} · Partido oficial</p>
          </div>
          {hasData && (
            <span className="shrink-0 text-xs bg-red-900/30 text-red-400 border border-red-800/40 px-2 py-0.5 rounded-full">
              {matchReports.length} jugadores
            </span>
          )}
          {importResult?.count && (
            <span className="shrink-0 text-xs bg-blue-900/40 text-blue-400 border border-blue-800/50 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={10} /> {importResult.count} importados
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <label onClick={(e) => e.stopPropagation()} className="cursor-pointer">
            <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${uploading ? "bg-zinc-700 text-zinc-400" : "bg-red-900/40 text-red-300 hover:bg-red-900/60"}`}>
              {uploading ? <div className="w-3 h-3 border border-zinc-500 border-t-white rounded-full animate-spin" /> : <Upload size={12} />}
              {uploading ? "Leyendo..." : hasData ? "Reimportar" : "Cargar GPS"}
            </span>
            <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" disabled={uploading} />
          </label>
          <button onClick={(e) => { e.stopPropagation(); onDelete(match.id); }} className="p-1.5 rounded-lg hover:bg-red-900/30 text-zinc-600 hover:text-red-400 transition-colors" title="Eliminar partido">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800">
          {csvState?.error && (
            <div className="mx-4 my-3 flex items-start gap-2 bg-red-900/20 border border-red-800/40 rounded-lg p-3">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-400/80 text-xs">{csvState.error}</p>
            </div>
          )}
          {csvState && !csvState.error && (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-yellow-300 font-semibold text-sm">{csvState.rows.length} jugadores detectados</p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCsvState(null)} className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"><X size={13} className="mr-1" /> Cancelar</Button>
                  <Button size="sm" onClick={confirmImport} disabled={importing} className="bg-green-600 hover:bg-green-700 text-white">
                    {importing ? <div className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin mr-1.5" /> : <Check size={13} className="mr-1" />}
                    Confirmar
                  </Button>
                </div>
              </div>
              <CsvPreviewTable rows={csvState.rawPreview} />
            </div>
          )}
          {!csvState && matchReports.length > 0 && (
            <div className="p-4">
              <CsvPreviewTable rows={matchReports} />
            </div>
          )}
          {!csvState && matchReports.length === 0 && (
            <div className="p-6 text-center">
              <FileSpreadsheet size={28} className="text-zinc-700 mx-auto mb-2" />
              <p className="text-zinc-600 text-xs">Sin datos GPS. Cargá el CSV de Catapult del partido.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const EMPTY_MATCH = { label: "", date: "", rival: "", location: "" };

export default function MatchImport({ reports, onReportsChange, parseCSVFile }) {
  const [matches, setMatches] = useState(() => {
    try { return JSON.parse(localStorage.getItem("catapult_matches") || "[]"); } catch { return []; }
  });
  const [form, setForm] = useState(EMPTY_MATCH);
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  function saveMatches(list) {
    setMatches(list);
    localStorage.setItem("catapult_matches", JSON.stringify(list));
  }

  function addMatch() {
    if (!form.label || !form.date) return;
    const newMatch = { ...form, id: `match_${Date.now()}` };
    saveMatches([newMatch, ...matches]);
    setForm(EMPTY_MATCH);
    setShowForm(false);
  }

  function deleteMatch(id) {
    saveMatches(matches.filter((m) => m.id !== id));
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">Partidos oficiales</h3>
          <p className="text-zinc-500 text-xs mt-0.5">Cargá el GPS de Catapult por partido</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-red-900/40 border border-red-800/40 text-red-300 hover:bg-red-900/60 rounded-lg text-sm font-medium transition-colors">
          <span className="text-lg leading-none">+</span> Nuevo partido
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-semibold">Registrar partido</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Nombre del partido *</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: vs Boca Juniors" value={form.label} onChange={(e) => set("label", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
              <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Estadio / Lugar</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Ej: Estadio Norberto Tomaghello" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancelar</button>
            <button onClick={addMatch} disabled={!form.label || !form.date} className="px-4 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-40 transition-colors">Guardar</button>
          </div>
        </div>
      )}

      {matches.length === 0 && !showForm ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <FileSpreadsheet size={40} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay partidos registrados</p>
          <p className="text-zinc-600 text-xs mt-1">Agregá un partido para cargar sus datos GPS</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <MatchRow
              key={m.id}
              match={m}
              matchReports={reports.filter((r) => r.session_id === m.id)}
              onDelete={deleteMatch}
              parseCSVFile={parseCSVFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}