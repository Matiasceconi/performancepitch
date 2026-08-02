import React, { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

const DYJ_LOGO = "https://media.api-sports.io/football/teams/18684.png";

export default function NextYouthMatch() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.FootballYouthFixture.list("-fixtureRound", 200)
      .then((all) => {
        const scheduled = (all || []).filter((m) => m.status === "scheduled");
        scheduled.sort((a, b) => (b.fixtureRound || 0) - (a.fixtureRound || 0));
        setMatches(scheduled);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <div className="h-48 animate-pulse" />
      </Card>
    );
  }
  if (matches.length === 0) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="pt-6 text-center text-zinc-500 text-sm">
          No hay partidos de juveniles programados
        </CardContent>
      </Card>
    );
  }

  const locales = matches.filter((m) => m.isHome === true);
  const visitantes = matches.filter((m) => m.isHome === false);
  const rival =
    matches[0]?.awayTeam === "Defensa y Justicia"
      ? matches[0]?.homeTeam
      : matches[0]?.awayTeam;
  const rivalLogo = matches[0]?.teamLogo;
  const fecha = matches[0]?.date || matches[0]?.matchDate;

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <img src={DYJ_LOGO} alt="DYJ" className="w-8 h-8 object-contain" />
          Próximo Partido - Juveniles
        </CardTitle>
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <span>vs</span>
          {rivalLogo && <img src={rivalLogo} alt={rival} className="w-5 h-5 object-contain" />}
          <span className="text-white font-medium">{rival}</span>
          <span className="text-zinc-500">— {fecha}</span>
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LAS GRANDES - LOCAL */}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <h3 className="font-bold text-emerald-400 mb-2">🟢 LAS GRANDES — LOCAL</h3>
            <p className="text-sm text-zinc-400 mb-2">Cancha: {locales[0]?.venue || "—"}</p>
            {locales.map((m) => (
              <div key={m.id} className="flex justify-between py-1">
                <span className="text-white">{m.category} División</span>
                <span className="font-medium text-zinc-200">{m.time} hs</span>
              </div>
            ))}
          </div>
          {/* LAS CHICAS - VISITANTE */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <h3 className="font-bold text-blue-400 mb-2">🔵 LAS CHICAS — VISITANTE</h3>
            <p className="text-sm text-zinc-400 mb-2">Cancha: {visitantes[0]?.venue || "—"}</p>
            {visitantes.map((m) => (
              <div key={m.id} className="flex justify-between py-1">
                <span className="text-white">{m.category} División</span>
                <span className="font-medium text-zinc-200">{m.time} hs</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}