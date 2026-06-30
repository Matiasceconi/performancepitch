import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { POSITION_GROUPS, isGoalkeeper } from "@/components/squad/squadConstants";
import PlayerDayCard from "@/components/squad/PlayerDayCard";
import PlayerAvatar from "@/components/player/PlayerAvatar";
import moment from "moment";

// ── Movement section card ─────────────────────────────────────────────────
function MovementCard({ player, ds, label, fromTo, color, borderColor, bgColor, iconColor, Icon }) {
  if (!player || !ds) return null;
  const isGK = isGoalkeeper(player);
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${bgColor} ${borderColor}`}>
      <PlayerAvatar player={player} size="sm" />
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-white truncate">{player.full_name}</p>
          {isGK && (
            <span className="text-[9px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 rounded-full px-1.5 py-0.5 font-semibold">
              🥅 ARQ
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400 truncate">{player.position}{player.category ? ` · ${player.category}` : ""}</p>
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className={`text-[10px] font-medium ${iconColor} flex items-center gap-1`}>
            <Icon size={10} /> {fromTo}
          </span>
        </div>
        {ds.valid_until && (
          <p className="text-[10px] text-zinc-500">
            Hasta: {moment(ds.valid_until).format("DD/MM/YYYY")}
          </p>
        )}
        {ds.notes && (
          <p className="text-[10px] text-zinc-500 italic truncate">"{ds.notes}"</p>
        )}
      </div>
      <div className="shrink-0">
        <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg border ${bgColor} ${color} ${borderColor}`}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Movement section block ─────────────────────────────────────────────────
