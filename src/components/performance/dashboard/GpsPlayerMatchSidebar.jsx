import React, { useState, useMemo } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import PlayerPhoto from "@/components/player/PlayerPhoto";

export default function GpsPlayerMatchSidebar({ players, selectedPlayerId, onSelectPlayer }) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return players;
    const q = search.toLowerCase();
    return players.filter((p) => (p.full_name || "").toLowerCase().includes(q));
  }, [players, search]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  function handleSelect(id) {
    onSelectPlayer(id);
    setMobileOpen(false);
    setSearch("");
  }

  const playerCard = (p, onClick) => (
    <button
      key={p.id}
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors ${
        selectedPlayerId === p.id
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50"
      }`}
    >
      <PlayerPhoto
        player={p}
        className="w-9 h-9 rounded-lg object-cover border border-zinc-700 shrink-0"
        fallbackClassName="w-9 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0"
        textClassName="text-xs font-bold text-zinc-400"
      />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium truncate ${selectedPlayerId === p.id ? "text-white" : "text-zinc-200"}`}>
          {p.full_name}
        </p>
        <p className="text-xs text-zinc-500 truncate">
          {p.position || "Sin posición"}
          {p.jersey_number ? ` · #${p.jersey_number}` : ""}
        </p>
      </div>
    </button>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 shrink-0">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 sticky top-4">
          <div className="relative mb-3">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar jugador..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div className="space-y-1.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="text-xs text-zinc-600 text-center py-4">Sin resultados</p>
            ) : (
              filtered.map((p) => playerCard(p, () => handleSelect(p.id)))
            )}
          </div>
        </div>
      </div>

      {/* Mobile selector */}
      <div className="lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900"
        >
          {selectedPlayer ? (
            <>
              <PlayerPhoto
                player={selectedPlayer}
                className="w-10 h-10 rounded-lg object-cover border border-zinc-700 shrink-0"
                fallbackClassName="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0"
                textClassName="text-sm font-bold text-zinc-400"
              />
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-semibold text-white truncate">{selectedPlayer.full_name}</p>
                <p className="text-xs text-zinc-500">
                  {selectedPlayer.position || ""}
                  {selectedPlayer.jersey_number ? ` · #${selectedPlayer.jersey_number}` : ""}
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-500">Seleccionar jugador</p>
          )}
          <ChevronDown size={18} className="text-zinc-500 shrink-0" />
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-start justify-center pt-4 px-4 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white">Jugadores</h3>
              <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X size={18} />
              </button>
            </div>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar jugador..."
                className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white"
                autoFocus
              />
            </div>
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map((p) => playerCard(p, () => handleSelect(p.id)))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}