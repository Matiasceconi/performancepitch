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
      className="relative w-full select-none bg-gradient-to-br from-green-700 via-green-800 to-green-900 rounded-lg overflow-hidden"
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
        {/* Grass base */}
        <defs>
          <linearGradient id="pitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{stopColor: "#22c55e", stopOpacity: 1}} />
            <stop offset="50%" style={{stopColor: "#16a34a", stopOpacity: 1}} />
            <stop offset="100%" style={{stopColor: "#15803d", stopOpacity: 1}} />
          </linearGradient>
        </defs>
        <rect width="100" height="62" fill="url(#pitchGrad)" />
        
        {/* Grass stripes diagonales */}
        {[0,1,2,3,4,5,6,7].map((i) => (
          <rect key={i} x={i * 12.5} width="12.5" height="62"
            fill={i % 2 === 0 ? "#22c55e" : "transparent"} opacity="0.08" />
        ))}

        {/* Bordes exteriores */}
        <rect x="2" y="2" width="96" height="58" fill="none" stroke="white" strokeWidth="0.6" />
        
        {/* Línea de mitad de cancha */}
        <line x1="50" y1="2" x2="50" y2="60" stroke="white" strokeWidth="0.6" />
        
        {/* Círculo central */}
        <circle cx="50" cy="31" r="8.9" fill="none" stroke="white" strokeWidth="0.6" />
        <circle cx="50" cy="31" r="0.5" fill="white" />
        
        {/* Áreas de penal - Defensa */}
        <rect x="28" y="2" width="44" height="16.5" fill="none" stroke="white" strokeWidth="0.6" />
        {/* Área de meta - Defensa */}
        <rect x="37" y="2" width="26" height="5.5" fill="none" stroke="white" strokeWidth="0.6" />
        {/* Arco - Defensa */}
        <path d="M 43 1 L 43 0 L 57 0 L 57 1" stroke="white" strokeWidth="0.6" fill="none" strokeLinecap="round" />
        
        {/* Áreas de penal - Ataque */}
        <rect x="28" y="43.5" width="44" height="16.5" fill="none" stroke="white" strokeWidth="0.6" />
        {/* Área de meta - Ataque */}
        <rect x="37" y="54.5" width="26" height="5.5" fill="none" stroke="white" strokeWidth="0.6" />
        {/* Arco - Ataque */}
        <path d="M 43 61 L 43 62 L 57 62 L 57 61" stroke="white" strokeWidth="0.6" fill="none" strokeLinecap="round" />
        
        {/* Esquinas */}
        {[[4, 4], [96, 4], [4, 58], [96, 58]].map((pos, i) => (
          <circle key={i} cx={pos[0]} cy={pos[1]} r="0.4" fill="white" />
        ))}
      </svg>

      {/* Player chips */}
      {allDots.map(({ player, x, y }) => {
        const isHighlighted = highlighted.has(player.id);
        const colors = statusColors[player.status] || statusColors["Disponible"];
        const chipColor = onToggle
          ? (isHighlighted ? "#22c55e" : "#52525b")
          : (colors.bg);

        return (
          <div
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
            className="flex flex-col items-center group transition-transform"
          >
            {/* Foto del jugador */}
            {player.photo_url ? (
              <div
                style={{ borderColor: chipColor, borderWidth: "3px", boxShadow: `0 0 20px ${chipColor}40, 0 4px 12px rgba(0,0,0,0.6)` }}
                className="w-11 h-11 rounded-full overflow-hidden border transition-all group-hover:scale-130 block"
              >
                <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                style={{ background: chipColor, boxShadow: `0 0 20px ${chipColor}40, 0 4px 12px rgba(0,0,0,0.6)` }}
                className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border-3 border-white/60 transition-all group-hover:scale-130 text-white"
              >
                {player.number}
              </div>
            )}
            
            {/* Info del jugador */}
            <div className="mt-1.5 bg-black/80 rounded-md px-2 py-1 backdrop-blur-sm border border-white/40 text-center whitespace-nowrap shadow-lg">
              <div className="text-[9px] font-bold text-white leading-tight tracking-wide">
                {player.number ? `${player.number}-` : ""}{player.name.split(" ").slice(-1)[0].toUpperCase()}
              </div>
              <div className="text-[7px] text-yellow-200 leading-tight font-semibold">
                {player.position?.substring(0, 3).toUpperCase()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}