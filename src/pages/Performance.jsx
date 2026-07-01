import React, { useState, useEffect } from "react";
import { Heart, Apple, FileSpreadsheet, Clock, FileDown, Gauge } from "lucide-react";
import Medical from "@/pages/Medical";
import Nutrition from "@/pages/Nutrition";
import GpsAnalytics from "@/components/performance/GpsAnalytics";
import ExternalGpsLoad from "@/components/performance/ExternalGpsLoad";
import MonthlyReport from "@/pages/MonthlyReport";
import MinutesTracker from "@/components/performance/MinutesTracker";
import MinutesByMatch from "@/components/performance/MinutesByMatch";
import MinutesSubPanel from "@/components/performance/MinutesSubPanel";

const tabs = [
  { id: "medical", label: "Área Médica", icon: Heart },
  { id: "nutrition", label: "Área de Nutrición", icon: Apple },
  { id: "catapult", label: "Carga Externa (GPS)", icon: FileSpreadsheet },
  { id: "external_gps", label: "Carga Externa GPS", icon: Gauge },
  { id: "minutes_official", label: "Minutos Jugados", icon: Clock },
  { id: "report", label: "Informe Mensual", icon: FileDown },
];

export default function Performance() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get("tab");
  const urlDate = urlParams.get("date");
  const [active, setActive] = useState(urlTab === "last" ? "catapult" : urlTab === "external_gps" ? "external_gps" : "medical");
  const gpsInitialTab = urlTab === "last" ? "last" : undefined;

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
         {active === "catapult" && <GpsAnalytics initialTab={gpsInitialTab} initialDate={urlDate} />}
         {active === "external_gps" && <ExternalGpsLoad />}
         {active === "report" && <MonthlyReport />}
         {active === "minutes_official" && <MinutesSubPanel />}
       </div>
    </div>
  );
}