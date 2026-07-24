import React from "react";
import { Trash2, Copy, Lock, Unlock, Eye, EyeOff, ChevronUp, ChevronDown, Group, Ungroup, AlignLeft, AlignCenter, AlignRight } from "lucide-react";

const COLORS = ["#ffffff", "#facc15", "#f97316", "#ef4444", "#22c55e", "#3b82f6", "#a855f7", "#000000"];

export default function TacticalInspector({ elements, selectedIds, onChange, onDelete, onDuplicate, onGroup, onUngroup, readOnly }) {
  const selected = elements.filter((el) => selectedIds.includes(el.id));
  const single = selected.length === 1 ? selected[0] : null;
  const multi = selected.length > 1;

  if (selected.length === 0) {
    return (
      <div className="w-64 bg-zinc-900 border-l border-zinc-800 p-4 shrink-0">
        <p className="text-xs text-zinc-600 text-center py-8">Seleccioná un elemento para ver sus propiedades</p>
      </div>
    );
  }

  function update(patch) {
    if (single) onChange(single.id, patch);
  }
  function updateData(patch) {
    if (single) onChange(single.id, { data: { ...single.data, ...patch } });
  }

  return (
    <div className="w-64 bg-zinc-900 border-l border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between">
        <p className="text-xs font-semibold text-white">{multi ? `${selected.length} elementos` : "Propiedades"}</p>
        <div className="flex gap-1">
          {!readOnly && (
            <>
              <button onClick={onDuplicate} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Duplicar"><Copy size={13} /></button>
              <button onClick={onDelete} className="p-1 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400" title="Eliminar"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      </div>

      {multi && !readOnly && (
        <div className="p-3 space-y-2">
          <button onClick={onGroup} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"><Group size={14} /> Agrupar</button>
          <button onClick={onUngroup} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300"><Ungroup size={14} /> Desagrupar</button>
          <div className="grid grid-cols-3 gap-1 pt-2">
            <button onClick={() => {}} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400" title="Alinear izquierda"><AlignLeft size={13} /></button>
            <button onClick={() => {}} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400" title="Centrar"><AlignCenter size={13} /></button>
            <button onClick={() => {}} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400" title="Alinear derecha"><AlignRight size={13} /></button>
          </div>
        </div>
      )}

      {single && (
        <div className="p-3 space-y-3">
          {/* Posición */}
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <input type="number" value={Math.round(single.x)} onChange={(e) => update({ x: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
            </Field>
            <Field label="Y">
              <input type="number" value={Math.round(single.y)} onChange={(e) => update({ y: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
            </Field>
            <Field label="Ancho">
              <input type="number" value={Math.round(single.width)} onChange={(e) => update({ width: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
            </Field>
            <Field label="Alto">
              <input type="number" value={Math.round(single.height)} onChange={(e) => update({ height: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
            </Field>
            <Field label="Rotación">
              <input type="number" value={Math.round(single.rotation || 0)} onChange={(e) => update({ rotation: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
            </Field>
            <Field label="Opacidad">
              <input type="number" step="0.1" min="0" max="1" value={single.opacity ?? 1} onChange={(e) => update({ opacity: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
            </Field>
          </div>

          {/* Color (si aplica) */}
          {single.data?.color !== undefined && (
            <div>
              <p className="text-[10px] text-zinc-500 mb-1">Color</p>
              <div className="flex gap-1 flex-wrap">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => updateData({ color: c })} disabled={readOnly} style={{ background: c, outline: single.data.color === c ? "2px solid #fff" : "none", outlineOffset: "1px" }} className="w-5 h-5 rounded-full border border-zinc-600 disabled:opacity-50" />
                ))}
              </div>
            </div>
          )}

          {/* Texto (si aplica) */}
          {single.type === "text" && (
            <>
              <Field label="Texto">
                <input value={single.data.text || ""} onChange={(e) => updateData({ text: e.target.value })} disabled={readOnly} className="inspector-input" />
              </Field>
              <Field label="Tamaño">
                <input type="number" value={single.data.fontSize || 28} onChange={(e) => updateData({ fontSize: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
              </Field>
            </>
          )}

          {/* Jugador (si aplica) */}
          {["player", "generic_player", "goalkeeper", "coach"].includes(single.type) && (
            <>
              <Field label="Número">
                <input value={single.data.number || ""} onChange={(e) => updateData({ number: e.target.value })} disabled={readOnly} className="inspector-input" />
              </Field>
              <Field label="Etiqueta">
                <input value={single.data.label || ""} onChange={(e) => updateData({ label: e.target.value })} disabled={readOnly} className="inspector-input" />
              </Field>
              <Field label="Posición">
                <input value={single.data.position || ""} onChange={(e) => updateData({ position: e.target.value })} disabled={readOnly} className="inspector-input" />
              </Field>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={single.data.captain || false} onChange={(e) => updateData({ captain: e.target.checked })} disabled={readOnly} /> Capitán
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={single.data.isRival || false} onChange={(e) => updateData({ isRival: e.target.checked })} disabled={readOnly} /> Rival
              </label>
            </>
          )}

          {/* Línea/flecha (si aplica) */}
          {["line", "arrow", "tactical_line", "curved_arrow"].includes(single.type) && (
            <>
              <Field label="Grosor">
                <input type="number" value={single.data.strokeWidth || 4} onChange={(e) => updateData({ strokeWidth: Number(e.target.value) })} disabled={readOnly} className="inspector-input" />
              </Field>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={single.data.arrowEnd !== false} onChange={(e) => updateData({ arrowEnd: e.target.checked })} disabled={readOnly} /> Punta final
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                <input type="checkbox" checked={single.data.arrowStart || false} onChange={(e) => updateData({ arrowStart: e.target.checked })} disabled={readOnly} /> Punta inicial
              </label>
            </>
          )}

          {/* Estado */}
          <div className="flex gap-2 pt-2 border-t border-zinc-800">
            <button onClick={() => update({ locked: !single.locked })} disabled={readOnly} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${single.locked ? "text-yellow-400" : "text-zinc-400"} hover:bg-zinc-800`}>
              {single.locked ? <Lock size={12} /> : <Unlock size={12} />} {single.locked ? "Bloqueado" : "Bloquear"}
            </button>
            <button onClick={() => update({ visible: single.visible !== false ? false : true })} disabled={readOnly} className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${single.visible === false ? "text-zinc-600" : "text-zinc-400"} hover:bg-zinc-800`}>
              {single.visible === false ? <EyeOff size={12} /> : <Eye size={12} />} {single.visible === false ? "Oculto" : "Visible"}
            </button>
          </div>

          {/* Orden de capas */}
          <div className="flex gap-2">
            <button onClick={() => update({ zIndex: (single.zIndex || 0) + 1 })} disabled={readOnly} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:bg-zinc-800"><ChevronUp size={12} /> Subir capa</button>
            <button onClick={() => update({ zIndex: (single.zIndex || 0) - 1 })} disabled={readOnly} className="flex items-center gap-1 px-2 py-1 rounded text-xs text-zinc-400 hover:bg-zinc-800"><ChevronDown size={12} /> Bajar capa</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-[10px] text-zinc-500 mb-0.5 block">{label}</label>
      {children}
    </div>
  );
}