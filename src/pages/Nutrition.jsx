import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Apple } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const typeColors = {
  "Plan alimentario": "bg-green-500/15 text-green-400",
  "Suplementación": "bg-blue-500/15 text-blue-400",
  "Control de peso": "bg-yellow-500/15 text-yellow-400",
  "Hidratación": "bg-cyan-500/15 text-cyan-400",
  "Observación": "bg-zinc-700 text-zinc-300",
};

export default function Nutrition() {
  const [records, setRecords] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    player_id: "", player_name: "", date: moment().format("YYYY-MM-DD"),
    type: "Plan alimentario", weight_kg: "", body_fat_pct: "",
    calories_target: "", protein_g: "", carbs_g: "", fat_g: "",
    supplements: "", notes: ""
  });
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [recs, pls] = await Promise.all([
        base44.entities.NutritionRecord.list("-date", 100),
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
      const toNum = (v) => (v !== "" ? Number(v) : undefined);
      await base44.entities.NutritionRecord.create({
        ...form,
        player_name: player?.name || form.player_name,
        weight_kg: toNum(form.weight_kg),
        body_fat_pct: toNum(form.body_fat_pct),
        calories_target: toNum(form.calories_target),
        protein_g: toNum(form.protein_g),
        carbs_g: toNum(form.carbs_g),
        fat_g: toNum(form.fat_g),
      });
      toast({ title: "Registro nutricional guardado" });
      setShowForm(false);
      setForm({ player_id: "", player_name: "", date: moment().format("YYYY-MM-DD"), type: "Plan alimentario", weight_kg: "", body_fat_pct: "", calories_target: "", protein_g: "", carbs_g: "", fat_g: "", supplements: "", notes: "" });
      loadAll();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function deleteRecord(id) {
    await base44.entities.NutritionRecord.delete(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{records.length} registros nutricionales</p>
        <Button onClick={() => setShowForm(true)} className="bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus size={15} className="mr-1.5" /> Nuevo registro
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Apple size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Sin registros nutricionales cargados</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {records.map((r) => (
            <div key={r.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold text-sm">{r.player_name}</span>
                  {r.type && <span className={`text-xs px-2 py-0.5 rounded ${typeColors[r.type] || "bg-zinc-700 text-zinc-300"}`}>{r.type}</span>}
                  <span className="text-xs text-zinc-500">{moment(r.date).format("DD/MM/YYYY")}</span>
                </div>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-zinc-500">
                  {r.weight_kg && <span>Peso: <span className="text-zinc-300">{r.weight_kg}kg</span></span>}
                  {r.body_fat_pct && <span>Grasa: <span className="text-zinc-300">{r.body_fat_pct}%</span></span>}
                  {r.calories_target && <span>Cal: <span className="text-zinc-300">{r.calories_target}kcal</span></span>}
                  {r.protein_g && <span>Prot: <span className="text-zinc-300">{r.protein_g}g</span></span>}
                  {r.carbs_g && <span>HC: <span className="text-zinc-300">{r.carbs_g}g</span></span>}
                  {r.fat_g && <span>Grasas: <span className="text-zinc-300">{r.fat_g}g</span></span>}
                </div>
                {r.supplements && <p className="text-xs text-zinc-500 mt-1">Suplementos: {r.supplements}</p>}
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
            <DialogTitle className="text-white">Nuevo registro nutricional</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha</label>
                <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Tipo</label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-zinc-800 border-zinc-700">
                    {["Plan alimentario", "Suplementación", "Control de peso", "Hidratación", "Observación"].map((t) => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-zinc-400 mb-1 block">Peso (kg)</label><Input type="number" step="0.1" value={form.weight_kg} onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">% Grasa corporal</label><Input type="number" step="0.1" value={form.body_fat_pct} onChange={(e) => setForm((f) => ({ ...f, body_fat_pct: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Calorías (kcal)</label><Input type="number" value={form.calories_target} onChange={(e) => setForm((f) => ({ ...f, calories_target: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Proteínas (g)</label><Input type="number" value={form.protein_g} onChange={(e) => setForm((f) => ({ ...f, protein_g: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Hidratos (g)</label><Input type="number" value={form.carbs_g} onChange={(e) => setForm((f) => ({ ...f, carbs_g: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
              <div><label className="text-xs text-zinc-400 mb-1 block">Grasas (g)</label><Input type="number" value={form.fat_g} onChange={(e) => setForm((f) => ({ ...f, fat_g: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" /></div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Suplementos</label>
              <Input value={form.supplements} onChange={(e) => setForm((f) => ({ ...f, supplements: e.target.value }))} placeholder="Ej: Creatina 5g, Whey 30g" className="bg-zinc-800 border-zinc-700 text-white" />
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