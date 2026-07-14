import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { Download, Eraser, Move, RefreshCw, Save, Shield, Trash2, Users } from "lucide-react";

import { base44 } from "@/api/base44Client";
import TransparentPlayerPhoto from "@/components/player/PlayerPhoto";
import { useToast } from "@/components/ui/use-toast";
import { getPlayerName, getPlayerNumber, loadMatchCallupState } from "@/lib/matchCallupUtils";

const DYJ_LOGO = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png";
const SYSTEMS = ["4-2-3-1", "4-3-3", "4-4-2", "3-5-2", "3-4-3", "5-3-2", "4-1-4-1"];
const EXPORTS = {
  horizontal: { label: "Imagen horizontal", width: 1600, height: 900 },
  whatsapp: { label: "WhatsApp", width: 1080, height: 1350 },
  story: { label: "Historia vertical", width: 1080, height: 1920 },
};

function parseSystem(system) {
  return String(system || "4-3-3").split("-").map((n) => Number(n)).filter(Boolean);
}

function systemPositions(system) {
  const lines = [1, ...parseSystem(system)];
  const yValues = lines.length === 5 ? [86, 68, 51, 34, 16] : [86, 63, 39, 16];
  return lines.flatMap((count, lineIndex) => {
    const y = yValues[lineIndex] || 18;
    return Array.from({ length: count }, (_, index) => ({ x: ((index + 1) * 100) / (count + 1), y }));
  }).slice(0, 11);
}

function surname(player) {
  const parts = getPlayerName(player).split(" ").filter(Boolean);
  return parts[parts.length - 1] || getPlayerName(player);
}

function downloadDataUrl(dataUrl, filename) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function MatchBadge({ src, label }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) return <img src={src} alt={label} className="h-12 w-12 rounded-full bg-white object-contain p-1" onError={() => setFailed(true)} />;
  return <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-black text-zinc-400">{String(label || "?").charAt(0)}</div>;
}

