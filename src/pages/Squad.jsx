import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Users, Camera, Cake, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import PlayerStatusBadge from "@/components/staff/PlayerStatusBadge";
import PlayerProfileDetail from "@/components/staff/PlayerProfileDetail";
import moment from "moment";

const positions = ["Arquero", "Defensor", "Mediocampista", "Delantero"];
const statuses = ["Disponible", "Lesionado", "En recuperación", "Suspendido", "Permiso", "Selección"];
const divisions = ["Primera", "Reserva", "Cuarta División", "Quinta División"];
const dominantFeet = ["Derecha", "Izquierda", "Ambidiestro"];
const seasonPeriods = ["En competencia", "Pretemporada", "Transitorio"];

const TABS = [
  { id: "reserva",   label: "Reserva" },
  { id: "primera",   label: "Primera" },
  { id: "cuarta",    label: "4ª División" },
  { id: "quinta",    label: "5ª División" },
];

const EMPTY_FORM = {
  name: "", number: "", position: "Defensor", status: "Disponible",
  division: "Primera", is_reserva: false,
  season_period: "",
  injury_detail: "", expected_return: "", photo_url: "",
  birth_date: "", category: "", document_number: "",
  dominant_foot: "", birth_place: "", current_residence: "", club_housing: false, has_contract: false,
};

function isBirthdayToday(birth_date) {
  if (!birth_date) return false;
  const today = moment();
  const bd = moment(birth_date);
  return bd.month() === today.month() && bd.date() === today.date();
}

function calcAge(birth_date) {
  if (!birth_date) return null;
  return moment().diff(moment(birth_date), "years");
}

