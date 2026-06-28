import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Trash2, Heart, Activity, LayoutDashboard } from "lucide-react";
import MedicalDashboard from "@/components/medical/MedicalDashboard";
import { usePlayers } from "@/hooks/usePlayers";
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

const EMPTY_FORM = {
  player_id: "", player_name: "", category_division: "", diagnosis: "",
  affected_limb: "", status: "Lesionado", record_type: "Lesión",
  injury_date: moment().format("YYYY-MM-DD"), expected_return: "",
  days_lost: "", rehab_stage: "", treatment: "", notes: ""
};

export default function Medical() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [form, setForm] = useState(EMPTY_FORM);
  const { toast } = useToast();
  const { players = [], getPlayer } = usePlayers();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const recs = await base44.entities.MedicalRecord.list("-injury_date", 200);
      setRecords(recs);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      const player = players.find((p) => p.id === form.player_id);
      const payload = { ...form, player_name: player?.full_name || player?.name || form.player_name };
      if (!payload.expected_return) delete payload.expected_return;
      if (!payload.days_lost && payload.days_lost !== 0) delete payload.days_lost;
      else payload.days_lost = Number(payload.days_lost);
      await base44.entities.MedicalRecord.create(payload);
      toast({ title: "Registro guardado" });
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadAll();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function deleteRecord(id) {
    await base44.entities.MedicalRecord.delete(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }

  const lesiones = records
    .filter(r => r.record_type === "Lesión" || !r.record_type)
    .sort((a, b) => {
      if (!a.injury_date && !b.injury_date) return 0;
      if (!a.injury_date) return 1;
      if (!b.injury_date) return -1;
      return new Date(b.injury_date) - new Date(a.injury_date);
    });
  const consultas = records.filter(r => r.record_type === "Consulta/Seguimiento");
  const displayed = activeTab === "lesiones" ? lesiones : consultas;

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  const renderTabs = () => (
    <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
      <button
        onClick={() => setActiveTab("dashboard")}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "dashboard" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
      >
        <LayoutDashboard size={13} /> Dashboard
      </button>
      <button
        onClick={() => setActiveTab("lesiones")}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "lesiones" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
      >
        Lesiones ({lesiones.length})
      </button>
      <button
        onClick={() => setActiveTab("consultas")}
        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === "consultas" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}
      >
        Consultas ({consultas.length})
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {renderTabs()}
        <Button onClick={() => setShowForm(true)} className="bg-white text-zinc-900 hover:bg-zinc-200">
          <Plus size={15} className="mr-1.5" /> Nuevo registro
        </Button>
      </div>

      {activeTab === "dashboard" ? (
        <MedicalDashboard />
      ) : displayed.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <Heart size={36} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">Sin registros cargados</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayed.map((r) => {
            const playerData = getPlayer(r.player_id, r.player_name);
            const displayName = playerData?.name || r.player_name;
            const displayPhoto = playerData?.photo_url;
            return (
            <div key={r.id} className={`bg-zinc-900 border rounded-xl p-4 flex items-start gap-4 ${
            r.status === "Lesionado" ? "border-red-500/30" :
            r.status === "En recuperación" ? "border-orange-500/30" :
            r.status === "Seguimiento" ? "border-yellow-500/30" :
            "border-zinc-800"
            }`}>
            {displayPhoto ? (
                <img src={displayPhoto} alt={displayName} className="w-10 h-10 rounded-full object-cover border border-zinc-700 shrink-0 mt-0.5" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-zinc-500">{displayName?.charAt(0)}</span>
                </div>
              )}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-semibold text-sm">{displayName}</span>
                  {r.category_division && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">{r.category_division}</span>
                  )}
                  {r.status && (
                    <span className={`text-xs px-2 py-0.5 rounded border ${statusColors[r.status] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}>{r.status}</span>
                  )}
                  {r.injury_date && (
                    <span className="text-xs text-zinc-600 ml-auto">{moment(r.injury_date).format("DD/MM/YYYY")}</span>
                  )}
                </div>

                {/* Diagnóstico */}
                <p className="text-zinc-200 text-sm font-medium mt-1.5">{r.diagnosis}</p>

                {/* Detalle grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                  {r.affected_limb && r.affected_limb !== "No corresponde" && (
                    <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-zinc-500">MMII afectado</p>
                      <p className="text-xs text-white font-medium mt-0.5">{r.affected_limb}</p>
                    </div>
                  )}
                  {r.injury_date && (
                    <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-zinc-500">Inicio TTO</p>
                      <p className="text-xs text-white font-medium mt-0.5">{moment(r.injury_date).format("DD MMM YYYY")}</p>
                    </div>
                  )}
                  {r.expected_return && (
                    <div className="bg-zinc-800/60 rounded-lg px-3 py-2">
                      <p className="text-xs text-zinc-500">Fin / Retorno</p>
                      <p className="text-xs text-white font-medium mt-0.5">{moment(r.expected_return).format("DD MMM YYYY")}</p>
                    </div>
                  )}
                  {(r.days_lost !== undefined && r.days_lost !== null) && (
                    <div className={`rounded-lg px-3 py-2 ${r.days_lost > 0 ? "bg-orange-500/10" : "bg-zinc-800/60"}`}>
                      <p className="text-xs text-zinc-500">Días perdidos</p>
                      <p className={`text-xs font-bold mt-0.5 ${r.days_lost > 0 ? "text-orange-400" : "text-zinc-400"}`}>{r.days_lost}</p>
                    </div>
                  )}
                </div>

                {/* Etapa RHB */}
                {r.rehab_stage && (
                  <div className="mt-2">
                    <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded">
                      RHB: {r.rehab_stage}
                    </span>
                  </div>
                )}

                {/* Notas */}
                {r.notes && (
                  <p className="text-xs text-zinc-500 mt-2 italic border-l-2 border-zinc-700 pl-2">{r.notes}</p>
                )}
              </div>
              <button onClick={() => deleteRecord(r.id)} className="text-zinc-700 hover:text-red-400 transition-colors shrink-0 mt-1">
                <Trash2 size={14} />
              </button>
            </div>
          );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Nuevo registro médico</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tipo de registro</label>
              <Select value={form.record_type} onValueChange={(v) => setForm(f => ({ ...f, record_type: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  <SelectItem value="Lesión" className="text-white">Lesión</SelectItem>
                  <SelectItem value="Consulta/Seguimiento" className="text-white">Consulta / Seguimiento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Jugador</label>
              <Select value={form.player_id} onValueChange={(v) => setForm(f => ({ ...f, player_id: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue placeholder={players.length > 0 ? "Seleccionar jugador" : "Cargando jugadores..."} /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {Array.isArray(players) && players.length > 0 ? (
                    players.map((p) => <SelectItem key={p.id} value={p.id} className="text-white">{p.name}</SelectItem>)
                  ) : (
                    <SelectItem value="__none__" disabled className="text-zinc-500">Sin jugadores disponibles</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Categoría/División</label>
                <Input value={form.category_division} onChange={e => setForm(f => ({ ...f, category_division: e.target.value }))} placeholder="Ej: 08/Reserva" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">MMII Afectado</label>
                <Input value={form.affected_limb} onChange={e => setForm(f => ({ ...f, affected_limb: e.target.value }))} placeholder="Derecho / Izquierdo" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Diagnóstico / Lesión *</label>
              <Input value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} required placeholder="Ej: Desgarro isquiotibial" className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-800 border-zinc-700">
                  {["Lesionado", "En recuperación", "Seguimiento", "Alta médica"].map((s) => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha inicio TTO</label>
                <Input type="date" value={form.injury_date} onChange={e => setForm(f => ({ ...f, injury_date: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Fecha final TTO</label>
                <Input type="date" value={form.expected_return} onChange={e => setForm(f => ({ ...f, expected_return: e.target.value }))} className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Días perdidos</label>
                <Input type="number" value={form.days_lost} onChange={e => setForm(f => ({ ...f, days_lost: e.target.value }))} placeholder="0" className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Etapa RHB</label>
                <Input value={form.rehab_stage} onChange={e => setForm(f => ({ ...f, rehab_stage: e.target.value }))} placeholder="Retorno con el grupo..." className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Observaciones</label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="bg-zinc-800 border-zinc-700 text-white resize-none" />
            </div>
            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200">Guardar</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}