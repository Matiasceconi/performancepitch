import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle, Check, Link2, Trash2, User, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

export default function MedicalRecordsReconciliation() {
  const [orphanRecords, setOrphanRecords] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      const [medRecords, allPlayers] = await Promise.all([
        base44.entities.MedicalRecord.list("-injury_date", 500),
        base44.entities.Player.list("", 1000),
      ]);

      // Filtrar registros sin player_id
      const orphans = medRecords.filter(r => !r.player_id);
      setOrphanRecords(orphans);
      setPlayers(allPlayers);
      setLoading(false);
    }
    load();
  }, []);

  // Normalizar nombres para búsqueda
  const normalize = (str) => {
    return (str || "").toLowerCase().trim();
  };

  // Sugestions: buscar coincidencias parciales
  const findSuggestions = (recordName) => {
    const norm = normalize(recordName);
    return players
      .filter(p => {
        const fullName = normalize(p.full_name || "");
        const lastName = normalize(p.last_name || "");
        return fullName.includes(norm) || lastName.includes(norm) || norm.includes(lastName);
      })
      .slice(0, 5);
  };

  // Asignar un registro a un jugador
  async function assignRecordToPlayer(recordId, playerId) {
    if (!playerId) return;
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    await base44.entities.MedicalRecord.update(recordId, {
      player_id: playerId,
      player_name: player.full_name,
    });

    setOrphanRecords(prev => prev.filter(r => r.id !== recordId));
    setAssignments(prev => {
      const newAssign = { ...prev };
      delete newAssign[recordId];
      return newAssign;
    });

    toast({ title: `Asignado a ${player.full_name}` });
  }

  // Eliminar un registro sin asignar
  async function deleteRecord(recordId) {
    if (!confirm("¿Eliminar este registro médico?")) return;
    await base44.entities.MedicalRecord.delete(recordId);
    setOrphanRecords(prev => prev.filter(r => r.id !== recordId));
    toast({ title: "Registro eliminado" });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-blue-500/20">
            <AlertCircle size={24} className="text-blue-400" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white mb-1">Reconciliación de Registros Médicos</h1>
            <p className="text-zinc-400">
              Encontrados <span className="font-bold text-blue-400">{orphanRecords.length}</span> registros médicos sin jugador asociado. Asígnalos manualmente a los jugadores del plantel o elimínalos si son duplicados.
            </p>
          </div>
        </div>
      </div>

      {orphanRecords.length === 0 ? (
        <div className="bg-zinc-900 border border-green-500/30 rounded-xl p-8 text-center">
          <Check size={32} className="text-green-500 mx-auto mb-2" />
          <p className="text-white font-semibold">¡Todos los registros están asociados!</p>
          <p className="text-zinc-400 text-sm mt-1">No hay registros médicos huérfanos</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orphanRecords.map(record => {
            const suggestions = findSuggestions(record.player_name);
            const assigned = assignments[record.id];

            return (
              <div key={record.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="space-y-4">
                  {/* Record info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Nombre en registro</p>
                      <p className="text-white font-semibold text-lg">{record.player_name}</p>
                      <p className="text-xs text-zinc-600 mt-1">{record.category_division || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Diagnóstico / Lesión</p>
                      <p className="text-zinc-300 text-sm">{record.diagnosis}</p>
                      {record.injury_date && (
                        <p className="text-xs text-zinc-600 mt-1">{moment(record.injury_date).format("DD/MM/YYYY")}</p>
                      )}
                    </div>
                  </div>

                  {/* Assignment selector */}
                  <div className="bg-zinc-800/50 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-zinc-400 font-medium">Asignar a jugador:</p>
                    <div className="flex gap-2">
                      <Select value={assigned || ""} onValueChange={(val) => setAssignments(prev => ({ ...prev, [record.id]: val }))}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-700 text-white flex-1">
                          <SelectValue placeholder="Seleccionar jugador..." />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-800 border-zinc-700">
                          {/* Sugerencias primero */}
                          {suggestions.length > 0 && (
                            <>
                              {suggestions.map(p => (
                                <SelectItem key={p.id} value={p.id} className="text-white">
                                  {p.full_name} {p.jersey_number ? `(#${p.jersey_number})` : ""}
                                </SelectItem>
                              ))}
                              <div className="border-t border-zinc-700 my-1" />
                            </>
                          )}
                          {/* Todos los jugadores */}
                          {players.map(p => (
                            <SelectItem key={p.id} value={p.id} className="text-white">
                              {p.full_name} {p.jersey_number ? `(#${p.jersey_number})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => assignRecordToPlayer(record.id, assigned)}
                        disabled={!assigned}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Link2 size={16} />
                      </Button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-zinc-800">
                    <Button
                      onClick={() => deleteRecord(record.id)}
                      variant="destructive"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Trash2 size={14} /> Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}