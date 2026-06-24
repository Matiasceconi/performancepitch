import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const TOURNAMENTS = [
  "Proyección Apertura",
  "Clausura",
  "Copa Argentina",
  "Juveniles",
  "Amistosos",
  "Torneo Regional",
  "Otro",
];

const EMPTY_FORM = { player_id: "", player_name: "", tournament: "Proyección Apertura", minutes: "", matches: "", notes: "" };

export default function PlayerMinutes() {
  const [records, setRecords] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [r, p] = await Promise.all([
      base44.entities.MinutesRecord.list("-created_date", 500),
      base44.entities.Player.list("-created_date", 100),
    ]);
    setRecords(r);
    setPlayers(p);
    setLoading(false);
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function handlePlayerSelect(playerId) {
    const p = players.find((pl) => pl.id === playerId);
    set("player_id", playerId);
    if (p) set("player_name", p.name);
  }

  async function save() {
    if (!form.player_name || !form.tournament) return;
    const data = { ...form, minutes: Number(form.minutes) || 0, matches: Number(form.matches) || 0 };
    if (editingId) {
      await base44.entities.MinutesRecord.update(editingId, data);
      toast({ title: "Registro actualizado" });
    } else {
      await base44.entities.MinutesRecord.create(data);
      toast({ title: "Registro guardado" });
    }
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditingId(null);
    loadAll();
  }

  function startEdit(r) {
    setForm({ player_id: r.player_id || "", player_name: r.player_name, tournament: r.tournament, minutes: r.minutes || "", matches: r.matches || "", notes: r.notes || "" });
    setEditingId(r.id);
    setShowForm(true);
  }

  async function remove(id) {
    await base44.entities.MinutesRecord.delete(id);
    toast({ title: "Registro eliminado" });
    loadAll();
  }

  const filtered = selectedTournament === "all" ? records : records.filter((r) => r.tournament === selectedTournament);

  // Group by player
  const byPlayer = {};
  filtered.forEach((r) => {
    if (!byPlayer[r.player_name]) byPlayer[r.player_name] = [];
    byPlayer[r.player_name].push(r);
  });

  // Summary per player (totals across filtered tournament)
  const summary = Object.entries(byPlayer).map(([name, rows]) => ({
    name,
    totalMinutes: rows.reduce((a, r) => a + (r.minutes || 0), 0),
    totalMatches: rows.reduce((a, r) => a + (r.matches || 0), 0),
    rows,
  })).sort((a, b) => b.totalMinutes - a.totalMinutes);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Filters + add */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTournament("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedTournament === "all" ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
          >
            Todos
          </button>
          {TOURNAMENTS.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTournament(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedTournament === t ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Agregar minutos
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <p className="text-white text-sm font-semibold">{editingId ? "Editar registro" : "Nuevo registro de minutos"}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Jugador *</label>
              <select
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={form.player_id}
                onChange={(e) => handlePlayerSelect(e.target.value)}
              >
                <option value="">Seleccionar jugador...</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — #{p.number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Torneo *</label>
              <select
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={form.tournament}
                onChange={(e) => set("tournament", e.target.value)}
              >
                {TOURNAMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Minutos jugados</label>
              <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" placeholder="0" value={form.minutes} onChange={(e) => set("minutes", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Partidos jugados</label>
              <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" placeholder="0" value={form.matches} onChange={(e) => set("matches", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Observaciones..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"><X size={14} /> Cancelar</button>
            <button onClick={save} disabled={!form.player_name || !form.tournament} className="px-4 py-2 rounded-lg text-sm bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold disabled:opacity-40 transition-colors flex items-center gap-1"><Check size={14} /> Guardar</button>
          </div>
        </div>
      )}

      {/* Table */}
      {summary.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No hay registros de minutos</p>
          <p className="text-zinc-600 text-xs mt-1">Agregá los minutos de cada jugador por torneo</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800/60 text-zinc-400 text-xs">
                <th className="px-4 py-3 text-left font-semibold">Jugador</th>
                {selectedTournament === "all" && <th className="px-4 py-3 text-left font-semibold">Torneo</th>}
                <th className="px-4 py-3 text-right font-semibold">Partidos</th>
                <th className="px-4 py-3 text-right font-semibold">Minutos</th>
                <th className="px-4 py-3 text-right font-semibold">Prom. min/partido</th>
                <th className="px-4 py-3 text-right font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {selectedTournament === "all"
                ? summary.map((s) => (
                    <tr key={s.name} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{[...new Set(s.rows.map(r => r.tournament))].join(", ")}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{s.totalMatches}</td>
                      <td className="px-4 py-3 text-right font-bold text-yellow-400">{s.totalMinutes}'</td>
                      <td className="px-4 py-3 text-right text-zinc-400">{s.totalMatches > 0 ? Math.round(s.totalMinutes / s.totalMatches) : "—"}'</td>
                      <td className="px-4 py-3 text-right"></td>
                    </tr>
                  ))
                : filtered.map((r) => (
                    <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 text-white font-medium">{r.player_name}</td>
                      <td className="px-4 py-3 text-right text-zinc-300">{r.matches || 0}</td>
                      <td className="px-4 py-3 text-right font-bold text-yellow-400">{r.minutes || 0}'</td>
                      <td className="px-4 py-3 text-right text-zinc-400">{r.matches > 0 ? Math.round(r.minutes / r.matches) : "—"}'</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => startEdit(r)} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors"><Edit2 size={13} /></button>
                          <button onClick={() => remove(r.id)} className="p-1.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}