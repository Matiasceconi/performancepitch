import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import NutritionDashboard from "@/components/nutrition/NutritionDashboard";
import NutritionTable from "@/components/nutrition/NutritionTable";
import NutritionRepairPanel from "@/components/nutrition/NutritionRepairPanel";

export default function Nutrition() {
  const [assessments, setAssessments] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [rows, playerRows] = await Promise.all([
      base44.entities.NutritionAssessment.list("-fecha", 3000),
      base44.entities.Player.list("full_name", 3000),
    ]);
    setAssessments(rows);
    setPlayers(playerRows);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <NutritionDashboard assessments={assessments} playerCount={players.length} />
      <NutritionTable assessments={assessments} players={players} onReload={load} />
      <NutritionRepairPanel assessments={assessments} players={players} onReload={load} />
    </div>
  );
}