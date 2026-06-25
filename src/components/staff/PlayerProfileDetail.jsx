import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";

const medicalStatuses = ["Lesionado", "En recuperación", "Seguimiento", "Alta médica"];

export default function PlayerProfileDetail({ player, onClose }) {
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [showMedicalForm, setShowMedicalForm] = useState(false);
  const [medicalForm, setMedicalForm] = useState({
    diagnosis: "",
    status: "Lesionado",
    injury_date: moment().format("YYYY-MM-DD"),
    expected_return: "",
    treatment: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadMedicalRecords();
  }, [player.id]);

  async function loadMedicalRecords() {
    try {
      const records = await base44.entities.MedicalRecord.filter(
        { player_id: player.id },
        "-injury_date",
        100
      );
      setMedicalRecords(records);
    } finally {
      setLoadingRecords(false);
    }
  }

  async function handleAddMedical(e) {
    e.preventDefault();
    try {
      await base44.entities.MedicalRecord.create({
        ...medicalForm,
        player_id: player.id,
        player_name: player.name,
      });
      toast({ title: "Registro médico agregado" });
      setShowMedicalForm(false);
      setMedicalForm({
        diagnosis: "",
        status: "Lesionado",
        injury_date: moment().format("YYYY-MM-DD"),
        expected_return: "",
        treatment: "",
        notes: "",
      });
      await loadMedicalRecords();
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    }
  }

  async function deleteMedical(id) {
    if (!confirm("¿Eliminar este registro médico?")) return;
    await base44.entities.MedicalRecord.delete(id);
    setMedicalRecords((prev) => prev.filter((r) => r.id !== id));
    toast({ title: "Registro eliminado" });
  }

  const statusColors = {
    "Lesionado": "bg-red-500/20 text-red-300 border-red-500/30",
    "En recuperación": "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    "Seguimiento": "bg-blue-500/20 text-blue-300 border-blue-500/30",
    "Alta médica": "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 sticky top-0 bg-zinc-900">
          <div className="flex items-center gap-4">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.name} className="w-12 h-12 rounded-full object-cover border border-zinc-700" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <span className="text-sm font-bold text-zinc-500">{player.name.charAt(0)}</span>
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">{player.name}</h2>
              <p className="text-sm text-zinc-500">{player.position} · #{player.number}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Edad</p>
              <p className="text-white font-semibold">
                {player.birth_date ? moment().diff(moment(player.birth_date), "years") : "—"} años
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Fecha de nacimiento</p>
              <p className="text-white font-semibold">
                {player.birth_date ? moment(player.birth_date).format("DD/MM/YYYY") : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Categoría</p>
              <p className="text-white font-semibold">{player.category || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Pierna hábil</p>
              <p className="text-white font-semibold">{player.dominant_foot || "—"}</p>
            </div>
          </div>

          {/* Historial médico */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400" />
                Historial Médico
              </h3>
              <button
                onClick={() => setShowMedicalForm(!showMedicalForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg transition-colors font-medium"
              >
                <Plus size={14} /> Nuevo registro
              </button>
            </div>

            {/* Formulario de nuevo registro */}
            {showMedicalForm && (
              <form onSubmit={handleAddMedical} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-4 space-y-3">
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Diagnóstico *</label>
                  <Input
                    value={medicalForm.diagnosis}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, diagnosis: e.target.value }))}
                    placeholder="Ej: Desgarro muscular"
                    required
                    className="bg-zinc-900 border-zinc-600 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Fecha de lesión</label>
                    <Input
                      type="date"
                      value={medicalForm.injury_date}
                      onChange={(e) => setMedicalForm((f) => ({ ...f, injury_date: e.target.value }))}
                      className="bg-zinc-900 border-zinc-600 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Retorno estimado</label>
                    <Input
                      type="date"
                      value={medicalForm.expected_return}
                      onChange={(e) => setMedicalForm((f) => ({ ...f, expected_return: e.target.value }))}
                      className="bg-zinc-900 border-zinc-600 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Estado</label>
                  <Select value={medicalForm.status} onValueChange={(v) => setMedicalForm((f) => ({ ...f, status: v }))}>
                    <SelectTrigger className="bg-zinc-900 border-zinc-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {medicalStatuses.map((s) => (
                        <SelectItem key={s} value={s} className="text-white">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Tratamiento</label>
                  <Textarea
                    value={medicalForm.treatment}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, treatment: e.target.value }))}
                    placeholder="Protocolo de tratamiento..."
                    rows={2}
                    className="bg-zinc-900 border-zinc-600 text-white resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Notas</label>
                  <Textarea
                    value={medicalForm.notes}
                    onChange={(e) => setMedicalForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Observaciones adicionales..."
                    rows={2}
                    className="bg-zinc-900 border-zinc-600 text-white resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                    Guardar registro
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowMedicalForm(false)}
                    className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white"
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            )}

            {/* Lista de registros */}
            {loadingRecords ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
              </div>
            ) : medicalRecords.length === 0 ? (
              <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
                <p className="text-zinc-500 text-sm">Sin registros médicos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {medicalRecords.map((record) => (
                  <div key={record.id} className={`border rounded-lg p-4 ${statusColors[record.status] || "bg-zinc-800/50 border-zinc-700"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{record.diagnosis}</p>
                        <p className="text-xs opacity-75 mt-0.5">
                          {record.injury_date ? moment(record.injury_date).format("DD/MM/YYYY") : "Fecha no registrada"}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteMedical(record.id)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {record.treatment && (
                      <div className="mb-2">
                        <p className="text-xs opacity-75 font-medium">Tratamiento:</p>
                        <p className="text-xs opacity-85">{record.treatment}</p>
                      </div>
                    )}
                    {record.expected_return && (
                      <p className="text-xs opacity-75">
                        <span className="font-medium">Retorno estimado:</span> {moment(record.expected_return).format("DD/MM/YYYY")}
                      </p>
                    )}
                    {record.notes && (
                      <p className="text-xs opacity-75 mt-2 italic">"{record.notes}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}