import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import { RefreshCw, HeartPulse, Link2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { usePlayers } from "@/hooks/usePlayers";

function normalize(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}
function fmtDate(d) { return d ? moment(d).format("DD/MM/YYYY") : "—"; }

export default function MedicalSyncRepair() {
  const { toast } = useToast();
  const { players } = usePlayers();
  const [data, setData] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [linkTarget, setLinkTarget] = useState({});

  async function scan() {
    setScanning(true);
    try {
      const res = await base44.functions.invoke("repairMedicalSync", {});
      setData(res.data);
    } catch (e) {
      toast({ title: "Error al escanear", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  }

  async function linkUnmatchedRow(row, playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    await base44.entities.PlayerAlias.create({
      player_id: playerId,
      player_name: player.full_name || player.name,
      alias_name: row.raw_name,
      normalized_alias: normalize(row.raw_name),
      source: "Manual",
      confidence_score: 1,
    });
    await base44.entities.MedicalRecord.create({
      player_id: playerId,
      player_name: player.full_name || player.name,
      source: "Google Sheets",
      status: "Lesionado",
      last_synced_at: new Date().toISOString(),
      ...row.sheet_row_data,
    });
    await base44.entities.UnmatchedMedicalRow.update(row.id, { status: "vinculado", linked_player_id: playerId });
    setData(prev => ({ ...prev, unmatchedRows: prev.unmatchedRows.filter(r => r.id !== row.id) }));
    toast({ title: `✓ Vinculado a ${player.full_name || player.name}` });
  }

  async function discardUnmatchedRow(id) {
    await base44.entities.UnmatchedMedicalRow.update(id, { status: "descartado" });
    setData(prev => ({ ...prev, unmatchedRows: prev.unmatchedRows.filter(r => r.id !== id) }));
    toast({ title: "Fila descartada" });
  }

  async function linkRecord(record, playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    await base44.entities.PlayerAlias.create({
      player_id: playerId,
      player_name: player.full_name || player.name,
      alias_name: record.player_name,
      normalized_alias: normalize(record.player_name),
      source: "Manual",
      confidence_score: 1,
    });
    await base44.entities.MedicalRecord.update(record.id, { player_id: playerId, player_name: player.full_name || player.name });
    setData(prev => ({ ...prev, unlinkedRecords: prev.unlinkedRecords.filter(r => r.id !== record.id) }));
    toast({ title: `✓ Registro vinculado a ${player.full_name || player.name}` });
  }

  async function deleteRecord(id, bucket) {
    await base44.entities.MedicalRecord.delete(id);
    setData(prev => ({ ...prev, [bucket]: prev[bucket].filter(r => r.id !== id) }));
    toast({ title: "Registro eliminado" });
  }

  async function keepRecord(id) {
    await base44.entities.MedicalRecord.update(id, { not_found_in_last_sync: false });
    setData(prev => ({ ...prev, notFoundRecords: prev.notFoundRecords.filter(r => r.id !== id) }));
    toast({ title: "Registro conservado" });
  }

  async function mergeDuplicates(group) {
    const [keep, ...rest] = [...group.records].sort((a, b) => (b.updated_date || "").localeCompare(a.updated_date || ""));
    await Promise.all(rest.map(r => base44.entities.MedicalRecord.delete(r.id)));
    setData(prev => ({ ...prev, duplicateGroups: prev.duplicateGroups.filter(g => g.key !== group.key) }));
    toast({ title: `✓ Fusionados ${rest.length} duplicados, se conservó el más reciente` });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><HeartPulse size={16} className="text-red-400" /> Reparar sincronización médica</h2>
          <p className="text-zinc-500 text-xs mt-0.5">Detecta jugadores sin vincular, lesiones duplicadas y registros huérfanos de Google Sheets</p>
        </div>
        <button onClick={scan} disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors disabled:opacity-50">
          <RefreshCw size={13} className={scanning ? "animate-spin" : ""} /> {scanning ? "Escaneando..." : "Escanear"}
        </button>
      </div>

      {data === null ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-10 text-center">
          <p className="text-zinc-500 text-sm">Ejecutá el escaneo para detectar problemas de sincronización médica</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sin vincular */}
          <div>
            <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider mb-2">Jugadores médicos sin vincular ({data.unmatchedRows.length})</h3>
            {data.unmatchedRows.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin filas pendientes</p>
            ) : (
              <div className="space-y-2">
                {data.unmatchedRows.map(row => (
                  <div key={row.id} className="flex items-center gap-2 px-3 py-2 bg-amber-500/5 border border-amber-500/20 rounded-lg flex-wrap">
                    <span className="text-xs text-amber-300 flex-1 min-w-[140px]">{row.raw_name}</span>
                    <span className="text-[10px] text-zinc-500">{row.sheet_row_data?.diagnosis}</span>
                    <select value={linkTarget[row.id] || ""} onChange={e => setLinkTarget(p => ({ ...p, [row.id]: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none min-w-[160px]">
                      <option value="">Seleccionar jugador...</option>
                      {players.map(p => <option key={p.id} value={p.id}>{p.full_name || p.name}</option>)}
                    </select>
                    <button onClick={() => linkUnmatchedRow(row, linkTarget[row.id])} disabled={!linkTarget[row.id]}
                      className="px-3 py-1 bg-white text-zinc-900 rounded text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-40">
                      Vincular
                    </button>
                    <button onClick={() => discardUnmatchedRow(row.id)} title="Descartar"
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"><XCircle size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registros sin player_id */}
          <div>
            <h3 className="text-xs font-semibold text-orange-300 uppercase tracking-wider mb-2">Registros médicos sin player_id ({data.unlinkedRecords.length})</h3>
            {data.unlinkedRecords.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin registros huérfanos</p>
            ) : (
              <div className="space-y-2">
                {data.unlinkedRecords.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-orange-500/5 border border-orange-500/20 rounded-lg flex-wrap">
                    <span className="text-xs text-orange-300 flex-1 min-w-[140px]">{r.player_name}</span>
                    <span className="text-[10px] text-zinc-500">{r.diagnosis}</span>
                    <select value={linkTarget[r.id] || ""} onChange={e => setLinkTarget(p => ({ ...p, [r.id]: e.target.value }))}
                      className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white focus:outline-none min-w-[160px]">
                      <option value="">Seleccionar jugador...</option>
                      {players.map(p => <option key={p.id} value={p.id}>{p.full_name || p.name}</option>)}
                    </select>
                    <button onClick={() => linkRecord(r, linkTarget[r.id])} disabled={!linkTarget[r.id]}
                      className="px-3 py-1 bg-white text-zinc-900 rounded text-xs font-semibold hover:bg-zinc-200 transition-colors disabled:opacity-40">
                      Vincular
                    </button>
                    <button onClick={() => deleteRecord(r.id, "unlinkedRecords")} title="Eliminar"
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Duplicados */}
          <div>
            <h3 className="text-xs font-semibold text-blue-300 uppercase tracking-wider mb-2">Lesiones duplicadas ({data.duplicateGroups.length})</h3>
            {data.duplicateGroups.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin duplicados</p>
            ) : (
              <div className="space-y-2">
                {data.duplicateGroups.map(group => (
                  <div key={group.key} className="px-3 py-2 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs text-blue-300">{group.records[0].player_name} — {group.records[0].diagnosis} ({group.records.length} registros)</span>
                      <button onClick={() => mergeDuplicates(group)}
                        className="px-3 py-1 bg-white text-zinc-900 rounded text-xs font-semibold hover:bg-zinc-200 transition-colors">
                        Fusionar (conservar más reciente)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Desaparecidos de la planilla */}
          <div>
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">No encontrados en última sincronización ({data.notFoundRecords.length})</h3>
            {data.notFoundRecords.length === 0 ? (
              <p className="text-xs text-zinc-600">Sin registros pendientes de confirmar</p>
            ) : (
              <div className="space-y-2">
                {data.notFoundRecords.map(r => (
                  <div key={r.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-800/40 border border-zinc-700/50 rounded-lg flex-wrap">
                    <span className="text-xs text-white flex-1 min-w-[140px]">{r.player_name}</span>
                    <span className="text-[10px] text-zinc-500">{r.diagnosis} · {fmtDate(r.injury_date)}</span>
                    <button onClick={() => keepRecord(r.id)} title="Conservar"
                      className="flex items-center gap-1 px-2 py-1 rounded text-emerald-400 hover:bg-emerald-500/10 text-xs transition-colors"><CheckCircle2 size={12} /> Conservar</button>
                    <button onClick={() => deleteRecord(r.id, "notFoundRecords")} title="Eliminar"
                      className="flex items-center gap-1 px-2 py-1 rounded text-red-400 hover:bg-red-500/10 text-xs transition-colors"><Trash2 size={12} /> Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}