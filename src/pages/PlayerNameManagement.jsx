import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Save, AlertCircle, Check, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

export default function PlayerNameManagement() {
  const [players, setPlayers] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [playersData, mappingsData] = await Promise.all([
        base44.entities.Player.list('', 200),
        base44.entities.PlayerNameMapping.list('', 200),
      ]);
      setPlayers(playersData);
      setMappings(mappingsData);
    } catch (e) {
      console.error("Error loading data:", e);
      toast({ title: "Error al cargar datos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdatePlayerName(playerId, newName, photoUrl) {
    try {
      await base44.entities.Player.update(playerId, { name: newName, photo_url: photoUrl });
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, name: newName, photo_url: photoUrl } : p))
      );
      setEditingId(null);
      toast({ title: "Nombre actualizado" });
    } catch (e) {
      toast({ title: "Error al actualizar", variant: "destructive" });
    }
  }

  async function handleSyncMappings() {
    try {
      const response = await base44.functions.invoke('syncPlayerNameMappings', {});
      toast({ title: `Sincronizados: ${response.data.created} nuevos, ${response.data.updated} actualizados` });
      await loadData();
    } catch (e) {
      toast({ title: "Error en sincronización", variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><div className="w-8 h-8 border-4 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Gestión de Nombres de Jugadores</h1>
          <p className="text-zinc-400">Unifica nombres y fotos para mantener consistencia en todo el sistema</p>
        </div>

        {/* Sync Button */}
        <div className="mb-6 flex gap-3">
          <Button 
            onClick={handleSyncMappings} 
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus size={16} /> Sincronizar variaciones de CSV
          </Button>
        </div>

        {/* Players Grid */}
        <div className="grid gap-4">
          {players.map((player) => {
            const mapping = mappings.find((m) => m.player_id === player.id);
            const isEditing = editingId === player.id;

            return (
              <div key={player.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex gap-4 items-start">
                  {/* Foto */}
                  <div className="shrink-0">
                    {player.photo_url ? (
                      <img
                        src={player.photo_url}
                        alt={player.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center border-2 border-zinc-700">
                        <span className="text-xl font-bold text-zinc-500">{player.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-zinc-400 block mb-1">Nombre oficial</label>
                          <Input
                            value={editData.name || player.name}
                            onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))}
                            className="bg-zinc-800 border-zinc-700 text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-zinc-400 block mb-1">URL de foto</label>
                          <Input
                            value={editData.photo_url || player.photo_url || ""}
                            onChange={(e) => setEditData((d) => ({ ...d, photo_url: e.target.value }))}
                            className="bg-zinc-800 border-zinc-700 text-white text-xs"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleUpdatePlayerName(player.id, editData.name || player.name, editData.photo_url || player.photo_url)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm"
                          >
                            <Check size={14} /> Guardar
                          </Button>
                          <Button
                            onClick={() => setEditingId(null)}
                            className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <h3 className="text-lg font-semibold text-white">{player.name}</h3>
                        <p className="text-xs text-zinc-500 mt-1">{player.position || "Sin posición"}</p>

                        {/* Variaciones encontradas */}
                        {mapping && mapping.aliases && mapping.aliases.length > 0 && (
                          <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded">
                            <p className="text-xs font-semibold text-yellow-300 flex items-center gap-1 mb-1">
                              <AlertCircle size={12} /> Variaciones encontradas ({mapping.aliases.length})
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {mapping.aliases.map((alias, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-yellow-500/20 text-yellow-200 px-2 py-1 rounded border border-yellow-500/30"
                                >
                                  {alias}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {!isEditing && (
                    <button
                      onClick={() => {
                        setEditingId(player.id);
                        setEditData({ name: player.name, photo_url: player.photo_url || "" });
                      }}
                      className="p-2 rounded hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {players.length === 0 && (
          <div className="text-center py-12">
            <p className="text-zinc-500">No hay jugadores registrados</p>
          </div>
        )}
      </div>
    </div>
  );
}