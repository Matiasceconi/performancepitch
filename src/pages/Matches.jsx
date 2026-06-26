import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronDown, ChevronUp, Edit2, Trash2, Youtube, Users, FileText, X, Check, Upload, FileSpreadsheet, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

// ── Match CSV Panel ───────────────────────────────────────────────────────────
function MatchCsvPanel({ match, onCsvSaved }) {
  const [csvUrl, setCsvUrl] = useState(match.csv_url || null);
  const [csvLabel, setCsvLabel] = useState(match.csv_label || null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.MatchReport.update(match.id, { csv_url: file_url, csv_label: file.name });
      setCsvUrl(file_url);
      setCsvLabel(file.name);
      onCsvSaved?.(file_url, file.name);
      toast({ title: "CSV cargado correctamente" });
    } catch {
      toast({ title: "Error al cargar el CSV", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function removeCsv() {
    await base44.entities.MatchReport.update(match.id, { csv_url: null, csv_label: null });
    setCsvUrl(null);
    setCsvLabel(null);
    onCsvSaved?.(null, null);
    toast({ title: "CSV eliminado" });
  }

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2"><FileSpreadsheet size={14} className="text-green-400" /> Datos GPS del partido</p>
          <p className="text-xs text-zinc-500 mt-0.5">CSV Catapult del partido</p>
        </div>
        {csvUrl && (
          <div className="flex items-center gap-2">
            <a href={csvUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white p-1.5 rounded hover:bg-zinc-700 transition-colors"><ExternalLink size={13} /></a>
            <button onClick={removeCsv} className="text-zinc-600 hover:text-red-400 p-1.5 rounded hover:bg-zinc-700 transition-colors"><X size={13} /></button>
          </div>
        )}
      </div>
      {!csvUrl ? (
        <label className="cursor-pointer block">
          <div className={`flex items-center justify-center gap-2 border border-dashed border-zinc-700 rounded-xl px-4 py-6 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading ? <div className="w-4 h-4 border border-zinc-500 border-t-white rounded-full animate-spin" /> : <Upload size={16} />}
            {uploading ? "Subiendo..." : "Cargar CSV del partido"}
          </div>
          <input type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      ) : (
        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
          <FileSpreadsheet size={13} className="text-green-400 shrink-0" />
          <span className="text-xs text-zinc-300 flex-1 truncate">{csvLabel || "Archivo CSV"}</span>
          <label className="cursor-pointer">
            <span className={`text-xs text-zinc-500 hover:text-white transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? "Subiendo..." : "Reemplazar"}
            </span>
            <input type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      )}
    </div>
  );
}

const EMPTY = {
  date: "", rival: "", competition: "", location: "Local",
  our_score: "", rival_score: "", rival_formation: "",
  rival_notes: "", set_pieces_notes: "",
  video_analysis_url: "", video_set_pieces_url: "", video_extra_url: "",
  squad_called: [], squad_names: [], notes: "",
};

function YoutubeEmbed({ url, label }) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v=|\/v\/|embed\/)([A-Za-z0-9_-]{11})/);
  const id = match?.[1];
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-zinc-400 font-medium">{label}</p>
      {id ? (
        <div className="relative w-full rounded-xl overflow-hidden border border-zinc-700" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${id}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm underline">
          <Youtube size={14} /> Ver video
        </a>
      )}
    </div>
  );
}

function MatchCard({ match, players, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [matchData, setMatchData] = useState(match);
  const hasResult = match.our_score != null && match.rival_score != null;
  const won = match.our_score > match.rival_score;
  const drew = match.our_score === match.rival_score;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-center min-w-[40px]">
            <p className="text-zinc-500 text-xs">{moment(match.date).format("DD/MM")}</p>
            <p className="text-zinc-600 text-xs">{moment(match.date).format("YY")}</p>
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm">vs. {match.rival}</p>
            <p className="text-zinc-500 text-xs mt-0.5">
              {match.competition && <span>{match.competition} · </span>}
              <span className={match.location === "Local" ? "text-green-500" : "text-orange-400"}>{match.location}</span>
              {match.rival_formation && <span className="text-zinc-600"> · {match.rival_formation}</span>}
            </p>
          </div>
          {hasResult && (
            <span className={`text-sm font-bold px-2.5 py-1 rounded-lg ${won ? "bg-green-900/40 text-green-400" : drew ? "bg-zinc-700 text-zinc-300" : "bg-red-900/40 text-red-400"}`}>
              {match.our_score} - {match.rival_score}
            </span>
          )}
          <div className="flex gap-2 ml-1">
            {match.video_analysis_url && <span className="text-red-500" title="Video análisis"><Youtube size={14} /></span>}
            {match.squad_names?.length > 0 && <span className="text-zinc-400 text-xs flex items-center gap-1"><Users size={12} />{match.squad_names.length}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button onClick={(e) => { e.stopPropagation(); onEdit(match); }} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"><Edit2 size={13} /></button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(match.id); }} className="p-1.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-5">
          {/* Análisis del rival */}
          {match.rival_notes && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5"><FileText size={12} /> Análisis del rival</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap bg-zinc-800/40 rounded-lg p-3">{match.rival_notes}</p>
            </div>
          )}

          {/* Pelota parada */}
          {match.set_pieces_notes && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5"><FileText size={12} /> Pelota parada</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap bg-zinc-800/40 rounded-lg p-3">{match.set_pieces_notes}</p>
            </div>
          )}

          {/* Videos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <YoutubeEmbed url={match.video_analysis_url} label="🎥 Análisis del rival" />
            <YoutubeEmbed url={match.video_set_pieces_url} label="⚽ Pelota parada" />
            {match.video_extra_url && <YoutubeEmbed url={match.video_extra_url} label="📹 Video adicional" />}
          </div>

          {/* Convocados */}
          {match.squad_names?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-2 flex items-center gap-1.5"><Users size={12} /> Convocados ({match.squad_names.length})</p>
              <div className="flex flex-wrap gap-2">
                {match.squad_names.map((name, i) => (
                  <span key={i} className="bg-zinc-800 text-zinc-300 text-xs px-2.5 py-1 rounded-lg">{name}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notas generales */}
          {match.notes && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1">Notas generales</p>
              <p className="text-zinc-400 text-sm">{match.notes}</p>
            </div>
          )}

          {/* CSV GPS del partido */}
          <MatchCsvPanel match={matchData} onCsvSaved={(url, label) => setMatchData((m) => ({ ...m, csv_url: url, csv_label: label }))} />
        </div>
      )}
    </div>
  );
}