function MovementSection({ title, subtitle, players, getEffectiveStatus, dotColor, headerColor, bgColor, borderColor, iconColor, Icon }) {
  if (players.length === 0) return null;
  const gkCount = players.filter(p => isGoalkeeper(p)).length;
  const fieldCount = players.length - gkCount;
  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      <div className={`px-4 py-3 flex items-center justify-between ${bgColor} border-b ${borderColor}`}>
        <div>
          <h3 className={`text-sm font-bold ${headerColor} flex items-center gap-2`}>
            <Icon size={14} /> {title}
          </h3>
          {subtitle && <p className="text-[10px] text-zinc-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {gkCount > 0 && <span className="text-[10px] text-yellow-400">ARQ: {gkCount}</span>}
          {fieldCount > 0 && <span className="text-[10px] text-zinc-400">Campo: {fieldCount}</span>}
          <span className={`text-sm font-bold ${headerColor}`}>{players.length}</span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        {players.map(p => {
          const ds = getEffectiveStatus(p);
          return (
            <MovementCard
              key={p.id}
              player={p}
              ds={ds}
              label={title}
              fromTo={`Base: ${ds.base_squad_name || "—"} → Destino: ${ds.target_squad_name || "—"}`}
              color={headerColor}
              borderColor={borderColor}
              bgColor={bgColor}
              iconColor={iconColor}
              Icon={Icon}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Main grid ──────────────────────────────────────────────────────────────
export default function DailySquadGrid({
  players,
  movements = { subenDesde: [], subenA: [], bajanDesde: [], bajanA: [] },
  getEffectiveStatus,
  applyChange,
  pendingChanges,
  selectedDate,
  squads,
  selectedSquadId,
  onApplyMovement,
  onEndTemporaryMovement,
}) {
  const { subenDesde, subenA, bajanDesde, bajanA } = movements;
  const hasMovements = subenDesde.length > 0 || subenA.length > 0 || bajanDesde.length > 0 || bajanA.length > 0;
  const selectedSquadName = squads.find(s => s.id === selectedSquadId)?.name || "este plantel";

  // Group stable players by position
  const grouped = {};
  const ungrouped = [];
  players.forEach(p => {
    let found = false;
    for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
      if (positions.includes(p.position)) {
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(p);
        found = true;
        break;
      }
    }
    if (!found) ungrouped.push(p);
  });

  const groupOrder = Object.keys(POSITION_GROUPS);
  const isGkGroup = (group) => group === "Arqueros";

  const isEmpty = players.length === 0 && !hasMovements;

  if (isEmpty) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
        <p className="text-zinc-500 text-sm">No hay jugadores que coincidan con los filtros</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Movement sections at the top ── */}
      {hasMovements && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Movimientos temporales</h2>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Suben DESDE este plantel a otro (ej: Reserva → Primera) */}
          <MovementSection
            title={`Suben desde ${selectedSquadName}`}
            subtitle={`Jugadores de ${selectedSquadName} afectados temporalmente a otro plantel — NO entrenan con ${selectedSquadName} hoy`}
            players={subenDesde}
            getEffectiveStatus={getEffectiveStatus}
            headerColor="text-sky-300"
            bgColor="bg-sky-500/5"
            borderColor="border-sky-500/25"
            iconColor="text-sky-400"
            Icon={ArrowUp}
          />

          {/* Suben A este plantel desde otro (ej: Cuarta → Reserva) */}
          <MovementSection
            title={`Suben a ${selectedSquadName}`}
            subtitle={`Jugadores de otras categorías que entrenan con ${selectedSquadName} hoy`}
            players={subenA}
            getEffectiveStatus={getEffectiveStatus}
            headerColor="text-cyan-300"
            bgColor="bg-cyan-500/5"
            borderColor="border-cyan-500/25"
            iconColor="text-cyan-400"
            Icon={ArrowUp}
          />

          {/* Bajan DESDE este plantel a otro */}
          <MovementSection
            title={`Bajan desde ${selectedSquadName}`}
            subtitle={`Jugadores de ${selectedSquadName} afectados temporalmente a una categoría inferior`}
            players={bajanDesde}
            getEffectiveStatus={getEffectiveStatus}
            headerColor="text-orange-300"
            bgColor="bg-orange-500/5"
            borderColor="border-orange-500/25"
            iconColor="text-orange-400"
            Icon={ArrowDown}
          />

          {/* Bajan A este plantel desde otro */}
          <MovementSection
            title={`Bajan a ${selectedSquadName}`}
            subtitle={`Jugadores de un plantel superior afectados temporalmente a ${selectedSquadName}`}
            players={bajanA}
            getEffectiveStatus={getEffectiveStatus}
            headerColor="text-amber-300"
            bgColor="bg-amber-500/5"
            borderColor="border-amber-500/25"
            iconColor="text-amber-400"
            Icon={ArrowDown}
          />
        </div>
      )}

      {/* ── Stable players grid by position ── */}
      {players.length > 0 && (
        <div className="space-y-6">
          {hasMovements && (
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Plantel disponible hoy</h2>
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-600">{players.length} jugadores</span>
            </div>
          )}

          {groupOrder.filter(g => grouped[g]?.length > 0).map(group => (
            <div key={group}>
              <div className="flex items-center gap-3 mb-3">
                {isGkGroup(group)
                  ? <h2 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">🥅 {group}</h2>
                  : <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">{group}</h2>}
                <div className={`flex-1 h-px ${isGkGroup(group) ? "bg-yellow-500/25" : "bg-zinc-800"}`} />
                <span className={`text-xs ${isGkGroup(group) ? "text-yellow-500" : "text-zinc-600"}`}>{grouped[group].length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {grouped[group].map(p => (
                  <PlayerDayCard
                    key={p.id}
                    player={p}
                    dayStatus={getEffectiveStatus(p)}
                    hasPending={!!pendingChanges[p.id]}
                    onChange={changes => applyChange(p.id, changes)}
                    selectedDate={selectedDate}
                    squads={squads}
                    selectedSquadId={selectedSquadId}
                    onApplyMovement={onApplyMovement}
                    onEndTemporaryMovement={onEndTemporaryMovement}
                  />
                ))}
              </div>
            </div>
          ))}

          {ungrouped.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Otros</h2>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {ungrouped.map(p => (
                  <PlayerDayCard
                    key={p.id}
                    player={p}
                    dayStatus={getEffectiveStatus(p)}
                    hasPending={!!pendingChanges[p.id]}
                    onChange={changes => applyChange(p.id, changes)}
                    selectedDate={selectedDate}
                    squads={squads}
                    selectedSquadId={selectedSquadId}
                    onApplyMovement={onApplyMovement}
                    onEndTemporaryMovement={onEndTemporaryMovement}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}