import React, { useState, useRef } from "react";

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
  const [positions, setPositions] = React.useState({});
  const [dragging, setDragging] = React.useState(null);
  const containerRef = React.useRef(null);

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
      const customPos = positions[p.id];
      allDots.push({ 
        player: p, 
        x: customPos ? customPos.x : coords[i].x, 
        y: customPos ? customPos.y : y 
      });
    });
  });

  const handleMouseDown = (e, player) => {
    if (onToggle) return; // No drag si hay toggle
    e.preventDefault();
    setDragging(player.id);
  };

  const handleMouseMove = (e) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100 * 1.61; // 62% padding ratio
    setPositions((prev) => ({
      ...prev,
      [dragging]: { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(60, y)) },
    }));
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  if (players.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600 text-sm">
        {emptyLabel || "Sin jugadores"}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full select-none bg-gradient-to-br from-emerald-900 to-emerald-950"
      style={{ paddingBottom: "62%" }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Pitch background */}
      <svg
        viewBox="0 0 100 62"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="none"
      >
        {/* Grass base - más realistaa */}
        <defs>
          <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: "#166534", stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: "#15803d", stopOpacity: 1}} />
          </linearGradient>
        </defs>
        <rect width="100" height="62" fill="url(#pitchGrad)" />
        {/* Grass stripes más suave */}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <rect key={i} x={i * 12.5} width="12.5" height="62"
            fill={i % 2 === 0 ? "#134a2a" : "transparent"} opacity="0.4" />
        ))}
        {/* Border */}
        <rect x="2" y="2" width="96" height="58" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        {/* Centre circle */}
        <circle cx="50" cy="31" r="9.15" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        <circle cx="50" cy="31" r="0.6" fill="rgba(255,255,255,0.7)" />
        {/* Halfway line */}
        <line x1="50" y1="2" x2="50" y2="60" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        {/* Penalty areas */}
        <rect x="27.5" y="2" width="45" height="16" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        <rect x="27.5" y="44" width="45" height="16" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        {/* Goal areas */}
        <rect x="36.5" y="2" width="27" height="5.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        <rect x="36.5" y="54.5" width="27" height="5.5" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.5" />
        {/* Goals */}
        <circle cx="50" cy="2" r="0.8" fill="rgba(255,255,255,0.8)" />
        <circle cx="50" cy="60" r="0.8" fill="rgba(255,255,255,0.8)" />
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
            onMouseDown={(e) => handleMouseDown(e, player)}
            onClick={() => onToggle && onToggle(player)}
            style={{
              position: "absolute",
              left: `${x}%`,
              top: `${y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: dragging === player.id ? 50 : 10,
              cursor: dragging === player.id ? "grabbing" : (onToggle ? "pointer" : "grab"),
            }}
            className="flex flex-col items-center gap-0.5 group transition-transform"
            title={player.name}
          >
            {player.photo_url ? (
              <span
                style={{ borderColor: chipColor }}
                className="w-8 h-8 rounded-full overflow-hidden shadow-lg border-2.5 transition-transform group-hover:scale-125 block"
              >
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              </span>
            ) : (
              <span
                style={{ background: chipColor, color: "#fff" }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shadow-lg border-2.5 border-white/40 transition-transform group-hover:scale-125"
              >
                {player.number}
              </span>
            )}
            <span className="text-[7px] font-bold text-white drop-shadow-md max-w-[60px] text-center leading-tight truncate bg-black/40 px-1 py-0.5 rounded">
              {player.name.split(" ").slice(-1)[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}