import React, { useEffect, useMemo, useState } from "react";
import moment from "moment";
import { AlertTriangle, Clock3, Save, ShieldCheck, UserPlus, Users } from "lucide-react";

import { base44 } from "@/api/base44Client";
import TransparentPlayerPhoto from "@/components/player/PlayerPhoto";
import { useToast } from "@/components/ui/use-toast";

function getPlayerName(player) {
  return player?.full_name || player?.name || "Jugador";
}

function getPlayerNumber(player) {
  return player?.jersey_number || player?.number || "—";
}

function normalizeMinute(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value;
  const text = String(value).trim();
  if (!text) return null;
  const match = text.match(/^(\d+)(?:\s*\+\s*(\d+))?$/);
  if (!match) return null;
  return Number(match[1]) + Number(match[2] || 0);
}

function formatMinute(value) {
  return value == null ? "" : String(value);
}

function getTournament(match) {
  const competition = String(match.competition || "");
  if (competition.includes("Apertura")) return "Proyección Apertura";
  if (competition.includes("Clausura")) return "Proyección Clausura";
  if (competition.includes("Amistoso")) return "Amistosos";
  return competition || "Partido";
}

function calcMinutes(entry, duration) {
  const matchDuration = Math.max(90, duration || 90);
  if (entry.manual_override) {
    return Math.max(0, Number(entry.manual_minutes || 0));
  }
  if (entry.is_starter) {
    const out = normalizeMinute(entry.out_minute);
    return Math.max(0, (out ?? matchDuration));
  }
  if (!entry.entered) return 0;
  const start = normalizeMinute(entry.in_minute) ?? matchDuration;
  const out = normalizeMinute(entry.out_minute) ?? matchDuration;
  return Math.max(0, out - start);
}

