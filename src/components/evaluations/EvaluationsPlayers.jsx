import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Loader2, AlertCircle, Users } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import PlayerSelector from "@/components/evaluations/PlayerSelector";
import PlayerProfileHeader from "@/components/evaluations/PlayerProfileHeader";
import PlayerProfileModeSelector from "@/components/evaluations/PlayerProfileModeSelector";
import SummaryMode from "@/components/evaluations/modes/SummaryMode";
import EvolutionMode from "@/components/evaluations/modes/EvolutionMode";
import CompareSessionsMode from "@/components/evaluations/modes/CompareSessionsMode";
import BatteryMode from "@/components/evaluations/modes/BatteryMode";
import AsymmetryMode from "@/components/evaluations/modes/AsymmetryMode";
import SquadComparisonMode from "@/components/evaluations/modes/SquadComparisonMode";
import PersonalChangeMapMode from "@/components/evaluations/modes/PersonalChangeMapMode";
import FullDataMode from "@/components/evaluations/modes/FullDataMode";

export default function EvaluationsPlayers({ selectedPlayerId, onSelectPlayer }) {
  const { activeSquad } = useWorkspace();
  const [playersList, setPlayersList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [mode, setMode] = useState("resumen");
  const [showMobileSelector, setShowMobileSelector] = useState(false);

  // ── Load player list ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadList() {
      setLoadingList(true);
      try {
        const [results, players, memberships] = await Promise.all([
          base44.entities.EvaluationResult.list("assessment_date", 1000),
          base44.entities.Player.list("full_name", 1000),
          base44.entities.SquadMembership.list("created_date", 1000).catch(() => []),
        ]);

        const playerMap = new Map(players.map((p) => [p.id, p]));
        // Determine squad player IDs
        const squadPlayerIds = new Set(
          activeSquad?.id
            ? memberships.filter((m) => m.squad_id === activeSquad.id).map((m) => m.player_id)
            : []
        );

        // Group results by player
        const byPlayer = new Map();
        for (const r of results) {
          const key = r.player_id || `csv:${r.player_name_csv}`;
          if (!byPlayer.has(key)) {
            const player = r.player_id ? playerMap.get(r.player_id) : null;
            byPlayer.set(key, {
              id: r.player_id || key,
              realId: r.player_id || null,
              name: player?.full_name || r.player_name_csv || "Sin vincular",
              position: player?.position || "—",
              photoUrl: player?.photo_url || null,
              linked: !!r.player_id,
              linkValid: r.player_id ? playerMap.has(r.player_id) : false,
              tests: new Set(),
              lastDate: r.assessment_date,
              resultCount: 0,
              pendingCount: r.linking_status === "pending" || r.linking_status === "collision" ? 1 : 0,
            });
          }
          const p = byPlayer.get(key);
          p.tests.add(r.test_key);
          p.resultCount++;
          if (r.assessment_date > p.lastDate) p.lastDate = r.assessment_date;
          if (r.linking_status === "pending" || r.linking_status === "collision") p.pendingCount++;
        }

        const list = [...byPlayer.values()].map((p) => ({
          ...p,
          tests: [...p.tests].sort(),
        }));

        // Sort: linked first, then by name
        list.sort((a, b) => {
          if (a.linked !== b.linked) return b.linked - a.linked;
          return a.name.localeCompare(b.name);
        });

        if (!cancelled) setPlayersList(list);
      } catch (e) {
        console.error("loadList", e);
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    }
    loadList();
    return () => { cancelled = true; };
  }, [activeSquad?.id]);

  // ── Auto-select first player if none selected ────────────────────────────
  useEffect(() => {
    if (!selectedPlayerId && playersList.length && !loadingList) {
      const firstLinked = playersList.find((p) => p.linked && p.linkValid);
      if (firstLinked) onSelectPlayer(firstLinked.realId);
    }
  }, [playersList, selectedPlayerId, loadingList, onSelectPlayer]);

  // ── Load profile when a player is selected ──────────────────────────────
  const fetchProfile = useCallback(async (pid) => {
    if (!pid) return;
    setLoadingProfile(true);
    setProfileError("");
    try {
      const resp = await base44.functions.invoke("getEvaluationPlayerProfile", {
        player_id: pid,
        squad_id: activeSquad?.id,
        period: "all",
      });
      setProfileData(resp.data);
    } catch (e) {
      setProfileError(e.message || "Error al cargar el perfil");
      setProfileData(null);
    } finally {
      setLoadingProfile(false);
    }
  }, [activeSquad?.id]);

  useEffect(() => {
    if (selectedPlayerId) fetchProfile(selectedPlayerId);
    else { setProfileData(null); }
  }, [selectedPlayerId, fetchProfile]);

  // ── Prev/next navigation ─────────────────────────────────────────────────
  const linkedList = useMemo(() => playersList.filter((p) => p.linked && p.linkValid), [playersList]);
  const currentIdx = linkedList.findIndex((p) => p.realId === selectedPlayerId);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx >= 0 && currentIdx < linkedList.length - 1;

  const handlePrev = () => { if (hasPrev) onSelectPlayer(linkedList[currentIdx - 1].realId); };
  const handleNext = () => { if (hasNext) onSelectPlayer(linkedList[currentIdx + 1].realId); };

  if (loadingList) return <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>;

  if (!playersList.length) {
    return (
      <div className="py-12 text-center">
        <Users size={28} className="text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 text-sm">No hay jugadores con evaluaciones</p>
      </div>
    );
  }

  const selectedPlayerMeta = playersList.find((p) => p.realId === selectedPlayerId);
  const activeSignals = profileData?.signals?.filter((s) => s.signal === "moderate" || s.signal === "important").length || 0;
  const baselineSessions = profileData ? Math.max(0, ...Object.values(profileData.baselines || {}).map((b) => b.sessions_used || 0)) : 0;
  const lastSession = profileData?.sessions?.[0] || null;

  return (
    <div className="space-y-3">
      {/* Desktop: two panels */}
      <div className="hidden lg:grid grid-cols-[300px_1fr] gap-4">
        <PlayerSelector
          players={playersList}
          selectedId={selectedPlayerId}
          onSelect={onSelectPlayer}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
        />
        <div className="space-y-3 min-w-0">
          {loadingProfile && <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>}
          {profileError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertCircle size={18} className="text-red-400" />
              <p className="text-sm text-red-300">{profileError}</p>
            </div>
          )}
          {profileData && !loadingProfile && (
            <>
              <PlayerProfileHeader
                player={profileData.player}
                sessionCount={profileData.sessions?.length || 0}
                lastSession={lastSession}
                baselineSessions={baselineSessions}
                activeSignals={activeSignals}
              />
              <PlayerProfileModeSelector active={mode} onChange={setMode} />
              <div className="min-h-[300px]">
                {mode === "resumen" && <SummaryMode data={profileData} />}
                {mode === "evolucion" && <EvolutionMode data={profileData} />}
                {mode === "comparar" && <CompareSessionsMode data={profileData} />}
                {mode === "bateria" && <BatteryMode data={profileData} />}
                {mode === "asimetrias" && <AsymmetryMode data={profileData} />}
                {mode === "plantel" && <SquadComparisonMode data={profileData} />}
                {mode === "mapa" && <PersonalChangeMapMode data={profileData} />}
                {mode === "datos" && <FullDataMode data={profileData} />}
              </div>
            </>
          )}
          {!selectedPlayerId && !loadingProfile && (
            <div className="py-12 text-center">
              <Users size={28} className="text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-500 text-sm">Seleccioná un jugador del panel izquierdo</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: compact card + selector panel */}
      <div className="lg:hidden space-y-3">
        {selectedPlayerMeta && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-center gap-3">
            {selectedPlayerMeta.linked && selectedPlayerMeta.photoUrl ? (
              <img src={selectedPlayerMeta.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover border border-zinc-700" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <span className="text-lg font-bold text-zinc-400">{(selectedPlayerMeta.name || "?").charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{selectedPlayerMeta.name}</p>
              <p className="text-xs text-zinc-500">{selectedPlayerMeta.position} · {selectedPlayerMeta.tests?.length || 0} pruebas</p>
            </div>
            <button onClick={() => setShowMobileSelector(true)} className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-medium">Cambiar</button>
          </div>
        )}

        {showMobileSelector && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-2" onClick={() => setShowMobileSelector(false)}>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-3 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-white">Seleccionar jugador</h3>
                <button onClick={() => setShowMobileSelector(false)} className="text-zinc-400 text-sm">Cerrar</button>
              </div>
              <div className="flex-1 overflow-hidden">
                <PlayerSelector
                  players={playersList}
                  selectedId={selectedPlayerId}
                  onSelect={(pid) => { onSelectPlayer(pid); setShowMobileSelector(false); }}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                />
              </div>
            </div>
          </div>
        )}

        {loadingProfile && <div className="py-10 flex justify-center"><Loader2 size={20} className="text-zinc-500 animate-spin" /></div>}
        {profileError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertCircle size={18} className="text-red-400" />
            <p className="text-sm text-red-300">{profileError}</p>
          </div>
        )}
        {profileData && !loadingProfile && (
          <>
            <PlayerProfileHeader
              player={profileData.player}
              sessionCount={profileData.sessions?.length || 0}
              lastSession={lastSession}
              baselineSessions={baselineSessions}
              activeSignals={activeSignals}
            />
            <PlayerProfileModeSelector active={mode} onChange={setMode} />
            <div className="min-h-[300px]">
              {mode === "resumen" && <SummaryMode data={profileData} />}
              {mode === "evolucion" && <EvolutionMode data={profileData} />}
              {mode === "comparar" && <CompareSessionsMode data={profileData} />}
              {mode === "bateria" && <BatteryMode data={profileData} />}
              {mode === "asimetrias" && <AsymmetryMode data={profileData} />}
              {mode === "plantel" && <SquadComparisonMode data={profileData} />}
              {mode === "mapa" && <PersonalChangeMapMode data={profileData} />}
              {mode === "datos" && <FullDataMode data={profileData} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}