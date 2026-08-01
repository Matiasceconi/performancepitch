import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, Search, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Loader2, RefreshCw, Pencil } from "lucide-react";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { useToast } from "@/components/ui/use-toast";

const STATUS_CFG = {
  verified: { label: "Verificado", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  auto_matched: { label: "Auto", color: "text-blue-400", bg: "bg-blue-500/10", icon: HelpCircle },
  needs_review: { label: "Revisar", color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  unmatched: { label: "Sin match", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  conflict: { label: "Conflicto", color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle },
};

export default function ClubIdentityAdmin() {
  const { isAdmin } = useWorkspace();
  const { toast } = useToast();
  const [mappings, setMappings] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        base44.entities.ExternalTeamMapping.list("provider", 500),
        base44.entities.RivalClub.list("official_name", 500),
      ]);
      setMappings(m);
      setClubs(c);
    } catch (e) {
      toast({ title: "Error al cargar", description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function saveMapping(id, patch) {
    try {
      await base44.entities.ExternalTeamMapping.update(id, { ...patch, manual_override: true, verified_at: new Date().toISOString() });
      toast({ title: "Mapeo actualizado" });
      setEditing(null);
      load();
    } catch (e) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  }

  async function updateClubShield(clubId, shieldUrl) {
    try {
      await base44.entities.RivalClub.update(clubId, { shield_url: shieldUrl });
      toast({ title: "Escudo actualizado" });
      load();
    } catch (e) {
      toast({ title: "Error", description: e?.message, variant: "destructive" });
    }
  }

  const filtered = mappings.filter((m) => {
    if (statusFilter && m.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (m.provider_team_name || "").toLowerCase().includes(q) || (m.rival_club_name || "").toLowerCase().includes(q) || String(m.provider_team_id || "").includes(q);
    }
    return true;
  });

  const stats = {
    total: mappings.length,
    verified: mappings.filter(m => m.status === "verified").length,
    auto: mappings.filter(m => m.status === "auto_matched").length,
    review: mappings.filter(m => m.status === "needs_review").length,
    unmatched: mappings.filter(m => m.status === "unmatched").length,
  };

  if (!isAdmin) {
    return <div className="p-6 text-zinc-500 text-sm">Acceso restringido a administradores.</div>;
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 size={24} className="animate-spin text-zinc-600" /></div>;
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-400" /> Identidad de Clubes</h1>
          <p className="text-xs text-zinc-500 mt-1">Diagnóstico de vinculación API → RivalClub · {stats.total} mapeos</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-800"><RefreshCw size={14} /> Refrescar</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Verificados</p><p className="text-xl font-bold text-emerald-400">{stats.verified}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Auto-match</p><p className="text-xl font-bold text-blue-400">{stats.auto}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Revisar</p><p className="text-xl font-bold text-amber-400">{stats.review}</p></div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3"><p className="text-xs text-zinc-500">Sin match</p><p className="text-xl font-bold text-red-400">{stats.unmatched}</p></div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar equipo..." className="pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white w-56" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-zinc-500 text-xs uppercase bg-zinc-900">
              <th className="text-left p-3 font-semibold">Escudo interno</th>
              <th className="text-left p-3 font-semibold">Club canónico</th>
              <th className="text-left p-3 font-semibold">Nombre API</th>
              <th className="text-left p-3 font-semibold">ID externo</th>
              <th className="text-left p-3 font-semibold">Logo API</th>
              <th className="text-center p-3 font-semibold">Estado</th>
              <th className="text-center p-3 font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const club = clubs.find(c => c.id === m.rival_club_id);
              const cfg = STATUS_CFG[m.status] || STATUS_CFG.unmatched;
              const Icon = cfg.icon;
              return (
                <tr key={m.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                  <td className="p-3">
                    {club?.shield_url ? <img src={club.shield_url} alt="" className="w-8 h-8 object-contain" onError={(e) => { e.target.style.display = "none"; }} /> : <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">{(m.rival_club_name || "?").charAt(0)}</div>}
                  </td>
                  <td className="p-3 text-white font-medium">{m.rival_club_name || "—"}</td>
                  <td className="p-3 text-zinc-300">{m.provider_team_name || "—"}</td>
                  <td className="p-3 text-zinc-500 font-mono text-xs">{m.provider_team_id || "—"}</td>
                  <td className="p-3">
                    {m.provider_logo_url ? <img src={m.provider_logo_url} alt="" className="w-7 h-7 object-contain opacity-60" onError={(e) => { e.target.style.display = "none"; }} /> : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}><Icon size={11} /> {cfg.label}</span>
                  </td>
                  <td className="p-3 text-center">
                    <button onClick={() => setEditing(m)} className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800" title="Corregir"><Pencil size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="p-8 text-center text-zinc-500 text-sm">No hay mapeos para los filtros seleccionados.</div>}
      </div>

      {/* Edit modal */}
      {editing && (
        <EditMappingModal
          mapping={editing}
          clubs={clubs}
          onClose={() => setEditing(null)}
          onSave={saveMapping}
          onUpdateClubShield={updateClubShield}
        />
      )}
    </div>
  );
}

function EditMappingModal({ mapping, clubs, onClose, onSave, onUpdateClubShield }) {
  const [rivalClubId, setRivalClubId] = useState(mapping.rival_club_id || "");
  const [status, setStatus] = useState(mapping.status || "auto_matched");
  const [shieldUrl, setShieldUrl] = useState("");
  const club = clubs.find(c => c.id === rivalClubId);

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold">Corregir vinculación</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="bg-zinc-950 rounded-lg p-3 space-y-1">
            <p className="text-zinc-500 text-xs">Equipo API</p>
            <p className="text-white font-medium">{mapping.provider_team_name}</p>
            <p className="text-zinc-500 text-xs">ID: {mapping.provider_team_id}</p>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Club canónico (RivalClub)</label>
            <select value={rivalClubId} onChange={(e) => setRivalClubId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white">
              <option value="">— Sin vincular —</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.official_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1">Estado</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white">
              {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          {club && (
            <div className="bg-zinc-950 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                {club.shield_url ? <img src={club.shield_url} alt="" className="w-8 h-8 object-contain" /> : <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">{(club.official_name || "?").charAt(0)}</div>}
                <span className="text-white text-sm">{club.official_name}</span>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Escudo interno (URL)</label>
                <div className="flex gap-2">
                  <input value={shieldUrl} onChange={(e) => setShieldUrl(e.target.value)} placeholder={club.shield_url || "Sin escudo"} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs" />
                  <button onClick={() => onUpdateClubShield(club.id, shieldUrl || null)} disabled={!shieldUrl} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs disabled:opacity-40">Guardar escudo</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm">Cancelar</button>
          <button onClick={() => onSave(mapping.id, { rival_club_id: rivalClubId || null, rival_club_name: clubs.find(c => c.id === rivalClubId)?.official_name || null, status })} className="px-4 py-2 rounded-lg bg-white text-zinc-900 font-semibold text-sm">Confirmar</button>
        </div>
      </div>
    </div>
  );
}