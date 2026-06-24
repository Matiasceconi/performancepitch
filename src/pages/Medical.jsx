import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Heart, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const statusColors = {
  "Lesionado": "bg-red-500/15 text-red-400 border-red-500/30",
  "En recuperación": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "Seguimiento": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "Alta médica": "bg-green-500/15 text-green-400 border-green-500/30",
};

export default function Medical() {
  const [records, setRecords] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ player_id: "", player_name: "", diagnosis: "", status: "Lesionado", injury_date: moment().format("YYYY-MM-DD"), expected_return: "", treatment: "", notes: "" });
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [recs, pls] = await Promise.all([
        base44.entities.MedicalRecord.list("-injury_date", 100),
        base44.entities.Player.list("name", 100),
      ]);
      setRecords(recs);
      setPlayers(pls);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const player = players.find((p) => p.id === form.player_id);
      await base44.entities.MedicalRecord.create({
        ...form,
        player_name: player?.name || form.player_name,
      });
      toast({ title: "Registro médico guardado" });
      setShowForm(false);
      setForm({ player_id: "", player_name: "", diagnosis: "", status: "Lesionado", injury_date: moment().format("YYYY-MM-DD"), expected_return: "", treatment: "", notes: "" });
      loadAll();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function deleteRecord(id) {
    await base44.entities.MedicalRecord.delete(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{records.length} registros médicos</p>
        <Button onClick={() => setShowForm(true)} className="bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus size={15} className="mr-1.5" /> Nuevo registro
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Heart size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Sin registros médicos cargados</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {records.map((r) => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{r.player_name}</span>
                  {r.status && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[r.status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{r.status}</span>
                  )}
                </div>
                <p className="text-zinc-300 text-sm mt-1">{r.diagnosis}</p>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-zinc-500">
                  {r.injury_date && <span>Lesión: {moment(r.injury_date).format("DD/MM/YYYY")}</span>}
                  {r.expected_return && <span>Retorno estimado: {moment(r.expected_return).format("DD/MM/YYYY")}</span>}
                </div>
                {r.treatment && <p className="text-xs text-zinc-500 mt-1">Tratamiento: {r.treatment}</p>}
                {r.notes && <p className="text-xs text-zinc-600 mt-0.5">{r.notes}</p>}
              </div>
              <button onClick={() => deleteRecord(r.id)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Nuevo registro médico</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Jugador</label>
              <Select value={form.player_id} onValueChange={(v) => setForm((f) => ({ ...f, player_id: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder="Seleccionar jugador" /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {players.map((p) => <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Diagnóstico</label>
              <Input value={form.diagnosis} onChange={(e) => setForm((f) => ({ ...f, diagnosis: e.target.value }))} required placeholder="Ej: Desgarro isquiotibial grado II" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {["Lesionado", "En recuperación", "Seguimiento", "Alta médica"].map((s) => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha lesión</label>
                <Input type="date" value={form.injury_date} onChange={(e) => setForm((f) => ({ ...f, injury_date: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Retorno estimado</label>
                <Input type="date" value={form.expected_return} onChange={(e) => setForm((f) => ({ ...f, expected_return: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tratamiento</label>
              <Input value={form.treatment} onChange={(e) => setForm((f) => ({ ...f, treatment: e.target.value }))} placeholder="Kinesiología, reposo, etc." className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="bg-zinc-800 border-zinc-700 text-white resize-none" />
            </div>
            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200">Guardar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}