import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Stage, Layer, Rect } from "react-konva";
import PitchLayer from "./layers/PitchLayer";
import TacticalElementNode from "./elements/TacticalElementNode";

export default function TacticalPresentation({ open, onClose, boards, currentBoardId, onSelectBoard }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) {
      const i = boards.findIndex((b) => b.id === currentBoardId);
      setIndex(i >= 0 ? i : 0);
    }
  }, [open, currentBoardId, boards]);

  useEffect(() => {
    function handler(e) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, index, boards.length]);

  if (!open || !boards.length) return null;

  const board = boards[index];
  if (!board) return null;

  function next() { setIndex((i) => Math.min(boards.length - 1, i + 1)); }
  function prev() { setIndex((i) => Math.max(0, i - 1)); }

  const docWidth = board.document_width || 1600;
  const docHeight = board.document_height || 900;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-white font-semibold">{board.name}</p>
          {board.objective && <p className="text-zinc-400 text-sm">{board.objective}</p>}
        </div>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"><X size={24} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center relative">
        <Stage width={Math.min(window.innerWidth - 100, docWidth * 0.6)} height={Math.min(window.innerHeight - 200, docHeight * 0.6)} scaleX={Math.min((window.innerWidth - 100) / docWidth, (window.innerHeight - 200) / docHeight)} scaleY={Math.min((window.innerWidth - 100) / docWidth, (window.innerHeight - 200) / docHeight)}>
          <Layer listening={false}>
            <Rect x={0} y={0} width={docWidth} height={docHeight} fill="#0a0a0a" />
            <PitchLayer config={board.pitch_config} width={docWidth} height={docHeight} />
          </Layer>
          <Layer listening={false}>
            {(board.elements || []).map((el) => (
              <TacticalElementNode key={el.id} el={el} draggable={false} onSelect={() => {}} onChange={() => {}} />
            ))}
          </Layer>
        </Stage>
        {index > 0 && (
          <button onClick={prev} className="absolute left-4 p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white"><ChevronLeft size={24} /></button>
        )}
        {index < boards.length - 1 && (
          <button onClick={next} className="absolute right-4 p-3 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white"><ChevronRight size={24} /></button>
        )}
      </div>
      <div className="p-4 text-center">
        <span className="text-zinc-500 text-sm">{index + 1} / {boards.length}</span>
      </div>
    </div>
  );
}