export default function FormacionTab({ match, players = [], onRegisterSave, onMatchUpdated, onCallupsUpdated }) {
  const { toast } = useToast();
  const fieldRef = useRef(null);
  const exportRef = useRef(null);
  const [callups, setCallups] = useState([]);
  const [playerMap, setPlayerMap] = useState(new Map());
  const [system, setSystem] = useState(match.tactical_system || "4-3-3");
  const [positions, setPositions] = useState({});
  const [roleOverrides, setRoleOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function loadFormation() {
    setLoading(true);
    const state = await loadMatchCallupState(match, players);
    const active = state.savedCallups || [];
    const next = {};
    const matchPositions = new Map((match.formation_positions || []).map((item) => [item.player_id, item]));
    active.forEach((callup) => {
      const saved = matchPositions.get(callup.player_id);
      const x = Number(callup.formation_x ?? saved?.x);
      const y = Number(callup.formation_y ?? saved?.y);
      if (callup.lineup_role === "titular" && Number.isFinite(x) && Number.isFinite(y)) next[callup.player_id] = { x, y };
    });
    const starterWithoutCoords = active.filter((callup) => callup.lineup_role === "titular" && !next[callup.player_id]).slice(0, 11);
    if (starterWithoutCoords.length) {
      const auto = systemPositions(match.tactical_system || system);
      starterWithoutCoords.forEach((callup, index) => { next[callup.player_id] = auto[index] || { x: 50, y: 50 }; });
    }
    setSystem(match.tactical_system || "4-3-3");
    setCallups(active);
    setPlayerMap(state.playerMap);
    setPositions(next);
    setRoleOverrides({});
    setDirty(false);
    setLoading(false);
  }

  useEffect(() => { loadFormation(); }, [match.id]);

  const calledPlayers = useMemo(() => callups.map((callup) => ({ callup, player: playerMap.get(callup.player_id) })).filter((item) => item.player), [callups, playerMap]);
  const starterIds = useMemo(() => Object.keys(positions), [positions]);
  const starterSet = useMemo(() => new Set(starterIds), [starterIds]);
  const titulares = calledPlayers.filter(({ callup }) => starterSet.has(callup.player_id));
  const suplentes = calledPlayers.filter(({ callup }) => !starterSet.has(callup.player_id) && (roleOverrides[callup.player_id] === "suplente" || callup.lineup_role !== "pendiente"));
  const sinAsignar = calledPlayers.filter(({ callup }) => !starterSet.has(callup.player_id) && roleOverrides[callup.player_id] !== "suplente" && callup.lineup_role === "pendiente");

  function arrange(ids, nextSystem = system) {
    const auto = systemPositions(nextSystem);
    const next = {};
    ids.slice(0, 11).forEach((id, index) => { next[id] = auto[index] || { x: 50, y: 50 }; });
    setPositions(next);
    setDirty(true);
  }

  function changeSystem(value) {
    setSystem(value);
    arrange(starterIds, value);
  }

  function autoArrange() {
    const ids = starterIds.length ? starterIds : callups.filter((callup) => callup.lineup_role === "titular").map((callup) => callup.player_id);
    if (!ids.length) return toast({ title: "Primero ubicá titulares en el campo" });
    arrange(ids, system);
  }

  function addToField(playerId) {
    if (positions[playerId]) return;
    if (starterIds.length >= 11) return toast({ title: "La formación ya tiene 11 titulares", variant: "destructive" });
    const nextSpot = systemPositions(system)[starterIds.length] || { x: 50, y: 50 };
    setPositions((current) => ({ ...current, [playerId]: nextSpot }));
    setRoleOverrides((current) => ({ ...current, [playerId]: "titular" }));
    setDirty(true);
  }

  function removeFromField(playerId) {
    setPositions((current) => {
      const next = { ...current };
      delete next[playerId];
      return next;
    });
    setRoleOverrides((current) => ({ ...current, [playerId]: "suplente" }));
    setDirty(true);
  }

  function dropOnField(event) {
    event.preventDefault();
    const playerId = event.dataTransfer.getData("text/plain");
    if (!playerId || !playerMap.has(playerId)) return;
    if (!positions[playerId] && starterIds.length >= 11) return toast({ title: "La formación ya tiene 11 titulares", variant: "destructive" });
    const rect = fieldRef.current.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(6, Math.min(94, ((event.clientY - rect.top) / rect.height) * 100));
    setPositions((current) => ({ ...current, [playerId]: { x, y } }));
    setRoleOverrides((current) => ({ ...current, [playerId]: "titular" }));
    setDirty(true);
  }

  async function saveFormation() {
    if (starterIds.length > 11) return toast({ title: "No puede haber más de 11 titulares", variant: "destructive" });
    setSaving(true);
    const now = new Date().toISOString();
    const updates = callups.map((callup) => {
      const pos = positions[callup.player_id];
      return {
        id: callup.id,
        lineup_role: pos ? "titular" : "suplente",
        ...(pos ? { formation_x: Number(pos.x), formation_y: Number(pos.y) } : {}),
        updated_at: now,
      };
    });
    if (updates.length) await base44.entities.MatchCallup.bulkUpdate(updates);
    const formationPositions = starterIds.map((playerId) => ({ player_id: playerId, x: Number(positions[playerId].x), y: Number(positions[playerId].y) }));
    const patch = { tactical_system: system, formation_positions: formationPositions, formation_updated_at: now };
    await base44.entities.MatchReport.update(match.id, patch);
    onMatchUpdated?.(patch);
    onCallupsUpdated?.();
    await loadFormation();
    setDirty(false);
    setSaving(false);
    toast({ title: "Formación guardada y sincronizada con Minutos" });
  }

  useEffect(() => {
    onRegisterSave?.({ action: saveFormation, disabled: !dirty || saving, pending: dirty, label: "formación" });
  }, [dirty, saving, system, positions, callups]);

  async function exportImage(kind) {
    if (!exportRef.current) return;
    const size = EXPORTS[kind];
    const canvas = await html2canvas(exportRef.current, { backgroundColor: "#09090b", scale: 2, useCORS: true });
    const output = document.createElement("canvas");
    output.width = size.width;
    output.height = size.height;
    const ctx = output.getContext("2d");
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, size.width, size.height);
    const ratio = Math.min(size.width / canvas.width, size.height / canvas.height);
    ctx.drawImage(canvas, (size.width - canvas.width * ratio) / 2, (size.height - canvas.height * ratio) / 2, canvas.width * ratio, canvas.height * ratio);
    downloadDataUrl(output.toDataURL("image/png"), `formacion-${match.rival || "partido"}-${kind}.png`);
  }

  async function exportPdf() {
    if (!exportRef.current) return;
    const canvas = await html2canvas(exportRef.current, { backgroundColor: "#09090b", scale: 2, useCORS: true });
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", (pageWidth - canvas.width * ratio) / 2, 0, canvas.width * ratio, canvas.height * ratio);
    pdf.save(`formacion-${match.rival || "partido"}.pdf`);
  }

  if (loading) return <StateCard title="Cargando formación…" />;
  if (!calledPlayers.length) return <StateCard title="Sin convocados" description="Primero cargá la convocatoria del partido para armar la formación." />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Shield size={16} className="text-yellow-400" /> Formación del equipo</h2>
            <p className="mt-1 text-xs text-zinc-500">Usa únicamente jugadores convocados. Los titulares guardados alimentan Minutos si todavía no hay registros cargados.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={system} onChange={(e) => changeSystem(e.target.value)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500">{SYSTEMS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <div className={`rounded-lg border px-3 py-2 text-sm font-black ${starterIds.length === 11 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"}`}>{starterIds.length}/11 titulares</div>
            <button onClick={saveFormation} disabled={!dirty || saving} className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-yellow-400 disabled:opacity-50"><Save size={13} className="mr-1 inline" /> {saving ? "Guardando…" : "Guardar formación"}</button>
            <button onClick={() => { setRoleOverrides((current) => ({ ...current, ...Object.fromEntries(starterIds.map((id) => [id, "suplente"])) })); setPositions({}); setDirty(true); }} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"><Eraser size={13} className="mr-1 inline" /> Limpiar</button>
            <button onClick={autoArrange} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"><RefreshCw size={13} className="mr-1 inline" /> Ordenar</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div ref={exportRef} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3"><MatchBadge src={DYJ_LOGO} label="DYJ" /><div><p className="text-xs uppercase tracking-[0.25em] text-yellow-300">Defensa y Justicia</p><p className="text-lg font-black text-white">vs {match.rival || "Rival"}</p></div><MatchBadge src={match.rival_logo_url} label={match.rival} /></div>
            <div className="text-right text-xs text-zinc-400"><p>{match.competition || "Competencia"}</p><p>{[match.date, match.match_time, match.match_venue].filter(Boolean).join(" · ")}</p><p className="font-bold text-yellow-300">Sistema {system}</p></div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
            <Field refEl={fieldRef} positions={positions} playerMap={playerMap} onDrop={dropOnField} onRemove={removeFromField} />
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Users size={14} className="text-yellow-400" /> Suplentes</h3>
              <div className="space-y-2">{suplentes.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">Sin suplentes.</p> : suplentes.map(({ player }) => <CompactPlayer key={player.id} player={player} onDragStart={() => null} />)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Panel title="Sin asignar" items={sinAsignar} onAdd={addToField} />
          <Panel title="Titulares" items={titulares} onAdd={addToField} onRemove={removeFromField} />
          <Panel title="Suplentes" items={suplentes} onAdd={addToField} />
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Exportar</h3>
            <div className="grid grid-cols-1 gap-2">
              <button onClick={exportPdf} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300 hover:bg-yellow-500/20"><Download size={13} className="mr-1 inline" /> PDF A4</button>
              {Object.entries(EXPORTS).map(([key, item]) => <button key={key} onClick={() => exportImage(key)} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">{item.label}</button>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StateCard({ title, description }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center"><h2 className="text-lg font-semibold text-white">{title}</h2>{description && <p className="mt-2 text-sm text-zinc-500">{description}</p>}</div>;
}

function Field({ refEl, positions, playerMap, onDrop, onRemove }) {
  return <div ref={refEl} onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="relative min-h-[620px] overflow-hidden rounded-[28px] border border-emerald-500/30 bg-emerald-950 shadow-inner">
    <div className="absolute inset-0 opacity-70" style={{ backgroundImage: "linear-gradient(90deg,rgba(255,255,255,.06) 1px,transparent 1px),linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px)", backgroundSize: "12.5% 10%" }} />
    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/20" />
    <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
    <div className="absolute bottom-0 left-1/2 h-24 w-48 -translate-x-1/2 rounded-t-3xl border border-b-0 border-white/25" />
    {Object.entries(positions).map(([playerId, pos]) => {
      const player = playerMap.get(playerId);
      if (!player) return null;
      return <div key={playerId} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", playerId)} className="absolute z-10 w-28 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-2xl border border-yellow-400/60 bg-zinc-950/95 p-2 text-center shadow-xl" style={{ left: `${pos.x}%`, top: `${pos.y}%` }}><button onClick={() => onRemove(playerId)} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"><Trash2 size={10} /></button><TransparentPlayerPhoto player={player} className="mx-auto h-11 w-11 rounded-full border border-zinc-700 object-cover" fallbackClassName="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800" textClassName="text-xs text-zinc-400" /><p className="mt-1 text-[11px] font-black text-white">#{getPlayerNumber(player)}</p><p className="truncate text-xs font-semibold text-yellow-200">{surname(player)}</p></div>;
    })}
    <div className="pointer-events-none absolute bottom-3 right-4 flex items-center gap-1 rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[11px] text-white/70"><Move size={12} /> Arrastrá para ubicar</div>
  </div>;
}

function CompactPlayer({ player }) {
  return <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-2 py-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/10 text-[11px] font-black text-yellow-300">{getPlayerNumber(player)}</span><span className="truncate text-xs font-semibold text-white">{getPlayerName(player)}</span></div>;
}

function Panel({ title, items, onAdd, onRemove }) {
  return <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{title}</h3><span className="text-xs text-zinc-500">{items.length}</span></div><div className="space-y-2">{items.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">Sin jugadores.</p> : items.map(({ player }) => <div key={player.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", player.id)} className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-2"><TransparentPlayerPhoto player={player} className="h-9 w-9 rounded-full border border-zinc-700 object-cover" fallbackClassName="flex h-9 w-9 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800" textClassName="text-xs text-zinc-400" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{getPlayerName(player)}</p><p className="text-[11px] text-zinc-500">#{getPlayerNumber(player)} · {player.position || "Sin posición"}</p></div><button onClick={() => onAdd?.(player.id)} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-[11px] text-yellow-300">Al campo</button>{onRemove && <button onClick={() => onRemove(player.id)} className="rounded-lg border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400">Quitar</button>}</div>)}</div></div>;
}