import React from "react";

const statusConfig = {
  "Disponible": { bg: "bg-emerald-500/15", text: "text-emerald-400", dot: "bg-emerald-400" },
  "Lesionado": { bg: "bg-red-500/15", text: "text-red-400", dot: "bg-red-400" },
  "En recuperación": { bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  "Suspendido": { bg: "bg-orange-500/15", text: "text-orange-400", dot: "bg-orange-400" },
  "Permiso": { bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
  "Selección": { bg: "bg-purple-500/15", text: "text-purple-400", dot: "bg-purple-400" },
  "Juveniles": { bg: "bg-cyan-500/15", text: "text-cyan-400", dot: "bg-cyan-400", label: "En juveniles" },
  "Primera": { bg: "bg-yellow-500/15", text: "text-yellow-400", dot: "bg-yellow-400", label: "En primera" },
};

export default function PlayerStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig["Disponible"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label || status}
    </span>
  );
}