function MatchForm({ initial, players, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function togglePlayer(player) {
    const already = form.squad_called.includes(player.id);
    const newIds = already ? form.squad_called.filter((id) => id !== player.id) : [...form.squad_called, player.id];
    const newNames = already ? form.squad_names.filter((n) => n !== player.name) : [...form.squad_names, player.name];
    setForm((f) => ({ ...f, squad_called: newIds, squad_names: newNames }));
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
      <p className="text-white font-semibold">{initial?.id ? "Editar partido" : "Nuevo partido"}</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Rival *</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Nombre del rival" value={form.rival} onChange={(e) => set("rival", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
          <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Competencia</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Liga Profesional, Copa..." value={form.competition} onChange={(e) => set("competition", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Condición</label>
          <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.location} onChange={(e) => set("location", e.target.value)}>
            <option>Local</option><option>Visitante</option><option>Neutral</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Goles propios</label>
          <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" placeholder="—" value={form.our_score} onChange={(e) => set("our_score", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Goles del rival</label>
          <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" placeholder="—" value={form.rival_score} onChange={(e) => set("rival_score", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Formación del rival</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="4-3-3, 4-4-2..." value={form.rival_formation} onChange={(e) => set("rival_formation", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Análisis del rival</label>
          <textarea rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" placeholder="Descripción del juego, fortalezas, debilidades..." value={form.rival_notes} onChange={(e) => set("rival_notes", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Pelota parada</label>
          <textarea rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" placeholder="Descripción de pelota parada ofensiva/defensiva..." value={form.set_pieces_notes} onChange={(e) => set("set_pieces_notes", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1.5"><Youtube size={12} className="text-red-400" /> Link YouTube — Análisis del rival</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://youtube.com/..." value={form.video_analysis_url} onChange={(e) => set("video_analysis_url", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1.5"><Youtube size={12} className="text-red-400" /> Link — Pelota parada</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://youtube.com/..." value={form.video_set_pieces_url} onChange={(e) => set("video_set_pieces_url", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block flex items-center gap-1.5"><Youtube size={12} className="text-red-400" /> Link — Video adicional</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://youtube.com/..." value={form.video_extra_url} onChange={(e) => set("video_extra_url", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-2 block flex items-center gap-1.5"><Users size={12} /> Convocados</label>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {players.map((p) => {
              const selected = form.squad_called.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlayer(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${selected ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"}`}
                >
                  #{p.number} {p.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Notas generales</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Otras observaciones..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"><X size={14} /> Cancelar</button>
        <button onClick={() => onSave(form)} disabled={!form.rival || !form.date} className="px-4 py-2 rounded-lg text-sm bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold disabled:opacity-40 transition-colors flex items-center gap-1"><Check size={14} /> Guardar</button>
      </div>
    </div>
  );
}

export default function Matches() {
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [m, p] = await Promise.all([
      base44.entities.MatchReport.list("-date", 100),
      base44.entities.Player.list("-created_date", 100),
    ]);
    setMatches(m);
    setPlayers(p.sort((a, b) => (a.number || 0) - (b.number || 0)));
    setLoading(false);
  }

  async function save(form) {
    const data = {
      ...form,
      our_score: form.our_score !== "" ? Number(form.our_score) : null,
      rival_score: form.rival_score !== "" ? Number(form.rival_score) : null,
    };
    if (editing?.id) {
      await base44.entities.MatchReport.update(editing.id, data);
      toast({ title: "Partido actualizado" });
    } else {
      await base44.entities.MatchReport.create(data);
      toast({ title: "Partido guardado" });
    }
    setShowForm(false);
    setEditing(null);
    loadAll();
  }

  async function remove(id) {
    await base44.entities.MatchReport.delete(id);
    toast({ title: "Partido eliminado" });
    loadAll();
  }

  function startEdit(match) {
    setEditing(match);
    setShowForm(true);
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{matches.length} partido{matches.length !== 1 ? "s" : ""} registrado{matches.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Nuevo partido
        </button>
      </div>

      {showForm && (
        <MatchForm
          initial={editing}
          players={players}
          onSave={save}
          onCancel={() => { setShowForm(false); setEditing(null); }}
        />
      )}

      {matches.length === 0 && !showForm ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No hay partidos registrados</p>
          <p className="text-zinc-600 text-xs mt-1">Agregá el análisis del primer partido</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <MatchCard key={m.id} match={m} players={players} onEdit={startEdit} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}