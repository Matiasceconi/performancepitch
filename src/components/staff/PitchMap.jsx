import React from "react";

// Renders a football pitch with players placed by position rows
// players: array of { name, number, position, status? }
// highlight: optional set of player ids to highlight (for session map)
// onToggle: optional callback(player) when clicking a player chip

const statusColors = {
  "Disponible":      { bg: "#22c55e", text: "#fff" },
  "Lesionado":       { bg: "#ef4444", text: "#fff" },
  "En recuperación": { bg: "#f59e0b", text: "#fff" },
  "Suspendido":      { bg: "#f97316", text: "#fff" },
  "Permiso":         { bg: "#3b82f6", text: "#fff" },
  "Selección":       { bg: "#a855f7", text: "#fff" },
};

// Distribute players of a position row evenly
function rowPositions(count, yPercent) {
  const positions = [];
  for (let i = 0; i < count; i++) {
    const x = ((i + 1) / (count + 1)) * 100;
    positions.push({ x, y: yPercent });
  }
  return positions;
}

export default function PitchMap({ players, highlighted = new Set(), onToggle, emptyLabel }) {
  const arqueros       = players.filter((p) => p.position === "Arquero");
  const defensores     = players.filter((p) => ["Defensor Central", "Lateral Derecho", "Lateral Izquierdo", "Defensor"].includes(p.position));
  const mediocampistas = players.filter((p) => ["Mediocampista Central", "Volante Interno", "Mediocampista"].includes(p.position));
  const extremos       = players.filter((p) => p.position === "Extremo");
  const delanteros     = players.filter((p) => ["Delantero Centro", "Delantero"].includes(p.position));

  const rows = [
    { group: arqueros,       y: 88 },
    { group: defensores,     y: 70 },
    { group: mediocampistas, y: 50 },
    { group: extremos,       y: 32 },
    { group: delanteros,     y: 16 },
  ];

  const allDots = [];
  rows.forEach(({ group, y }) => {
    const coords = rowPositions(group.length, y);
    group.forEach((p, i) => {
      allDots.push({ player: p, x: coords[i].x, y });
    });
  });

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
        {emptyLabel || "Sin jugadores"}
      </div>
    );
  }

  return (
    <div className="relative w-full select-none" style={{ paddingBottom: "62%" }}>
      {/* Pitch background */}
      <svg
        viewBox="0 0 100 62"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Grass */}
        <rect width="100" height="62" fill="#166534" />
        {/* Grass stripes */}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <rect key={i} x={i * 12.5} width="12.5" height="62"
            fill={i % 2 === 0 ? "#15803d" : "#166534"} />
        ))}
        {/* Border */}
        <rect x="2" y="2" width="96" height="58" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        {/* Centre circle */}
        <circle cx="50" cy="31" r="9.15" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        <circle cx="50" cy="31" r="0.5" fill="rgba(255,255,255,0.5)" />
        {/* Halfway line */}
        <line x1="2" y1="31" x2="98" y2="31" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        {/* Penalty areas */}
        <rect x="27.5" y="2" width="45" height="16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        <rect x="27.5" y="44" width="45" height="16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        {/* Goal areas */}
        <rect x="36.5" y="2" width="27" height="5.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        <rect x="36.5" y="54.5" width="27" height="5.5" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="0.4" />
        {/* Goals */}
        <rect x="43" y="0.5" width="14" height="1.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.4" />
        <rect x="43" y="60" width="14" height="1.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.4" />
      </svg>

      {/* Player chips */}
      {allDots.map(({ player, x, y }) => {
        const isHighlighted = highlighted.has(player.id);
        const colors = statusColors[player.status] || statusColors["Disponible"];
        const chipColor = onToggle
          ? (isHighlighted ? "#22c55e" : "#52525b")
          : (colors.bg);

        return (
          <button
            key={player.id}
            onClick={() => onToggle && onToggle(player)}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
              cursor: onToggle ? "pointer" : "default",
            }}
            className="flex flex-col items-center gap-0.5 group"
            title={player.name}
          >
            {player.photo_url ? (
              <span
                style={{ borderColor: chipColor }}
                className="w-7 h-7 rounded-full overflow-hidden shadow-lg border-2 transition-transform group-hover:scale-110 block"
              >
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              </span>
            ) : (
              <span
                style={{ background: chipColor, color: "#fff" }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border-2 border-white/30 transition-transform group-hover:scale-110"
              >
                {player.number}
              </span>
            )}
            <span className="text-[8px] font-semibold text-white drop-shadow max-w-[52px] text-center leading-tight truncate">
              {player.name.split(" ").slice(-1)[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}