export default function MinutosTab({ match, players, onRegisterSave }) {
  const { toast } = useToast();
  const [entries, setEntries] = useState({});
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const calledPlayers = useMemo(() => {
    const map = new Map(players.map((player) => [player.id, player]));
    return (match.squad_called || []).map((id) => map.get(id)).filter(Boolean);
  }, [match.squad_called, players]);

  useEffect(() => {
    async function loadMinutes() {
      setLoading(true);
      try {
        const rows = await base44.entities.MinutesRecord.filter({ match_id: match.id }, "-created_date", 300);
        setRecords(rows || []);
        const nextEntries = {};
        const recordsMap = Object.fromEntries((rows || []).map((row) => [row.player_id, row]));
        calledPlayers.forEach((player, index) => {
          const record = recordsMap[player.id];
          const explicitStarter = record && Object.prototype.hasOwnProperty.call(record, "is_starter") ? !!record.is_starter : index < 11;
          const inferredEntered = explicitStarter || Number(record?.minutes || 0) > 0;
          const inferredSubIn = record?.sub_in_minute != null ? String(record.sub_in_minute) : "";
          const inferredOut = explicitStarter && Number(record?.minutes || 0) > 0 && Number(record?.minutes || 0) < 90 ? String(record.minutes) : "";
          const needsManual = !explicitStarter && inferredEntered && !inferredSubIn && Number(record?.minutes || 0) > 0;
          nextEntries[player.id] = {
            is_starter: explicitStarter,
            entered: inferredEntered,
            in_minute: inferredSubIn,
            out_minute: inferredOut,
            manual_override: needsManual,
            manual_minutes: record?.minutes ?? 0,
          };
        });
        setEntries(nextEntries);
        setDirty(false);
      } catch {
        toast({ title: "No se pudieron cargar los minutos", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadMinutes();
  }, [calledPlayers, match.id, toast]);

  const matchDuration = useMemo(() => {
    const values = Object.values(entries).flatMap((entry) => [normalizeMinute(entry.in_minute), normalizeMinute(entry.out_minute)]).filter((value) => value != null);
    return Math.max(90, ...values, 90);
  }, [entries]);

  const starterCount = useMemo(() => Object.values(entries).filter((entry) => entry.is_starter).length, [entries]);

  const rows = useMemo(() => calledPlayers.map((player) => {
    const entry = entries[player.id] || { is_starter: false, entered: false, in_minute: "", out_minute: "", manual_override: false, manual_minutes: 0 };
    const minutes = calcMinutes(entry, matchDuration);
    const category = entry.is_starter ? "titulares" : entry.entered ? "suplentesConIngreso" : "suplentesSinMinutos";
    return { player, entry, minutes, category };
  }), [calledPlayers, entries, matchDuration]);

  useEffect(() => {
    onRegisterSave?.({ action: saveAll, disabled: !dirty || saving, pending: dirty, label: "minutos" });
  }, [dirty, onRegisterSave, saving, rows]);

  function patchEntry(playerId, patch) {
    setEntries((current) => ({ ...current, [playerId]: { ...(current[playerId] || {}), ...patch } }));
    setDirty(true);
  }

  function toggleStarter(playerId, value) {
    if (value && !entries[playerId]?.is_starter && starterCount >= 11) {
      toast({ title: "No puede haber más de 11 titulares", variant: "destructive" });
      return;
    }

    patchEntry(playerId, {
      is_starter: value,
      entered: value ? true : entries[playerId]?.entered ?? false,
      in_minute: value ? "" : entries[playerId]?.in_minute || "",
    });
  }

  function markStartingXI() {
    const next = {};
    calledPlayers.forEach((player, index) => {
      next[player.id] = {
        ...(entries[player.id] || {}),
        is_starter: index < 11,
        entered: index < 11,
        in_minute: index < 11 ? "" : entries[player.id]?.in_minute || "",
      };
    });
    setEntries(next);
    setDirty(true);
  }

  function setNinetyToStarters() {
    const next = { ...entries };
    calledPlayers.forEach((player) => {
      if (next[player.id]?.is_starter) {
        next[player.id] = { ...next[player.id], entered: true, out_minute: "", manual_override: false, manual_minutes: 90 };
      }
    });
    setEntries(next);
    setDirty(true);
  }

  function markSubsWithoutEntry() {
    const next = { ...entries };
    calledPlayers.forEach((player) => {
      if (!next[player.id]?.is_starter) {
        next[player.id] = { ...next[player.id], entered: false, in_minute: "", out_minute: "", manual_override: false, manual_minutes: 0 };
      }
    });
    setEntries(next);
    setDirty(true);
  }

  async function saveAll() {
    if (starterCount > 11) {
      toast({ title: "Corregí la cantidad de titulares antes de guardar", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const existingByPlayer = Object.fromEntries(records.map((row) => [row.player_id, row]));
      const calledIds = new Set(calledPlayers.map((player) => player.id));
      const matchLabel = `vs ${match.rival} ${moment(match.date).format("DD/MM/YY")}`;
      const tournament = getTournament(match);

      for (const record of records) {
        if (record.player_id && !calledIds.has(record.player_id)) {
          await base44.entities.MinutesRecord.delete(record.id);
        }
      }

      for (const row of rows) {
        const minutes = Math.max(0, row.minutes);
        const payload = {
          player_id: row.player.id,
          player_name: getPlayerName(row.player),
          player_number: getPlayerNumber(row.player),
          match_id: match.id,
          match_label: matchLabel,
          match_date: match.date,
          rival: match.rival,
          minutes,
          is_starter: !!row.entry.is_starter,
          sub_in_minute: row.entry.is_starter ? null : normalizeMinute(row.entry.in_minute),
          tournament,
          squad_id: match.squad_id || null,
          competition_id: match.competition_id || null,
        };

        if (existingByPlayer[row.player.id]) {
          await base44.entities.MinutesRecord.update(existingByPlayer[row.player.id].id, payload);
        } else {
          await base44.entities.MinutesRecord.create(payload);
        }
      }

      const refreshed = await base44.entities.MinutesRecord.filter({ match_id: match.id }, "-created_date", 300);
      setRecords(refreshed || []);
      setDirty(false);
      toast({ title: "Minutos guardados correctamente" });
    } catch {
      toast({ title: "No se pudieron guardar los minutos", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="h-6 w-6 rounded-full border-2 border-zinc-700 border-t-white animate-spin" />
      </div>
    );
  }

  if (calledPlayers.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <h2 className="text-lg font-semibold text-white">Sin convocados</h2>
        <p className="mt-2 text-sm text-zinc-500">Primero cargá la convocatoria del partido para poder registrar los minutos jugados.</p>
      </div>
    );
  }

  const sections = [
    { key: "titulares", title: "Titulares", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", items: rows.filter((row) => row.category === "titulares") },
    { key: "suplentesConIngreso", title: "Suplentes que ingresaron", badge: "bg-blue-500/15 text-blue-300 border-blue-500/30", items: rows.filter((row) => row.category === "suplentesConIngreso") },
    { key: "suplentesSinMinutos", title: "Suplentes sin minutos", badge: "bg-zinc-800 text-zinc-300 border-zinc-700", items: rows.filter((row) => row.category === "suplentesSinMinutos") },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 size={16} className="text-yellow-400" /> Minutos jugados</h2>
            <p className="mt-1 text-xs text-zinc-500">Solo se muestran los jugadores convocados para este partido.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={markStartingXI} className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-200 transition hover:bg-zinc-700"><Users size={13} className="mr-1 inline" /> Marcar XI titulares</button>
            <button onClick={setNinetyToStarters} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-500/20"><ShieldCheck size={13} className="mr-1 inline" /> 90 min a titulares</button>
            <button onClick={markSubsWithoutEntry} className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300 transition hover:bg-blue-500/20"><UserPlus size={13} className="mr-1 inline" /> Marcar suplentes sin ingreso</button>
            <button onClick={saveAll} disabled={!dirty || saving} className="rounded-lg bg-yellow-500 px-3 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"><Save size={13} className="mr-1 inline" /> {saving ? "Guardando..." : "Guardar todo"}</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1">Titulares: {starterCount}/11</span>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1">Duración calculada: {matchDuration} min</span>
          <span className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1">Cambios pendientes: {dirty ? "Sí" : "No"}</span>
        </div>
      </div>

      {sections.map((section) => (
        <div key={section.key} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">{section.title}</h3>
              <span className={`rounded-full border px-2 py-1 text-[11px] ${section.badge}`}>{section.items.length}</span>
            </div>
          </div>
          <div className="space-y-3">
            {section.items.length === 0 && <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-6 text-center text-sm text-zinc-500">Sin jugadores en esta categoría.</div>}
            {section.items.map(({ player, entry, minutes }) => (
              <div key={player.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <TransparentPlayerPhoto player={player} className="h-12 w-12 rounded-full border border-zinc-700 object-cover" fallbackClassName="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800" textClassName="text-sm font-bold text-zinc-400" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-white">{getPlayerName(player)}</p>
                        <span className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">#{getPlayerNumber(player)}</span>
                      </div>
                      <p className="text-xs text-zinc-500">{player.position || "Sin posición"}</p>
                    </div>
                  </div>

                  <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Rol</span>
                      <select value={entry.is_starter ? "starter" : "sub"} onChange={(e) => toggleStarter(player.id, e.target.value === "starter")} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500">
                        <option value="starter">Titular</option>
                        <option value="sub">Suplente</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Ingresó</span>
                      <select value={entry.is_starter || entry.entered ? "si" : "no"} onChange={(e) => patchEntry(player.id, { entered: e.target.value === "si", in_minute: e.target.value === "si" ? entry.in_minute : "", out_minute: e.target.value === "si" ? entry.out_minute : "", manual_override: false })} disabled={entry.is_starter} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500 disabled:opacity-60">
                        <option value="si">Sí</option>
                        <option value="no">No</option>
                      </select>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Min. ingreso</span>
                      <input value={formatMinute(entry.in_minute)} onChange={(e) => patchEntry(player.id, { in_minute: e.target.value, entered: true })} disabled={entry.is_starter || !entry.entered} placeholder="60 o 90+5" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500 disabled:opacity-60" />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Min. salida</span>
                      <input value={formatMinute(entry.out_minute)} onChange={(e) => patchEntry(player.id, { out_minute: e.target.value })} disabled={!entry.entered} placeholder="75 o 90+5" className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500 disabled:opacity-60" />
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Minutos</span>
                      <div className="flex h-[42px] items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm font-semibold text-white">{minutes}'</div>
                    </label>

                    <label className="space-y-1">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">Override manual</span>
                      <div className="flex gap-2">
                        <input type="checkbox" checked={!!entry.manual_override} onChange={(e) => patchEntry(player.id, { manual_override: e.target.checked, manual_minutes: e.target.checked ? minutes : entry.manual_minutes })} className="mt-3 h-4 w-4 accent-yellow-500" />
                        <input type="number" min="0" value={entry.manual_minutes ?? 0} onChange={(e) => patchEntry(player.id, { manual_minutes: e.target.value })} disabled={!entry.manual_override} className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-yellow-500 disabled:opacity-60" />
                      </div>
                    </label>
                  </div>
                </div>
                {entry.manual_override && <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-300"><AlertTriangle size={13} /> Se usará el valor manual por encima del cálculo automático.</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