export default function Squad() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activeTab, setActiveTab] = useState("reserva");
  const { toast } = useToast();

  useEffect(() => { loadPlayers(); }, []);

  async function loadPlayers() {
    const data = await base44.entities.Player.list("-created_date", 100);
    setPlayers(data);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name || "",
      number: String(p.number || ""),
      position: p.position || "Defensor",
      status: p.status || "Disponible",
      division: p.division || "Primera",
      is_reserva: p.is_reserva || false,
      season_period: p.season_period || "",
      injury_detail: p.injury_detail || "",
      expected_return: p.expected_return || "",
      photo_url: p.photo_url || "",
      birth_date: p.birth_date || "",
      category: p.category || "",
      document_number: p.document_number || "",
      dominant_foot: p.dominant_foot || "",
      birth_place: p.birth_place || "",
      current_residence: p.current_residence || "",
      club_housing: p.club_housing || false,
      has_contract: p.has_contract || false,
    });
    setShowForm(true);
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, number: form.number ? Number(form.number) : undefined };
    // clean empty strings
    Object.keys(payload).forEach((k) => { if (payload[k] === "") delete payload[k]; });
    if (editing) {
      await base44.entities.Player.update(editing.id, payload);
      toast({ title: "Jugador actualizado" });
    } else {
      await base44.entities.Player.create(payload);
      toast({ title: "Jugador agregado" });
    }
    setShowForm(false);
    setLoading(true);
    loadPlayers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await base44.entities.Player.delete(deleteTarget.id);
    toast({ title: "Jugador eliminado" });
    setDeleteTarget(null);
    setLoading(true);
    loadPlayers();
  }

  function filterByTab(tab) {
    switch (tab) {
      case "reserva": return players.filter((p) => p.is_reserva);
      case "primera": return players.filter((p) => !p.is_reserva && (p.division || "Primera") === "Primera");
      case "cuarta":  return players.filter((p) => !p.is_reserva && p.division === "Cuarta División");
      case "quinta":  return players.filter((p) => !p.is_reserva && p.division === "Quinta División");
      default: return [];
    }
  }

  const activePlayers = filterByTab(activeTab);

  const grouped = positions.map((pos) => ({
    position: pos,
    players: activePlayers.filter((p) => p.position === pos).sort((a, b) => (a.number || 0) - (b.number || 0)),
  }));

  const countByTab = (tab) => filterByTab(tab).length;

  const birthdayPlayers = players.filter((p) => isBirthdayToday(p.birth_date));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Plantel</h1>
          <p className="text-zinc-500 text-sm mt-1">Estado de disponibilidad de los jugadores</p>
        </div>
        <Button onClick={openNew} className="bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus size={16} className="mr-1.5" /> Agregar jugador
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            {label} ({countByTab(id)})
          </button>
        ))}
      </div>

      {/* Birthday alert */}
      {birthdayPlayers.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
          <Cake size={20} className="text-yellow-400 shrink-0" />
          <div>
            <p className="text-yellow-300 font-semibold text-sm">
              🎉 ¡Hoy es el cumpleaños de {birthdayPlayers.map((p) => p.name).join(", ")}!
            </p>
            <p className="text-yellow-400/70 text-xs mt-0.5">
              {birthdayPlayers.map((p) => `${p.name} cumple ${calcAge(p.birth_date)} años`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      {players.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Users size={40} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No hay jugadores en el plantel</p>
          <Button onClick={openNew} variant="outline" className="mt-4 border-zinc-700 text-zinc-300 hover:bg-zinc-800">
            Agregar primer jugador
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) =>
            g.players.length > 0 ? (
              <div key={g.position}>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 pl-1">
                  {g.position}s ({g.players.length})
                </h2>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800/50">
                  {g.players.map((p) => {
                    const isToday = isBirthdayToday(p.birth_date);
                    const age = calcAge(p.birth_date);
                    return (
                      <div key={p.id} onClick={() => setSelectedPlayer(p)} className={`flex items-center gap-4 p-3 hover:bg-zinc-800/30 transition-colors cursor-pointer ${isToday ? "bg-yellow-500/5" : ""}`}>
                        <span className="text-zinc-600 text-sm font-mono w-8 text-center">{p.number}</span>
                        {p.photo_url ? (
                          <img src={p.photo_url} alt={p.name} className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-zinc-500">{p.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-white font-medium">{p.name}</p>
                            {isToday && <Cake size={14} className="text-yellow-400" title="¡Cumpleaños hoy!" />}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            {age !== null && <span className="text-xs text-zinc-500">{age} años</span>}
                            {p.category && <span className="text-xs text-zinc-600">Cat. {p.category}</span>}
                            {p.dominant_foot && <span className="text-xs text-zinc-600">{p.dominant_foot}</span>}
                            {p.club_housing && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">Pensión</span>}
                            {p.has_contract && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">Contrato</span>}
                            {p.injury_detail && <span className="text-xs text-zinc-500">{p.injury_detail}</span>}
                          </div>
                        </div>
                        <Select value={p.status || "Disponible"} onValueChange={async (v) => {
                          await base44.entities.Player.update(p.id, { status: v });
                          setPlayers((prev) => prev.map((pl) => pl.id === p.id ? { ...pl, status: v } : pl));
                        }}>
                          <SelectTrigger className="h-auto py-0.5 px-2 border-0 bg-transparent text-xs w-auto focus:ring-0 shadow-none gap-1">
                            <PlayerStatusBadge status={p.status || "Disponible"} />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-800 border-zinc-700">
                            {statuses.map((s) => <SelectItem key={s} value={s} className="text-white text-xs">{s}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      {/* FORM DIALOG */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? "Editar jugador" : "Nuevo jugador"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Foto" className="w-16 h-16 rounded-full object-cover border border-zinc-700" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <Camera size={20} className="text-zinc-600" />
                </div>
              )}
              <div className="flex-1">
                <label className="text-xs text-zinc-400 mb-1 block">Foto del jugador</label>
                <label className="cursor-pointer inline-flex items-center gap-2 text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 transition-colors rounded-md px-3 py-1.5">
                  {uploadingPhoto ? "Subiendo..." : "Subir imagen"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploadingPhoto(true);
                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                      set("photo_url", file_url);
                      setUploadingPhoto(false);
                    }}
                  />
                </label>
                {form.photo_url && (
                  <button type="button" onClick={() => set("photo_url", "")} className="ml-2 text-xs text-zinc-600 hover:text-red-400 transition-colors">Quitar</button>
                )}
              </div>
            </div>

            {/* Nombre */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Nombre completo *</label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} required className="bg-zinc-800 border-zinc-700 text-white" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Número</label>
                <Input type="number" value={form.number} onChange={(e) => set("number", e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" placeholder="Opcional" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Categoría</label>
                <Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Ej: 2005, Sub-20" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Posición *</label>
                <Select value={form.position} onValueChange={(v) => set("position", v)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {positions.map((p) => <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Pierna hábil</label>
                <Select value={form.dominant_foot} onValueChange={(v) => set("dominant_foot", v)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {dominantFeet.map((f) => <SelectItem key={f} value={f} className="text-white">{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha de nacimiento</label>
                <Input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Nº de documento</label>
                <Input value={form.document_number} onChange={(e) => set("document_number", e.target.value)} placeholder="DNI / Pasaporte" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Lugar de nacimiento</label>
                <Input value={form.birth_place} onChange={(e) => set("birth_place", e.target.value)} placeholder="Ciudad, País" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Residencia actual</label>
                <Input value={form.current_residence} onChange={(e) => set("current_residence", e.target.value)} placeholder="Ciudad, Barrio" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Período de temporada</label>
              <Select value={form.season_period || "__none__"} onValueChange={(v) => set("season_period", v === "__none__" ? "" : v)}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Sin período" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="__none__" className="text-zinc-400">Sin período</SelectItem>
                  {seasonPeriods.map((p) => <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">División</label>
                <Select value={form.division} onValueChange={(v) => set("division", v)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {divisions.map((d) => <SelectItem key={d} value={d} className="text-white">{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {statuses.map((s) => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.status !== "Disponible" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Detalle</label>
                  <Input value={form.injury_detail} onChange={(e) => set("injury_detail", e.target.value)} placeholder="Ej: Desgarro isquiotibial" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Regreso estimado</label>
                  <Input type="date" value={form.expected_return} onChange={(e) => set("expected_return", e.target.value)} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_reserva" checked={form.is_reserva} onChange={(e) => set("is_reserva", e.target.checked)} className="w-4 h-4 rounded border-zinc-700" />
                <label htmlFor="is_reserva" className="text-xs text-purple-300 cursor-pointer font-medium">Pertenece al plantel de Reserva</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="club_housing" checked={form.club_housing} onChange={(e) => set("club_housing", e.target.checked)} className="w-4 h-4 rounded border-zinc-700" />
                <label htmlFor="club_housing" className="text-xs text-zinc-400 cursor-pointer">Reside en la pensión del club</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="has_contract" checked={form.has_contract} onChange={(e) => set("has_contract", e.target.checked)} className="w-4 h-4 rounded border-zinc-700" />
                <label htmlFor="has_contract" className="text-xs text-zinc-400 cursor-pointer">Tiene contrato</label>
              </div>
            </div>

            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200">
              {editing ? "Guardar cambios" : "Agregar jugador"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Eliminar jugador?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Se eliminará a {deleteTarget?.name} del plantel. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedPlayer && (
        <PlayerProfileDetail
          player={selectedPlayer}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  );
}