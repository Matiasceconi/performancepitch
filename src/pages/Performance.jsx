import React, { useState } from "react";
import { Heart, Apple, FileSpreadsheet, Clock, Trophy, FileDown } from "lucide-react";
import Medical from "@/pages/Medical";
import Nutrition from "@/pages/Nutrition";
import Catapult from "@/pages/Catapult";
import PlayerMinutes from "@/pages/PlayerMinutes";
import Matches from "@/pages/Matches";
import MonthlyReport from "@/pages/MonthlyReport";

const tabs = [
  { id: "medical", label: "Médico", icon: Heart },
  { id: "nutrition", label: "Nutrición", icon: Apple },
  { id: "catapult", label: "Catapult GPS", icon: FileSpreadsheet },
  { id: "minutes", label: "Minutos", icon: Clock },
  { id: "matches", label: "Partidos", icon: Trophy },
  { id: "report", label: "Informe Mensual", icon: FileDown },
];

export default function Performance() {
  const [active, setActive] = useState("medical");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Rendimiento</h1>
        <p className="text-zinc-500 text-sm mt-1">Seguimiento médico, GPS y nutricional del plantel</p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
              active === tab.id
                ? "border-white text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {active === "medical" && <Medical />}
        {active === "nutrition" && <Nutrition />}
        {active === "catapult" && <Catapult />}
        {active === "minutes" && <PlayerMinutes />}
        {active === "matches" && <Matches />}
        {active === "report" && <MonthlyReport />}
      </div>
    </div>
  );
}