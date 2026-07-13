import React, { useState } from "react";
import useMinutesDashboard from "@/components/performance/minutes/useMinutesDashboard";
import MinutesFiltersRow from "@/components/performance/minutes/MinutesFiltersRow";
import MinutesSummaryCards from "@/components/performance/minutes/MinutesSummaryCards";
import MinutesPlayersTab from "@/components/performance/minutes/MinutesPlayersTab";
import MinutesMatchesTab from "@/components/performance/minutes/MinutesMatchesTab";
import { generateMinutesPdf } from "@/lib/reports/minutesPdf";

const SUB_TABS = [
  { id: "summary", label: "Resumen por jugador" },
  { id: "matches", label: "Detalle por partido" },
];

export default function MinutesSubPanel() {
  const dashboard = useMinutesDashboard();
  const [pendingOpen, setPendingOpen] = useState(false);

  async function handleExport() {
    await generateMinutesPdf(dashboard.exportData);
  }

  if (dashboard.loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-zinc-700 border-t-white" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MinutesFiltersRow
        filters={dashboard.filters}
        updateFilter={dashboard.updateFilter}
        resetFilters={dashboard.resetFilters}
        squadOptions={dashboard.squadOptions}
        seasonOptions={dashboard.seasonOptions}
        competitionOptions={dashboard.competitionOptions}
      />

      <MinutesSummaryCards
        availableMinutes={dashboard.availableMinutes}
        includedMatches={dashboard.filteredFinishedMatches.length}
        playersWithMinutesCount={dashboard.playersWithMinutesCount}
        pendingMatches={dashboard.pendingMatches}
        pendingOpen={pendingOpen}
        onTogglePending={() => setPendingOpen((current) => !current)}
        onExport={handleExport}
      />

      <div className="flex gap-0 border-b border-zinc-800">
        {SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => dashboard.setTab(tab.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-all ${
              dashboard.tab === tab.id
                ? "border-yellow-400 text-yellow-300"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {dashboard.tab === "summary" && <MinutesPlayersTab rows={dashboard.playerRows} filters={dashboard.filters} updateFilter={dashboard.updateFilter} />}
      {dashboard.tab === "matches" && <MinutesMatchesTab matches={dashboard.filteredMatches} />}
    </div>
  );
}