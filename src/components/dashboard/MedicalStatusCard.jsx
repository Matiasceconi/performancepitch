import React from "react";
import { Link } from "react-router-dom";
import { Heart, ChevronRight } from "lucide-react";

export default function MedicalStatusCard({ injuredCount, discomfortCount }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Heart size={14} className="text-red-400" /> Estado médico
        </h2>
        <Link to="/performance" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver área médica <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-4 flex gap-5">
        <div><p className="text-2xl font-bold text-red-400">{injuredCount}</p><p className="text-[10px] text-zinc-500 mt-0.5">Lesionados</p></div>
        <div><p className="text-2xl font-bold text-yellow-400">{discomfortCount}</p><p className="text-[10px] text-zinc-500 mt-0.5">Molestias</p></div>
      </div>
    </div>
  );
}