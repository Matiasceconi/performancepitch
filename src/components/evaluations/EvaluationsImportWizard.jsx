import React, { useCallback, useMemo, useRef, useState } from "react";
import { Upload, FileCheck2, AlertCircle, CheckCircle2, Loader2, X, Info, Calendar, Scissors, Users, Layers3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { importEvaluations } from "@/lib/evaluationsApi";

const CONTEXTS = ["Pretemporada", "MD+2", "MD-4", "Control semanal", "Retorno al juego", "Evaluación inicial", "Cierre de bloque", ""];

function StatusBadge({ status }) {
  const config = {
    exact_match: ["bg-emerald-500/15 text-emerald-300 border-emerald-500/30", "Vinculado"],
    possible_match: ["bg-yellow-500/15 text-yellow-300 border-yellow-500/30", "Revisar"],
    collision: ["bg-orange-500/15 text-orange-300 border-orange-500/30", "Colisión"],
    no_match: ["bg-red-500/15 text-red-300 border-red-500/30", "Pendiente"],
  };
  const [cls, label] = config[status] || config.no_match;
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}>{label}</span>;
}

function buildGroups(preview, context) {
  return (preview.session_proposals || []).map((proposal) => ({
    group_id: proposal.group_id,
    assessment_date: proposal.assessment_date,
    assessment_time: proposal.assessment_time || "",
    name: proposal.name,
    context: proposal.context || context,
    block_ids: [...proposal.block_ids],
    existing_sessions: proposal.existing_sessions || [],
    append_to_session_id: "",
  }));
}

