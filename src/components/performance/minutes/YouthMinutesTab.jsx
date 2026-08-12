import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";
import { useToast } from "@/components/ui/use-toast";
import { deleteYouthMinutes, saveYouthMinutes } from "@/components/performance/minutes/youthMinutesApi";

function formatDate(value) {
  const parts = String(value || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value || "—";
}

function todayInArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function YouthMinutesTab({
  rows,
  filters,
  canEdit,
  canDelete,
  isReserveSquad,
  squadName,
  entrySeasonId,
  onSaved,
}) {
  const { toast } = useToast();
  const [openPlayers, setOpenPlayers] = useState({});
  const [modal, setModal] = useState(null);
  const [deletingId, setDeletingId] = useState("");

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    minutes: acc.minutes + Number(row.juvenileMinutes || 0),
    records: acc.records + Number(row.juvenileMatchesCount || 0),
    players: acc.players + (row.juvenileMinutes > 0 ? 1 : 0),
  }), { minutes: 0, records: 0, players: 0 }), [rows]);

  async function handleDelete(record) {
    if (!canDelete || !record?.id) return;
    const confirmed = window.confirm(`¿Eliminar los ${record.minutes}' de ${record.player_name} del ${formatDate(record.match_date)}?`);
    if (!confirmed) return;
    setDeletingId(record.id);
    try {
      await deleteYouthMinutes(record.id);
      toast({ title: "Carga de Juveniles eliminada." });
      await onSaved?.();
    } catch (error) {
      toast({ title: error.message || "No se pudo eliminar el registro.", variant: "destructive" });
    } finally {
      setDeletingId("");
    }
  }

  if (!isReserveSquad) {
    return (
      <div className="rounded-2xl border border-yellow-500/25 bg-yellow-500/10 px-5 py-8 text-center">
        <CalendarDays size={28} className="mx-auto text-yellow-300" />
        <h3 className="mt-3 text-base font-semibold text-white">Seleccioná el plantel Reserva</h3>
        <p className="mt-1 text-sm text-zinc-400">La carga manual muestra únicamente jugadores que pertenecen al plantel Reserva seleccionado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Minutos de jugadores de Reserva en Juveniles</h3>
            <p className="mt-1 text-xs text-zinc-500">Carga manual por fecha real del partido. No modifica convocatorias ni minutos oficiales de Reserva.</p>
          </div>
          <div className="text-xs text-zinc-500">
            {squadName} · Temporada {entrySeasonId}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Minutos en Juveniles" value={`${totals.minutes.toLocaleString("es-AR")}'`} />
          <Metric label="Participaciones cargadas" value={totals.records} />
          <Metric label="Jugadores con minutos" value={totals.players} />
        </div>
        <p className="mt-3 text-[11px] text-zinc-600">En esta pestaña se aplican los filtros de plantel, temporada, fechas y búsqueda de jugador.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
        <div className="overflow-x-auto">
          <div className="min-w-[920px]">
            <div className="grid grid-cols-[42px_1.6fr_1fr_120px_140px_130px_180px_30px] gap-3 border-b border-zinc-800 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
              <span>#</span>
              <span>Jugador</span>
              <span>Posición</span>
              <span>Partidos Juv.</span>
              <span>Minutos Juv.</span>
              <span>Última fecha</span>
              <span>Acción</span>
              <span />
            </div>
            <div className="divide-y divide-zinc-800/70">
              {rows.map((row) => {
                const key = row.player_id || row.player_name;
                const isOpen = !!openPlayers[key];
                return (
                  <div key={key}>
                    <div className="grid grid-cols-[42px_1.6fr_1fr_120px_140px_130px_180px_30px] items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/30">
                      <span className="text-sm font-semibold text-white">{row.rank}</span>
                      <button type="button" onClick={() => setOpenPlayers((current) => ({ ...current, [key]: !current[key] }))} className="flex min-w-0 items-center gap-3 text-left">
                        <PlayerPhoto player={{ full_name: row.player_name, photo_url: row.photo_url }} alt={row.player_name} className="h-10 w-10 rounded-full border border-zinc-700 object-cover" fallbackClassName="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800" textClassName="text-sm font-bold text-zinc-400" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{row.player_name}</p>
                          <p className="text-xs text-zinc-500">Jugador de Reserva</p>
                        </div>
                      </button>
                      <span className="text-sm text-zinc-300">{row.position}</span>
                      <span className="text-sm text-zinc-300">{row.juvenileMatchesCount}</span>
                      <span className="text-base font-bold text-cyan-300">{row.juvenileMinutes.toLocaleString("es-AR")}'</span>
                      <span className="text-sm text-zinc-300">{formatDate(row.lastYouthDate)}</span>
                      <span>
                        {canEdit ? (
                          <button type="button" onClick={() => setModal({ player: row, record: null })} className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20">
                            <Plus size={14} /> Agregar minutos
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-600">Solo lectura</span>
                        )}
                      </span>
                      <button type="button" onClick={() => setOpenPlayers((current) => ({ ...current, [key]: !current[key] }))} className="text-zinc-400">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    </div>
                    {isOpen && (
                      <div className="bg-zinc-950/60 px-4 pb-4">
                        <div className="overflow-hidden rounded-xl border border-zinc-800">
                          <div className="grid grid-cols-[150px_130px_1fr_180px] gap-3 border-b border-zinc-800 px-4 py-2.5 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                            <span>Fecha del partido</span>
                            <span>Minutos</span>
                            <span>Origen</span>
                            <span>Acciones</span>
                          </div>
                          <div className="divide-y divide-zinc-800/70">
                            {row.youthDetailRows.map((record) => (
                              <div key={record.id} className="grid grid-cols-[150px_130px_1fr_180px] items-center gap-3 px-4 py-3 text-sm text-zinc-300">
                                <span>{formatDate(record.match_date)}</span>
                                <span className="font-semibold text-white">{record.minutes}'</span>
                                <span className="text-zinc-500">Carga manual · Juveniles</span>
                                <div className="flex items-center gap-2">
                                  {canEdit && (
                                    <button type="button" onClick={() => setModal({ player: row, record })} className="inline-flex items-center gap-1 rounded-lg border border-zinc-700 px-2 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                                      <Pencil size={12} /> Editar
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button type="button" disabled={deletingId === record.id} onClick={() => handleDelete(record)} className="inline-flex items-center gap-1 rounded-lg border border-red-500/25 px-2 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                                      <Trash2 size={12} /> Eliminar
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                            {row.youthDetailRows.length === 0 && <div className="px-4 py-4 text-sm text-zinc-500">Todavía no hay minutos de Juveniles cargados para este jugador.</div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {rows.length === 0 && <div className="px-4 py-10 text-center text-sm text-zinc-500">No hay jugadores de Reserva para los filtros seleccionados.</div>}
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <YouthMinutesModal
          player={modal.player}
          record={modal.record}
          squadName={squadName}
          seasonId={entrySeasonId}
          onClose={() => setModal(null)}
          onSaved={async () => {
            setModal(null);
            await onSaved?.();
          }}
        />
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function YouthMinutesModal({ player, record, squadName, seasonId, onClose, onSaved }) {
  const { toast } = useToast();
  const [matchDate, setMatchDate] = useState(record?.match_date || todayInArgentina());
  const [minutes, setMinutes] = useState(record?.minutes == null ? "" : String(record.minutes));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMatchDate(record?.match_date || todayInArgentina());
    setMinutes(record?.minutes == null ? "" : String(record.minutes));
  }, [record]);

  async function submit(event) {
    event.preventDefault();
    const parsedMinutes = Number(minutes);
    if (!matchDate || !Number.isInteger(parsedMinutes) || parsedMinutes < 1 || parsedMinutes > 150) {
      toast({ title: "Completá una fecha válida y minutos enteros entre 1 y 150.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const result = await saveYouthMinutes({
        recordId: record?.id || "",
        playerId: player.player_id,
        squadId: player.squad_id,
        seasonId,
        matchDate,
        minutes: parsedMinutes,
      });
      toast({ title: result.created ? "Minutos en Juveniles agregados." : "Minutos en Juveniles actualizados." });
      await onSaved?.();
    } catch (error) {
      toast({ title: error.message || "No se pudo guardar la carga.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">{record ? "Editar minutos en Juveniles" : "Agregar minutos en Juveniles"}</h2>
            <p className="mt-1 text-sm text-zinc-400">{player.player_name} · {squadName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-white"><X size={18} /></button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Fecha del partido</label>
            <input type="date" required max={todayInArgentina()} value={matchDate} onChange={(event) => setMatchDate(event.target.value)} className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-500" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">Minutos jugados</label>
            <input type="number" required min="1" max="150" step="1" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="Ej.: 75" className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-500" />
          </div>
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs text-cyan-100">
            Se guardará como participación manual en Juveniles, temporada {seasonId}. No se creará un partido ni se modificarán los minutos oficiales de Reserva.
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50">
            {saving ? "Guardando…" : "Guardar minutos"}
          </button>
        </div>
      </form>
    </div>
  );
}
