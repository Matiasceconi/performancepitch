import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Pencil, Trash2, Users, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import PlayerStatusBadge from "@/components/staff/PlayerStatusBadge";

const positions = ["Arquero", "Defensor", "Mediocampista", "Delantero"];
const statuses = ["Disponible", "Lesionado", "En recuperación", "Suspendido", "Permiso", "Selección"];

const positionOrder = { Arquero: 0, Defensor: 1, Mediocampista: 2, Delantero: 3 };

export default function Squad() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", number: "", position: "Defensor", status: "Disponible", injury_detail: "", expected_return: "", photo_url: "" });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadPlayers(); }, []);

  async function loadPlayers() {
    try {
      const data = await base44.entities.Player.list("-created_date", 50);
      setPlayers(data);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ name: "", number: "", position: "Defensor", status: "Disponible", injury_detail: "", expected_return: "", photo_url: "" });
    setShowForm(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name,
      number: String(p.number),
      position: p.position,
      status: p.status || "Disponible",
      injury_detail: p.injury_detail || "",
      expected_return: p.expected_return || "",
      photo_url: p.photo_url || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = { ...form, number: Number(form.number) };
    if (!payload.injury_detail) delete payload.injury_detail;
    if (!payload.expected_return) delete payload.expected_return;
    if (!payload.photo_url) delete payload.photo_url;

    try {
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
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await base44.entities.Player.delete(deleteTarget.id);
      toast({ title: "Jugador eliminado" });
      setDeleteTarget(null);
      setLoading(true);
      loadPlayers();
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" });
    }
  }

  const grouped = positions.map((pos) => ({
    position: pos,
    players: players.filter((p) => p.position === pos).sort((a, b) => a.number - b.number),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

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
                  {g.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 p-3 hover:bg-zinc-800/30 transition-colors">
                      <span className="text-zinc-600 text-sm font-mono w-8 text-center">{p.number}</span>
                      {p.photo_url ? (
                        <img src={p.photo_url} alt={p.name} className="w-9 h-9 rounded-full object-cover border border-zinc-700 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-zinc-500">{p.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium">{p.name}</p>
                        {p.injury_detail && <p className="text-xs text-zinc-500 mt-0.5">{p.injury_detail}</p>}
                      </div>
                      <PlayerStatusBadge status={p.status || "Disponible"} />
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? "Editar jugador" : "Nuevo jugador"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Photo upload */}
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
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setForm((f) => ({ ...f, photo_url: file_url }));
                      } catch {
                        toast({ title: "Error al subir imagen", variant: "destructive" });
                      } finally {
                        setUploadingPhoto(false);
                      }
                    }}
                  />
                </label>
                {form.photo_url && (
                  <button type="button" onClick={() => setForm((f) => ({ ...f, photo_url: "" }))} className="ml-2 text-xs text-zinc-600 hover:text-red-400 transition-colors">Quitar</button>
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Nombre</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Número</label>
                <Input type="number" value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} required className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Posición</label>
                <Select value={form.position} onValueChange={(v) => setForm((f) => ({ ...f, position: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {positions.map((p) => <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {statuses.map((s) => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.status !== "Disponible" && (
              <>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Detalle</label>
                  <Input value={form.injury_detail} onChange={(e) => setForm((f) => ({ ...f, injury_detail: e.target.value }))} placeholder="Ej: Desgarro en isquiotibial" className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Regreso estimado</label>
                  <Input type="date" value={form.expected_return} onChange={(e) => setForm((f) => ({ ...f, expected_return: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
                </div>
              </>
            )}
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
    </div>
  );
}