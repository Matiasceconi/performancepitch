import React from "react";
import { Apple } from "lucide-react";
import Nutrition from "@/pages/Nutrition";

export default function PerformanceNutrition() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Apple size={22} className="text-zinc-400" />
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Nutrición</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Rendimiento · Peso, hidratación, composición corporal y observaciones nutricionales</p>
        </div>
      </div>
      <Nutrition />
    </div>
  );
}