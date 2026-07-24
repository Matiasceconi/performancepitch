import React from "react";
import { ZoomIn, ZoomOut, Maximize, Grid3x3, Magnet, Ruler } from "lucide-react";

export default function TacticalBottomBar({ zoom, onZoom, onFit, showGrid, onToggleGrid, snap, onToggleSnap, docWidth, docHeight }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-900 border-t border-zinc-800 text-xs text-zinc-400 shrink-0">
      <button onClick={() => onZoom(Math.max(0.2, zoom - 0.1))} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Alejar"><ZoomOut size={14} /></button>
      <span className="w-12 text-center text-zinc-300">{Math.round(zoom * 100)}%</span>
      <button onClick={() => onZoom(Math.min(4, zoom + 0.1))} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Acercar"><ZoomIn size={14} /></button>
      <button onClick={onFit} className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white" title="Ajustar al lienzo"><Maximize size={14} /></button>
      <div className="w-px h-4 bg-zinc-800" />
      <button onClick={onToggleGrid} className={`flex items-center gap-1 px-2 py-1 rounded ${showGrid ? "text-yellow-400 bg-zinc-800" : "text-zinc-500 hover:text-white"}`} title="Cuadrícula"><Grid3x3 size={14} /></button>
      <button onClick={onToggleSnap} className={`flex items-center gap-1 px-2 py-1 rounded ${snap ? "text-yellow-400 bg-zinc-800" : "text-zinc-500 hover:text-white"}`} title="Snap"><Magnet size={14} /></button>
      <div className="w-px h-4 bg-zinc-800" />
      <span className="flex items-center gap-1 text-zinc-600"><Ruler size={12} /> {docWidth} × {docHeight}</span>
    </div>
  );
}