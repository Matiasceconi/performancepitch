import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Shield, Upload, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { clubDisplayName, clubMatchesQuery, normalizeClubText, patchFromClub } from "@/lib/rivalClubs";

const RECENT_KEY = "rivalClubPickerRecent";

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function saveRecent(clubId) {
  if (!clubId) return;
  const recent = loadRecent().filter((id) => id !== clubId);
  recent.unshift(clubId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 6)));
}

function ClubShield({ club, size = "h-12 w-12", text = "text-base" }) {
  const [failed, setFailed] = useState(false);
  if (club?.shield_url && !failed) {
    return <img src={club.shield_url} alt={club.official_name} className={`${size} object-contain`} onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${size} rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 font-bold ${text}`}>
      {club?.official_name?.[0]?.toUpperCase() || <Shield size={16} />}
    </div>
  );
}

function ClubGridItem({ club, onChoose }) {
  return (
    <button
      type="button"
      onClick={() => onChoose(club)}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 text-center transition hover:border-yellow-500/50 hover:bg-zinc-800/60"
    >
      <ClubShield club={club} size="h-12 w-12" text="text-base" />
      <span className="block w-full truncate text-xs font-semibold text-white">{club.official_name}</span>
      {club.short_name && <span className="block w-full truncate text-[10px] text-zinc-500">{club.short_name}</span>}
    </button>
  );
}

function ClubGrid({ clubs, onChoose }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {clubs.map((club) => (
        <ClubGridItem key={club.id} club={club} onChoose={onChoose} />
      ))}
    </div>
  );
}

export default function RivalClubPicker({
  clubs = [],
  selectedClubId = "",
  onSelect,
  onCreated,
  label = "Rival",
  placeholder = "Buscar rival...",
  allowClear = false,
  onClear,
  filterMode = false,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newClub, setNewClub] = useState({ official_name: "", short_name: "", shield_url: "" });
  const [uploading, setUploading] = useState(false);
  const searchRef = useRef(null);

  const selected = clubs.find((club) => club.id === selectedClubId);
  const recentIds = useMemo(() => (open ? loadRecent() : []), [open]);
  const recentClubs = useMemo(
    () => recentIds.map((id) => clubs.find((c) => c.id === id)).filter(Boolean),
    [recentIds, clubs]
  );

  const activeClubs = useMemo(
    () =>
      clubs
        .filter((c) => c.active !== false)
        .sort((a, b) => String(a.official_name || "").localeCompare(String(b.official_name || ""))),
    [clubs]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return activeClubs;
    return activeClubs.filter((club) => clubMatchesQuery(club, query));
  }, [activeClubs, query]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCreating(false);
      setNewClub({ official_name: "", short_name: "", shield_url: "" });
    }
  }, [open]);

  function choose(club) {
    saveRecent(club.id);
    onSelect?.(club, patchFromClub(club));
    setOpen(false);
  }

  function handleClear() {
    onClear?.();
    setOpen(false);
  }

  async function uploadShield(file) {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setNewClub((c) => ({ ...c, shield_url: file_url }));
    } finally {
      setUploading(false);
    }
  }

  async function createClub() {
    if (!newClub.official_name.trim()) return;
    const now = new Date().toISOString();
    const club = await base44.entities.RivalClub.create({
      ...newClub,
      normalized_name: normalizeClubText(newClub.official_name),
      active: true,
      aliases: [],
      primary_colors: [],
      created_at: now,
      updated_at: now,
    });
    onCreated?.(club);
    choose(club);
  }

  const trigger = filterMode ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full h-[38px] flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm font-semibold text-white shadow-inner shadow-black/30 hover:border-zinc-700"
    >
      {selected ? (
        <>
          <ClubShield club={selected} size="h-5 w-5" text="text-[10px]" />
          <span className="truncate">{clubDisplayName(selected)}</span>
          {allowClear && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); handleClear(); }}
              className="ml-auto text-zinc-500 hover:text-white"
            >
              <X size={14} />
            </span>
          )}
        </>
      ) : (
        <span className="text-zinc-500">{placeholder}</span>
      )}
    </button>
  ) : selected ? (
    <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-zinc-200">
      <ClubShield club={selected} size="h-10 w-10" text="text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{selected.official_name}</p>
        {selected.short_name && <p className="truncate text-xs text-zinc-500">{selected.short_name}</p>}
      </div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-yellow-300 hover:bg-zinc-800">
        Cambiar
      </button>
      {allowClear && (
        <button type="button" onClick={handleClear} className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800">
          Quitar
        </button>
      )}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="w-full flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-400 hover:border-zinc-600 hover:text-white"
    >
      <Search size={14} />
      {placeholder}
    </button>
  );

  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs text-zinc-400 block">{label}</label>}
      {trigger}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Seleccionar club rival</DialogTitle>
          </DialogHeader>

          {creating ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-yellow-300">Crear nuevo club</p>
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                placeholder="Nombre oficial del club"
                value={newClub.official_name}
                onChange={(e) => setNewClub((c) => ({ ...c, official_name: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                placeholder="Nombre corto (opcional)"
                value={newClub.short_name}
                onChange={(e) => setNewClub((c) => ({ ...c, short_name: e.target.value }))}
              />
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800">
                <Upload size={13} /> {uploading ? "Subiendo..." : "Cargar escudo"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadShield(e.target.files?.[0])} />
              </label>
              {newClub.shield_url && <img src={newClub.shield_url} alt="Escudo" className="h-14 w-14 object-contain" />}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white">
                  Cancelar
                </button>
                <button type="button" onClick={createClub} className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-zinc-950">
                  Guardar y seleccionar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  ref={searchRef}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  placeholder="Buscar por nombre, alias o abreviatura..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {!query && recentClubs.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Usados recientemente</p>
                  <ClubGrid clubs={recentClubs} onChoose={choose} />
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {query ? `${filtered.length} resultado${filtered.length === 1 ? "" : "s"}` : `Todos los clubes (${activeClubs.length})`}
                </p>
                <div className="max-h-[48vh] overflow-y-auto pr-1">
                  {filtered.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/50 p-6 text-center">
                      <p className="text-sm text-zinc-400">No se encontraron clubes para "{query}"</p>
                      <button
                        type="button"
                        onClick={() => { setNewClub((c) => ({ ...c, official_name: query })); setCreating(true); }}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-zinc-950"
                      >
                        <Plus size={13} /> Crear "{query}"
                      </button>
                    </div>
                  ) : (
                    <ClubGrid clubs={filtered} onChoose={choose} />
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => { setNewClub((c) => ({ ...c, official_name: query })); setCreating(true); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-300 hover:text-yellow-200"
              >
                <Plus size={14} /> Crear nuevo club
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}