import React, { useState } from "react";
import { Users, Pencil, Square, Circle, Type, Minus, ArrowRight, Spline, Hand, Cone, Goal, Dumbbell, LayoutTemplate, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { PITCH_MODELS, PITCH_STYLES } from "@/components/tactical/lib/tacticalPitchModels";
import { TACTICAL_TEMPLATES } from "@/components/tactical/lib/tacticalTemplates";

const TABS = [
  { id: "players", label: "Jugadores", icon: Users },
  { id: "drawings", label: "Dibujos", icon: Pencil },
  { id: "materials", label: "Materiales", icon: Cone },
  { id: "texts", label: "Textos", icon: Type },
  { id: "pitches", label: "Canchas", icon: LayoutTemplate },
  { id: "templates", label: "Plantillas", icon: LayoutTemplate },
];

const DRAWING_TOOLS = [
  { type: "arrow", label: "Flecha", icon: ArrowRight },
  { type: "curved_arrow", label: "Flecha curva", icon: Spline },
  { type: "line", label: "Línea", icon: Minus },
  { type: "tactical_line", label: "Línea táctica", icon: Minus },
  { type: "freehand", label: "Recorrido libre", icon: Hand },
  { type: "rectangle", label: "Rectángulo", icon: Square },
  { type: "zone", label: "Zona", icon: Square },
  { type: "ellipse", label: "Elipse", icon: Circle },
];

const MATERIAL_TOOLS = [
  { type: "cone", label: "Cono", icon: Cone },
  { type: "pole", label: "Estaca", icon: Minus },
  { type: "mannequin", label: "Maniquí", icon: Users },
  { type: "hurdle", label: "Valla", icon: Dumbbell },
  { type: "hoop", label: "Aro", icon: Circle },
  { type: "ladder", label: "Escalera", icon: Minus },
  { type: "large_goal", label: "Arco grande", icon: Goal },
  { type: "mini_goal", label: "Arco reducido", icon: Goal },
  { type: "ball", label: "Pelota", icon: Circle },
  { type: "marker", label: "Marcador", icon: Circle },
];

export default function TacticalLeftPanel({ mode: _mode, collapsed, onToggleCollapse, onAddElement, onAddPlayer, onAddRival, players, readOnly, brand }) {
  const [tab, setTab] = useState("players");
  const [search, setSearch] = useState("");

  if (collapsed) {
    return (
      <div className="w-12 bg-zinc-900 border-r border-zinc-800 flex flex-col items-center py-3 gap-2 shrink-0">
        <button onClick={onToggleCollapse} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Expandir panel">
          <PanelLeftOpen size={18} />
        </button>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); onToggleCollapse(); }} className={`p-2 rounded-lg transition-colors ${tab === t.id ? "text-white bg-zinc-800" : "text-zinc-500 hover:text-white hover:bg-zinc-800"}`} title={t.label}>
            <t.icon size={18} />
          </button>
        ))}
      </div>
    );
  }

  const filteredPlayers = (players || []).filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (p.full_name || "").toLowerCase().includes(q) || String(p.jersey_number || "").includes(q);
  });

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex gap-0.5 flex-wrap">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`p-1.5 rounded-md transition-colors ${tab === t.id ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-white"}`} title={t.label}>
              <t.icon size={15} />
            </button>
          ))}
        </div>
        <button onClick={onToggleCollapse} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white" title="Contraer panel">
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {readOnly && <p className="text-xs text-zinc-600 text-center py-2">Modo lectura</p>}

        {tab === "players" && !readOnly && (
          <>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar jugador..." className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {filteredPlayers.map((p) => (
                <button key={p.id} onClick={() => onAddPlayer(p)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-left transition-colors">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ backgroundColor: brand.colors.primary, color: "#fff" }}>{p.jersey_number || "?"}</span>
                  <span className="text-xs text-zinc-300 truncate flex-1">{p.full_name}</span>
                  <span className="text-[10px] text-zinc-600">{(p.position || "").slice(0, 3)}</span>
                </button>
              ))}
              {filteredPlayers.length === 0 && <p className="text-xs text-zinc-600 text-center py-3">Sin jugadores</p>}
            </div>
            <button onClick={onAddRival} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-medium transition-colors">
              <Users size={14} /> Agregar rival genérico
            </button>
          </>
        )}

        {tab === "drawings" && !readOnly && (
          <div className="grid grid-cols-2 gap-1.5">
            {DRAWING_TOOLS.map((t) => (
              <button key={t.type} onClick={() => onAddElement(t.type)} className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors">
                <t.icon size={18} />
                <span className="text-[10px]">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "materials" && !readOnly && (
          <div className="grid grid-cols-2 gap-1.5">
            {MATERIAL_TOOLS.map((t) => (
              <button key={t.type} onClick={() => onAddElement(t.type)} className="flex flex-col items-center gap-1 px-2 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors">
                <t.icon size={18} />
                <span className="text-[10px]">{t.label}</span>
              </button>
            ))}
          </div>
        )}

        {tab === "texts" && !readOnly && (
          <div className="space-y-1.5">
            <button onClick={() => onAddElement("text")} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs transition-colors">
              <Type size={14} /> Agregar texto
            </button>
            <button onClick={() => onAddElement("text", { data: { text: "1", fontSize: 40 } })} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs transition-colors">
              <Type size={14} /> Agregar número
            </button>
          </div>
        )}

        {tab === "pitches" && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500 font-semibold">Modelos</p>
            {PITCH_MODELS.map((m) => (
              <div key={m.id} className="text-xs text-zinc-400 px-2 py-1.5 rounded bg-zinc-800/50">{m.label}</div>
            ))}
            <p className="text-xs text-zinc-500 font-semibold pt-2">Estilos</p>
            {PITCH_STYLES.map((s) => (
              <div key={s.id} className="text-xs text-zinc-400 px-2 py-1.5 rounded bg-zinc-800/50">{s.label}</div>
            ))}
            <p className="text-[10px] text-zinc-600 pt-1">Cambiá el modelo desde la configuración de la pizarra.</p>
          </div>
        )}

        {tab === "templates" && !readOnly && (
          <div className="space-y-1">
            {TACTICAL_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => onAddElement("text", { data: { text: t.name } })} className="w-full text-left px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 hover:text-white transition-colors">
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}