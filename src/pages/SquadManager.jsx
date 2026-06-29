import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Users, ArrowRightLeft, X, ChevronDown, ChevronUp, Pencil, Trash2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const MEMBERSHIP_STATUSES = [
  { value: "activo",           label: "Activo" },
  { value: "fuera_del_plantel",label: "Fuera del plantel" },
  { value: "sube",             label: "Sube" },
  { value: "baja",             label: "Baja" },
  { value: "préstamo",         label: "Préstamo" },
  { value: "inactivo",         label: "Inactivo" },
];

const STATUS_COLORS = {
  activo:            "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  fuera_del_plantel: "bg-zinc-600/30 text-zinc-400 border-zinc-600",
  sube:              "bg-sky-500/20 text-sky-300 border-sky-500/30",
  baja:              "bg-orange-500/20 text-orange-300 border-orange-500/30",
  préstamo:          "bg-violet-500/20 text-violet-300 border-violet-500/30",
  inactivo:          "bg-zinc-700/30 text-zinc-500 border-zinc-700",
};

// ─── Squad Form ────────────────────────────────────────────────────────────
function SquadForm({ squad, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: "", category: "", season: "", active: true, staff: "", notes: "",
    ...squad,
  });
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-3 bg-zinc-900 border border-zinc-700 rounded-xl p-5">
      <h3 className="text-white font-semibold">{squad ? "Editar plantel" : "Nuevo plantel"}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Nombre *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="ej: Reserva, Primera, Cuarta"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Categoría</label>
          <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            placeholder="ej: 2006, Sub-20"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Temporada</label>
          <input value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}
            placeholder="ej: 2025"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Cuerpo técnico</label>
          <input value={form.staff} onChange={e => setForm(f => ({ ...f, staff: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none" />
        </div>
        <div className="col-span-2 flex items-center gap-3">
          <label className="text-xs text-zinc-400">Activo</label>
          <button type="button" onClick={() => setForm(f => ({ ...f, active: !f.active }))}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.active ? "bg-emerald-500" : "bg-zinc-600"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.active ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors">Cancelar</button>
        <button type="submit" className="px-4 py-2 text-sm bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 transition-colors">Guardar</button>
      </div>
    </form>
  );
}

// ─── Move Player Modal ─────────────────────────────────────────────────────
function MovePlayerModal({ player, membership, squads, onSave, onClose }) {
  const [targetSquadId, setTargetSquadId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("activo");
  const today = moment().format("YYYY-MM-DD");

  async function handleSave() {
    if (!targetSquadId) return;
    const targetSquad = squads.find(s => s.id === targetSquadId);
    await onSave({
      player_id: player.id,
      player_name: player.full_name,
      squad_id: targetSquadId,
      squad_name: targetSquad?.name || "",
      status: membershipStatus,
      effective_from: today,
      reason,
      notes,
    });
    onClose();
  }

  const otherSquads = squads.filter(s => s.active !== false && s.id !== membership?.squad_id);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Mover jugador</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <p className="text-sm text-zinc-300 font-medium">{player.full_name}</p>
        {membership && (
          <p className="text-xs text-zinc-500">Plantel actual: <span className="text-zinc-300">{membership.squad_name}</span></p>
        )}
        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Plantel destino *</label>
            <select value={targetSquadId} onChange={e => setTargetSquadId(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              <option value="">— Seleccionar —</option>
              {otherSquads.map(s => <option key={s.id} value={s.id}>{s.name}{s.category ? ` (${s.category})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Estado en nuevo plantel</label>
            <select value={membershipStatus} onChange={e => setMembershipStatus(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
              {MEMBERSHIP_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Motivo</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="ej: Ascenso, Préstamo, Baja..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">Cancelar</button>
          <button onClick={handleSave} disabled={!targetSquadId}
            className="px-4 py-2 text-sm bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40">
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Player to Squad Modal ─────────────────────────────────────────────
function AddPlayerModal({ squad, players, existingMemberships, onSave, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const activePlayerIds = new Set(
    existingMemberships.filter(m => m.squad_id === squad.id && m.status === "activo").map(m => m.player_id)
  );
  const filtered = players.filter(p =>
    !activePlayerIds.has(p.id) &&
    (p.full_name || "").toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    const today = moment().format("YYYY-MM-DD");
    for (const playerId of selected) {
      const player = players.find(p => p.id === playerId);
      await onSave({
        player_id: playerId,
        player_name: player?.full_name || "",
        squad_id: squad.id,
        squad_name: squad.name,
        status: "activo",
        effective_from: today,
      });
    }
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold">Agregar jugadores a {squad.name}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar jugador..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.length === 0
            ? <p className="text-zinc-600 text-sm text-center py-4">Sin jugadores disponibles</p>
            : filtered.map(p => (
                <button key={p.id} onClick={() => setSelected(prev => {
                  const next = new Set(prev);
                  if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                  return next;
                })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${selected.has(p.id) ? "bg-emerald-500/20 border border-emerald-500/30" : "hover:bg-zinc-800"}`}>
                  {selected.has(p.id) && <Check size={14} className="text-emerald-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{p.full_name}</p>
                    <p className="text-xs text-zinc-500">{p.position}{p.division ? ` · ${p.division}` : ""}</p>
                  </div>
                </button>
              ))}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800">Cancelar</button>
          <button onClick={handleAdd} disabled={selected.size === 0}
            className="px-4 py-2 text-sm bg-white text-zinc-900 font-semibold rounded-lg hover:bg-zinc-200 disabled:opacity-40">
            Agregar {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Squad Detail Card ─────────────────────────────────────────────────────
function SquadCard({ squad, memberships, players, squads, allMemberships, onEditSquad, onDeleteSquad, onAddPlayer, onMovePlayer, onRemoveFromSquad }) {
  const [expanded, setExpanded] = useState(false);
  const activeMembers = memberships.filter(m => m.status === "activo");

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-bold text-base">{squad.name}</h3>
            {squad.category && <span className="text-xs text-zinc-500 border border-zinc-700 rounded-full px-2 py-0.5">{squad.category}</span>}
            {squad.season && <span className="text-xs text-zinc-600">{squad.season}</span>}
            {!squad.active && <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500">Inactivo</span>}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{activeMembers.length} jugadores activos</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onAddPlayer(squad)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg transition-colors border border-emerald-500/30">
            <Plus size={12} /> Agregar
          </button>
          <button onClick={() => onEditSquad(squad)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={() => onDeleteSquad(squad)}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800">
          {memberships.length === 0 ? (
            <p className="text-zinc-600 text-sm text-center py-6">Sin jugadores en este plantel</p>
          ) : (
            <div className="p-3 space-y-1">
              {memberships.map(m => {
                const player = players.find(p => p.id === m.player_id);
                return (
                  <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-zinc-800/50">
                    {player?.photo_url
                      ? <img src={player.photo_url} alt={m.player_name} className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" />
                      : <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-zinc-500">{(m.player_name || "?").charAt(0)}</span>
                        </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{m.player_name}</p>
                      <p className="text-xs text-zinc-500">{player?.position || ""}{m.effective_from ? ` · desde ${moment(m.effective_from).format("DD/MM/YY")}` : ""}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                      {MEMBERSHIP_STATUSES.find(s => s.value === m.status)?.label || m.status}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => onMovePlayer(player || { id: m.player_id, full_name: m.player_name }, m)}
                        title="Mover a otro plantel"
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors">
                        <ArrowRightLeft size={13} />
                      </button>
                      <button onClick={() => onRemoveFromSquad(m)}
                        title="Quitar del plantel"
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────
export default function SquadManager() {
  const [squads, setSquads] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSquad, setEditingSquad] = useState(null);
  const [addPlayerModal, setAddPlayerModal] = useState(null); // squad
  const [moveModal, setMoveModal] = useState(null); // { player, membership }
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [sq, mb, pl] = await Promise.all([
      base44.entities.Squad.list("name", 100),
      base44.entities.SquadMembership.list("-effective_from", 1000),
      base44.entities.Player.list("-created_date", 500),
    ]);
    setSquads(sq);
    setMemberships(mb);
    setPlayers(pl.filter(p => p.active !== false));
    setLoading(false);
  }

  async function handleSaveSquad(data) {
    if (editingSquad) {
      await base44.entities.Squad.update(editingSquad.id, data);
      setSquads(prev => prev.map(s => s.id === editingSquad.id ? { ...s, ...data } : s));
      toast({ title: "Plantel actualizado" });
    } else {
      const created = await base44.entities.Squad.create(data);
      setSquads(prev => [...prev, created]);
      toast({ title: "Plantel creado" });
    }
    setShowForm(false);
    setEditingSquad(null);
  }

  async function handleDeleteSquad(squad) {
    if (!confirm(`¿Eliminar el plantel "${squad.name}"? Se eliminarán también todas las membresías.`)) return;
    const toDelete = memberships.filter(m => m.squad_id === squad.id);
    for (const m of toDelete) await base44.entities.SquadMembership.delete(m.id);
    await base44.entities.Squad.delete(squad.id);
    setSquads(prev => prev.filter(s => s.id !== squad.id));
    setMemberships(prev => prev.filter(m => m.squad_id !== squad.id));
    toast({ title: "Plantel eliminado" });
  }

  async function handleAddMembership(data) {
    const created = await base44.entities.SquadMembership.create(data);
    setMemberships(prev => [...prev, created]);
    toast({ title: `${data.player_name} agregado a ${data.squad_name}` });
  }

  async function handleMovePlayer(data) {
    // Close old membership
    const oldMembership = moveModal?.membership;
    if (oldMembership) {
      const closeDate = moment().subtract(1, "day").format("YYYY-MM-DD");
      await base44.entities.SquadMembership.update(oldMembership.id, {
        status: "fuera_del_plantel",
        effective_to: closeDate,
      });
      setMemberships(prev => prev.map(m => m.id === oldMembership.id
        ? { ...m, status: "fuera_del_plantel", effective_to: closeDate } : m));
    }
    // Create new membership
    const created = await base44.entities.SquadMembership.create(data);
    setMemberships(prev => [...prev, created]);
    toast({ title: `${data.player_name} movido a ${data.squad_name}` });
  }

  async function handleRemoveFromSquad(membership) {
    if (!confirm(`¿Quitar a ${membership.player_name} del plantel ${membership.squad_name}?`)) return;
    await base44.entities.SquadMembership.update(membership.id, {
      status: "fuera_del_plantel",
      effective_to: moment().format("YYYY-MM-DD"),
    });
    setMemberships(prev => prev.map(m => m.id === membership.id
      ? { ...m, status: "fuera_del_plantel", effective_to: moment().format("YYYY-MM-DD") } : m));
    toast({ title: `${membership.player_name} quitado del plantel` });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  const activeSquads = squads.filter(s => s.active !== false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Gestión de Planteles</h1>
          <p className="text-zinc-500 text-sm mt-1">{squads.length} planteles · {memberships.filter(m => m.status === "activo").length} membresías activas</p>
        </div>
        <button onClick={() => { setEditingSquad(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-zinc-900 rounded-lg text-sm font-semibold hover:bg-zinc-200 transition-colors">
          <Plus size={15} /> Nuevo plantel
        </button>
      </div>

      {showForm && (
        <SquadForm
          squad={editingSquad}
          onSave={handleSaveSquad}
          onCancel={() => { setShowForm(false); setEditingSquad(null); }}
        />
      )}

      {squads.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Users size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay planteles creados aún. Creá el primero.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {squads.map(squad => {
            const squadMemberships = memberships.filter(m => m.squad_id === squad.id && m.status === "activo");
            return (
              <SquadCard
                key={squad.id}
                squad={squad}
                memberships={squadMemberships}
                players={players}
                squads={squads}
                allMemberships={memberships}
                onEditSquad={(s) => { setEditingSquad(s); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                onDeleteSquad={handleDeleteSquad}
                onAddPlayer={(s) => setAddPlayerModal(s)}
                onMovePlayer={(player, membership) => setMoveModal({ player, membership })}
                onRemoveFromSquad={handleRemoveFromSquad}
              />
            );
          })}
        </div>
      )}

      {/* Membership history section */}
      {memberships.filter(m => m.status !== "activo").length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-sm font-semibold text-white">Historial de movimientos</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Membresías cerradas o históricas</p>
          </div>
          <div className="p-3 space-y-1 max-h-64 overflow-y-auto">
            {memberships.filter(m => m.status !== "activo").map(m => (
              <div key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{m.player_name}</p>
                  <p className="text-xs text-zinc-500">
                    {m.squad_name}
                    {m.effective_from ? ` · ${moment(m.effective_from).format("DD/MM/YY")}` : ""}
                    {m.effective_to ? ` → ${moment(m.effective_to).format("DD/MM/YY")}` : ""}
                    {m.reason ? ` · ${m.reason}` : ""}
                  </p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[m.status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>
                  {MEMBERSHIP_STATUSES.find(s => s.value === m.status)?.label || m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {addPlayerModal && (
        <AddPlayerModal
          squad={addPlayerModal}
          players={players}
          existingMemberships={memberships}
          onSave={handleAddMembership}
          onClose={() => setAddPlayerModal(null)}
        />
      )}

      {moveModal && (
        <MovePlayerModal
          player={moveModal.player}
          membership={moveModal.membership}
          squads={squads}
          onSave={handleMovePlayer}
          onClose={() => setMoveModal(null)}
        />
      )}
    </div>
  );
}