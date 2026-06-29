import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import moment from "moment";
import "moment/locale/es";
import { useToast } from "@/components/ui/use-toast";
import DailySquadHeader from "@/components/squad/DailySquadHeader";
import DailySquadSummary from "@/components/squad/DailySquadSummary";
import DailySquadGrid from "@/components/squad/DailySquadGrid";
import DailySquadFilters from "@/components/squad/DailySquadFilters";
import DailySquadWhatsApp from "@/components/squad/DailySquadWhatsApp";
import { ALL_TAGS, STATUS_LABELS, STATUS_COLORS, POSITION_GROUPS } from "@/components/squad/squadConstants";
export { ALL_TAGS, STATUS_LABELS, STATUS_COLORS, POSITION_GROUPS };
moment.locale("es");

export default function DailySquad() {
  const [selectedDate, setSelectedDate] = useState(moment().format("YYYY-MM-DD"));
  const [players, setPlayers] = useState([]);
  const [statusMap, setStatusMap] = useState({}); // player_id -> DailySquadStatus record
  const [pendingChanges, setPendingChanges] = useState({}); // player_id -> partial update
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [filters, setFilters] = useState({ team: "", category: "", position: "", status: "", tag: "", search: "" });
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const [allPlayers, dayStatuses] = await Promise.all([
      base44.entities.Player.list("-created_date", 500),
      base44.entities.DailySquadStatus.filter({ date: selectedDate }, "-updated_at", 300),
    ]);
    setPlayers(allPlayers.filter(p => p.active !== false));
    const map = {};
    dayStatuses.forEach(s => { map[s.player_id] = s; });
    setStatusMap(map);
    setPendingChanges({});
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  function getEffectiveStatus(player) {
    const pending = pendingChanges[player.id];
    const saved = statusMap[player.id];
    return {
      status: pending?.status ?? saved?.status ?? "disponible",
      tags: pending?.tags ?? saved?.tags ?? [],
      notes: pending?.notes ?? saved?.notes ?? "",
      team: pending?.team ?? saved?.team ?? player.division ?? "",
      category: pending?.category ?? saved?.category ?? player.category ?? "",
    };
  }

  function applyChange(playerId, changes) {
    setPendingChanges(prev => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), ...changes }
    }));
  }

  async function saveAll() {
    setSaving(true);
    const now = new Date().toISOString();
    const entries = Object.entries(pendingChanges);
    for (const [playerId, changes] of entries) {
      const existing = statusMap[playerId];
      const player = players.find(p => p.id === playerId);
      const effective = getEffectiveStatus(player || { id: playerId });
      const payload = {
        date: selectedDate,
        player_id: playerId,
        player_name: player?.full_name || "",
        team: effective.team,
        category: effective.category,
        position: player?.position || "",
        updated_at: now,
        ...changes,
      };
      if (existing) {
        await base44.entities.DailySquadStatus.update(existing.id, payload);
        setStatusMap(prev => ({ ...prev, [playerId]: { ...existing, ...payload } }));
      } else {
        const created = await base44.entities.DailySquadStatus.create(payload);
        setStatusMap(prev => ({ ...prev, [playerId]: created }));
      }
    }
    setPendingChanges({});
    setSaving(false);
    toast({ title: `✓ ${entries.length} estado(s) guardados` });
  }

  async function copyYesterday() {
    const yesterday = moment(selectedDate).subtract(1, "day").format("YYYY-MM-DD");
    const prevStatuses = await base44.entities.DailySquadStatus.filter({ date: yesterday }, "-updated_at", 300);
    if (prevStatuses.length === 0) {
      toast({ title: "Sin estados del día anterior", variant: "destructive" }); return;
    }
    const changes = {};
    prevStatuses.forEach(s => {
      changes[s.player_id] = { status: s.status, tags: s.tags, notes: s.notes, team: s.team, category: s.category };
    });
    setPendingChanges(prev => ({ ...prev, ...changes }));
    toast({ title: `Copiados ${prevStatuses.length} estados de ayer` });
  }

  function markAllAvailable() {
    const changes = {};
    players.forEach(p => { changes[p.id] = { status: "disponible", tags: [], notes: "" }; });
    setPendingChanges(prev => ({ ...prev, ...changes }));
    toast({ title: "Todos marcados como disponibles" });
  }

  function exportSummary() {
    const rows = players.map(p => {
      const s = getEffectiveStatus(p);
      return `${p.full_name} | ${p.position} | ${STATUS_LABELS[s.status] || s.status} | ${(s.tags || []).join(", ")} | ${s.notes || ""}`;
    });
    const text = `Estado del plantel — ${moment(selectedDate).format("DD/MM/YYYY")}\n\n` + rows.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `plantel-${selectedDate}.txt`; a.click();
    URL.revokeObjectURL(url);
  }

  const hasPending = Object.keys(pendingChanges).length > 0;

  // Filtered players
  const filteredPlayers = players.filter(p => {
    const s = getEffectiveStatus(p);
    if (filters.team && s.team !== filters.team) return false;
    if (filters.category && s.category !== filters.category) return false;
    if (filters.position && p.position !== filters.position) return false;
    if (filters.status && s.status !== filters.status) return false;
    if (filters.tag && !(s.tags || []).includes(filters.tag)) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!(p.full_name || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const summaryData = {
    total: players.length,
    disponibles: players.filter(p => getEffectiveStatus(p).status === "disponible").length,
    lesionados: players.filter(p => getEffectiveStatus(p).status === "lesionado").length,
    molestias: players.filter(p => getEffectiveStatus(p).status === "molestia").length,
    diferenciados: players.filter(p => getEffectiveStatus(p).status === "diferenciado").length,
    suspendidos: players.filter(p => getEffectiveStatus(p).status === "suspendido").length,
    bajan: players.filter(p => getEffectiveStatus(p).status === "bajó").length,
    suben: players.filter(p => getEffectiveStatus(p).status === "subió").length,
    convocados: players.filter(p => getEffectiveStatus(p).status === "convocado").length,
    ausentes: players.filter(p => getEffectiveStatus(p).status === "ausente").length,
  };

  return (
    <div className="space-y-5">
      <DailySquadHeader
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        hasPending={hasPending}
        saving={saving}
        onSave={saveAll}
        onCopyYesterday={copyYesterday}
        onMarkAllAvailable={markAllAvailable}
        onExport={exportSummary}
        onWhatsApp={() => setShowWhatsApp(true)}
      />

      {!loading && <DailySquadSummary data={summaryData} />}

      <DailySquadFilters
        players={players}
        filters={filters}
        setFilters={setFilters}
        getEffectiveStatus={getEffectiveStatus}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <DailySquadGrid
          players={filteredPlayers}
          getEffectiveStatus={getEffectiveStatus}
          applyChange={applyChange}
          pendingChanges={pendingChanges}
          selectedDate={selectedDate}
        />
      )}

      {showWhatsApp && (
        <DailySquadWhatsApp
          players={players}
          getEffectiveStatus={getEffectiveStatus}
          selectedDate={selectedDate}
          onClose={() => setShowWhatsApp(false)}
        />
      )}
    </div>
  );
}