export default function EvaluationsImportWizard({ onClose, onImported, embedded }) {
  const { activeSquad } = useWorkspace();
  const inputRef = useRef(null);
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState([]);
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sessionGroups, setSessionGroups] = useState([]);
  const [selectedBlocks, setSelectedBlocks] = useState({});
  const [playerOverrides, setPlayerOverrides] = useState({});
  const [rememberAliases, setRememberAliases] = useState(true);
  const [groupingConfirmed, setGroupingConfirmed] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const blockMap = useMemo(() => new Map((preview?.blocks || []).map((block) => [block.block_id, block])), [preview]);
  const unresolved = (preview?.linking_preview || []).filter((link) => link.status !== "exact_match" && !playerOverrides[link.csv_name]).length;

  const handleFiles = useCallback((fileList) => {
    const accepted = [...fileList].filter((file) => file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv");
    setFiles((previous) => [...previous, ...accepted]);
  }, []);

  async function handleDryRun() {
    setError("");
    setBusy(true);
    try {
      const uploaded = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploaded.push({ url: file_url, file_name: file.name, test_type: "" });
      }
      const data = await importEvaluations({
        action: "dry_run",
        squad_id: activeSquad?.id,
        context,
        files: uploaded,
      });
      setPreview(data);
      setSessionGroups(buildGroups(data, context));
      setPlayerOverrides({});
      setSelectedBlocks({});
      setGroupingConfirmed(false);
      setStep(2);
    } catch (e) {
      setError(e.message || "No se pudieron analizar los archivos");
    } finally { setBusy(false); }
  }

  function updateGroup(groupId, patch) {
    setSessionGroups((previous) => previous.map((group) => group.group_id === groupId ? { ...group, ...patch } : group));
    setGroupingConfirmed(false);
  }

  function toggleBlock(groupId, blockId) {
    setSelectedBlocks((previous) => {
      const selected = new Set(previous[groupId] || []);
      if (selected.has(blockId)) selected.delete(blockId); else selected.add(blockId);
      return { ...previous, [groupId]: [...selected] };
    });
  }

  function splitGroup(group) {
    const selected = selectedBlocks[group.group_id] || [];
    if (!selected.length || selected.length === group.block_ids.length) {
      setError("Seleccioná uno o más bloques, dejando al menos uno en la sesión original.");
      return;
    }
    const splitIndex = sessionGroups.filter((item) => item.assessment_date === group.assessment_date).length + 1;
    const newGroup = {
      ...group,
      group_id: `split:${group.assessment_date}:${crypto.randomUUID()}`,
      name: `${group.name} · Turno ${splitIndex}`,
      block_ids: selected,
      append_to_session_id: "",
    };
    setSessionGroups((previous) => [
      ...previous.map((item) => item.group_id === group.group_id ? { ...item, block_ids: item.block_ids.filter((id) => !selected.includes(id)) } : item),
      newGroup,
    ]);
    setSelectedBlocks((previous) => ({ ...previous, [group.group_id]: [] }));
    setGroupingConfirmed(false);
    setError("");
  }

  async function handleConfirm() {
    if (!groupingConfirmed) {
      setError("Confirmá que revisaste la agrupación antes de importar.");
      return;
    }
    if (sessionGroups.some((group) => !group.name.trim() || !group.block_ids.length)) {
      setError("Cada sesión debe tener nombre y al menos un bloque.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const data = await importEvaluations({
        action: "confirm",
        squad_id: activeSquad?.id,
        context,
        files: preview.files.map((file) => ({
          url: file.file_url,
          file_name: file.file_name,
          test_type: file.test_key === "multiple" ? "" : file.test_key,
        })),
        session_groups: sessionGroups.map(({ existing_sessions, ...group }) => ({ ...group, append_to_session_id: group.append_to_session_id || null })),
        player_overrides: playerOverrides,
        remember_aliases: rememberAliases,
      });
      setResult(data);
      setStep(3);
      onImported?.();
    } catch (e) {
      setError(e.message || "No se pudo confirmar la importación");
    } finally { setBusy(false); }
  }

  const content = <div className="space-y-5">
    {error && <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30"><AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" /><p className="text-sm text-red-300">{error}</p></div>}

    {step === 1 && <>
      <div onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); handleFiles(event.dataTransfer.files); }} onClick={() => inputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${dragOver ? "border-blue-500 bg-blue-500/5" : "border-zinc-700 hover:border-zinc-600"}`}>
        <Upload size={28} className="text-zinc-500 mx-auto mb-2" />
        <p className="text-sm text-zinc-300 font-medium">Arrastrá uno o varios CSV</p>
        <p className="text-xs text-zinc-600 mt-1">La fecha, hora, prueba e intentos se detectan fila por fila</p>
        <input ref={inputRef} type="file" accept=".csv" multiple className="hidden" onChange={(event) => { handleFiles(event.target.files); event.target.value = ""; }} />
      </div>
      {!!files.length && <div className="space-y-2">{files.map((file, index) => <div key={`${file.name}:${index}`} className="flex items-center justify-between p-3 bg-zinc-950/50 border border-zinc-800 rounded-lg"><div className="flex items-center gap-2 min-w-0"><FileCheck2 size={16} className="text-emerald-400 shrink-0" /><span className="text-sm text-white truncate">{file.name}</span><span className="text-xs text-zinc-500">{Math.ceil(file.size / 1024)} KB</span></div><button onClick={() => setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="p-1 text-zinc-500 hover:text-red-400"><X size={14} /></button></div>)}</div>}
      <div className="grid sm:grid-cols-[1.2fr_1fr] gap-3">
        <div className="flex items-start gap-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3"><Calendar size={18} className="mt-0.5 shrink-0 text-blue-400" /><div><p className="text-xs font-semibold text-blue-200">Fecha automática desde el CSV</p><p className="mt-1 text-xs leading-relaxed text-zinc-400">La fecha y la hora se leen exclusivamente del contenido de cada fila. Si falta una fecha válida, el archivo se detiene para revisión.</p></div></div>
        <div><label className="text-xs text-zinc-500 block mb-1">Contexto predeterminado</label><select value={context} onChange={(event) => setContext(event.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-sm text-white">{CONTEXTS.map((value) => <option key={value} value={value}>{value || "Sin contexto"}</option>)}</select></div>
      </div>
      <div className="flex items-center justify-between"><p className="text-xs text-zinc-500">{files.length} archivo(s)</p><button onClick={handleDryRun} disabled={!files.length || busy || !activeSquad?.id} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy ? <Loader2 size={16} className="animate-spin" /> : <FileCheck2 size={16} />}{busy ? "Analizando..." : "Analizar y agrupar"}</button></div>
    </>}

    {step === 2 && preview && <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2"><StatBox label="Filas" value={preview.total_results} color="blue" /><StatBox label="Nuevas" value={preview.new_results} color="emerald" /><StatBox label="Duplicadas" value={preview.duplicate_results} color="yellow" /><StatBox label="Jugadores" value={preview.total_players} color="blue" /><StatBox label="Pendientes" value={unresolved} color="red" /></div>

      <section className="space-y-3">
        <div className="flex items-center gap-2"><Layers3 size={17} className="text-blue-400" /><div><h3 className="text-sm font-bold text-white">Sesiones propuestas</h3><p className="text-xs text-zinc-500">Un bloque mantiene juntos todos los intentos de un jugador, prueba, fecha y hora.</p></div></div>
        {sessionGroups.map((group) => <SessionGroupCard key={group.group_id} group={group} blocks={group.block_ids.map((id) => blockMap.get(id)).filter(Boolean)} selected={selectedBlocks[group.group_id] || []} onToggle={(id) => toggleBlock(group.group_id, id)} onChange={(patch) => updateGroup(group.group_id, patch)} onSplit={() => splitGroup(group)} />)}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2"><Users size={17} className="text-blue-400" /><div><h3 className="text-sm font-bold text-white">Vinculación de jugadores</h3><p className="text-xs text-zinc-500">Los nombres se buscan en todo el club; los resultados siguen perteneciendo al plantel activo.</p></div></div>
        <div className="border border-zinc-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto"><table className="w-full text-xs"><thead className="bg-zinc-800 sticky top-0"><tr><th className="text-left p-2 text-zinc-400">Nombre CSV</th><th className="text-left p-2 text-zinc-400">Estado</th><th className="text-left p-2 text-zinc-400">Jugador interno</th></tr></thead><tbody>{preview.linking_preview.map((link) => <tr key={link.csv_name} className="border-t border-zinc-800/60"><td className="p-2 text-white"><p>{link.csv_name}</p><p className="text-[10px] text-zinc-600">{link.reason}</p></td><td className="p-2"><StatusBadge status={playerOverrides[link.csv_name] ? "exact_match" : link.status} /></td><td className="p-2"><PlayerSelect link={link} players={preview.player_options || []} value={playerOverrides[link.csv_name] || link.proposed_player_id || ""} onChange={(value) => setPlayerOverrides((previous) => ({ ...previous, [link.csv_name]: value }))} /></td></tr>)}</tbody></table></div>
        <label className="flex items-center gap-2 mt-2 text-xs text-zinc-400"><input type="checkbox" checked={rememberAliases} onChange={(event) => setRememberAliases(event.target.checked)} className="accent-blue-500" />Recordar las correcciones manuales como alias auditables</label>
      </section>

      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30"><label className="flex items-start gap-2 text-sm text-blue-200"><input type="checkbox" checked={groupingConfirmed} onChange={(event) => setGroupingConfirmed(event.target.checked)} className="accent-blue-500 mt-1" /><span>Revisé las fechas, nombres, bloques y destinos. Confirmo esta agrupación explícita de sesiones.</span></label></div>
      <div className="flex justify-between"><button onClick={() => setStep(1)} disabled={busy} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm">Volver</button><button onClick={handleConfirm} disabled={busy || !groupingConfirmed} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}{busy ? "Importando..." : `Importar en ${sessionGroups.length} sesión(es)`}</button></div>
    </>}

    {step === 3 && result && <div className="text-center py-8 space-y-4"><div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto"><CheckCircle2 size={32} className="text-emerald-400" /></div><div><h3 className="text-lg font-bold text-white">Importación completada</h3><p className="text-sm text-zinc-400 mt-1">Se guardaron {result.sessions?.length || 0} sesiones con trazabilidad completa.</p></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-lg mx-auto"><StatBox label="Importados" value={result.imported_results} color="blue" /><StatBox label="Duplicados" value={result.duplicate_results} color="yellow" /><StatBox label="Vinculados" value={result.linked_players} color="emerald" /><StatBox label="Pendientes" value={result.pending_players} color="red" /></div>{result.sessions?.map((session) => <div key={session.session_id} className="max-w-lg mx-auto text-left p-3 rounded-lg bg-zinc-950/50 border border-zinc-800"><p className="text-sm text-white font-medium">{session.name}</p><p className="text-xs text-zinc-500">{session.assessment_date} · {session.total_players} jugadores · {session.total_results} resultados</p></div>)}{onClose && <button onClick={onClose} className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold">Cerrar</button>}</div>}
  </div>;

  if (embedded) return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">{content}</div>;
  return <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"><div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto"><div className="flex items-center justify-between p-5 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-20"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center"><Upload size={20} className="text-blue-400" /></div><div><h2 className="text-lg font-bold text-white">Importar evaluaciones</h2><p className="text-xs text-zinc-500">Paso {step} de 3 · {activeSquad?.name || "Sin plantel"}</p></div></div>{onClose && <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>}</div><div className="p-5">{content}</div></div></div>;
}

function SessionGroupCard({ group, blocks, selected, onToggle, onChange, onSplit }) {
  const totalNew = blocks.reduce((sum, block) => sum + Number(block.new_results || 0), 0);
  return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><div className="grid sm:grid-cols-[150px_1fr_200px] gap-3"><div><label className="text-xs text-zinc-500 block mb-1">Fecha detectada en el CSV</label><div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-zinc-950 border border-zinc-800 text-sm text-white"><Calendar size={14} className="text-zinc-500" />{group.assessment_date}</div></div><div><label className="text-xs text-zinc-500 block mb-1">Nombre de sesión</label><input value={group.name} onChange={(event) => onChange({ name: event.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-sm text-white" /></div><div><label className="text-xs text-zinc-500 block mb-1">Destino explícito</label><select value={group.append_to_session_id} onChange={(event) => onChange({ append_to_session_id: event.target.value })} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-white"><option value="">Crear sesión nueva</option>{group.existing_sessions.map((session) => <option key={session.session_id} value={session.session_id}>Agregar a: {session.name}</option>)}</select></div></div><div className="flex items-center justify-between mt-3 mb-2"><p className="text-xs text-zinc-500">{blocks.length} bloques · {totalNew} resultados nuevos</p><button onClick={onSplit} disabled={!selected.length} className="px-2.5 py-1.5 rounded bg-zinc-800 text-zinc-300 text-xs disabled:opacity-40 flex items-center gap-1.5"><Scissors size={12} />Dividir {selected.length ? `(${selected.length})` : ""}</button></div><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-44 overflow-y-auto">{blocks.map((block) => <label key={block.block_id} className={`p-2.5 rounded-lg border cursor-pointer ${selected.includes(block.block_id) ? "border-blue-500 bg-blue-500/10" : "border-zinc-800 bg-zinc-950/50"}`}><div className="flex items-start gap-2"><input type="checkbox" checked={selected.includes(block.block_id)} onChange={() => onToggle(block.block_id)} className="accent-blue-500 mt-0.5" /><div className="min-w-0"><p className="text-xs text-white font-medium truncate">{block.player_name} · {String(block.test_key).toUpperCase()}</p><p className="text-[10px] text-zinc-500">{block.assessment_time || "sin hora"} · {block.attempt_count} intento(s) · {block.duplicate_results} dup.</p></div></div></label>)}</div></div>;
}

function PlayerSelect({ link, players, value, onChange }) {
  if (link.status === "exact_match" && !link.candidates?.length) return <span className="text-zinc-300">{link.proposed_player_name}</span>;
  return <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full min-w-[190px] bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white"><option value="">Dejar pendiente</option>{players.map((player) => <option key={player.id} value={player.id}>{player.full_name}{player.squad_name ? ` · ${player.squad_name}` : ""}{player.position ? ` · ${player.position}` : ""}</option>)}</select>;
}

function StatBox({ label, value, color }) {
  const colors = { blue: "text-blue-400", emerald: "text-emerald-400", red: "text-red-400", yellow: "text-yellow-400" };
  return <div className="bg-zinc-950/50 border border-zinc-800 rounded-lg p-3 text-center"><p className={`text-2xl font-bold ${colors[color] || "text-white"}`}>{value ?? 0}</p><p className="text-xs text-zinc-500 mt-0.5">{label}</p></div>;
}
