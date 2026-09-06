import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import ClubShield from "@/components/club/ClubShield";
import MatchCountdown from "@/components/club/MatchCountdown";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { formatDateOnly, getDateKeyInTimezone, matchDateValue } from "@/lib/clubCompetitionUtils";

const CATEGORY_ORDER = ["4ta", "5ta", "6ta", "7ma", "8va", "9na"];

export default function NextYouthMatch() {
  const { clubBrand, institutionProfile } = useWorkspace();
  const timeZone = institutionProfile?.timezone || "America/Argentina/Buenos_Aires";
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.FootballYouthFixture.list("date", 500)
      .then((all) => setMatches(all || []))
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  const nextRound = useMemo(() => {
    const today = getDateKeyInTimezone(timeZone);
    const scheduled = matches
      .filter((match) => match.status === "scheduled" && matchDateValue(match) >= today)
      .sort((a, b) => {
        const byDate = String(matchDateValue(a)).localeCompare(String(matchDateValue(b)));
        if (byDate !== 0) return byDate;
        return Number(a.fixtureRound || 999) - Number(b.fixtureRound || 999);
      });
    if (!scheduled.length) return null;
    const first = scheduled[0];
    const date = matchDateValue(first);
    const round = first.fixtureRound || null;
    const fixtures = scheduled
      .filter((match) => matchDateValue(match) === date && (round == null || match.fixtureRound === round))
      .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category));
    const rivalFixture = fixtures[0];
    const rival = rivalFixture?.isHome ? rivalFixture?.awayTeam : rivalFixture?.homeTeam;
    return { date, round, fixtures, rival, rivalLogo: rivalFixture?.teamLogo };
  }, [matches, timeZone]);

  if (loading) {
    return <Card className="bg-zinc-900 border-zinc-800"><div className="h-48 animate-pulse" /></Card>;
  }

  if (!nextRound) {
    return <Card className="bg-zinc-900 border-zinc-800"><CardContent className="pt-6 text-center text-zinc-500 text-sm">No hay partidos de juveniles programados</CardContent></Card>;
  }

  const grandes = nextRound.fixtures.filter((match) => ["4ta", "5ta", "6ta"].includes(match.category));
  const chicas = nextRound.fixtures.filter((match) => ["7ma", "8va", "9na"].includes(match.category));

  const groupCard = (label, fixtures, tone) => {
    const isHome = fixtures[0]?.isHome;
    const border = tone === "green" ? "border-emerald-500/30 bg-emerald-500/10" : "border-blue-500/30 bg-blue-500/10";
    const text = tone === "green" ? "text-emerald-400" : "text-blue-400";
    return (
      <div className={`rounded-lg border p-4 ${border}`}>
        <h3 className={`font-bold mb-2 ${text}`}>{label} — {isHome == null ? "POR DEFINIR" : isHome ? "LOCAL" : "VISITANTE"}</h3>
        <p className="text-sm text-zinc-400 mb-2">Cancha: {fixtures[0]?.venue || "—"}</p>
        {fixtures.map((match) => (
          <div key={match.id} className="flex justify-between py-1">
            <span className="text-white">{match.category} División</span>
            <span className="font-medium text-zinc-200">{match.time || "—"} hs</span>
          </div>
        ))}
        {!fixtures.length && <p className="text-xs text-zinc-600">Sin categorías cargadas en este grupo.</p>}
      </div>
    );
  };

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          {clubBrand?.logoUrl ? <img src={clubBrand.logoUrl} alt="" className="w-8 h-8 object-contain" /> : null}
          Próxima jornada - Juveniles
        </CardTitle>
        <p className="text-sm text-zinc-400 flex items-center gap-2 flex-wrap">
          <span>{clubBrand?.name || "Club"} vs</span>
          <ClubShield teamName={nextRound.rival} teamLogo={nextRound.rivalLogo} size="w-6 h-6" />
          <span className="text-white font-medium">{nextRound.rival || "Rival por confirmar"}</span>
          <span className="text-zinc-500">— {formatDateOnly(nextRound.date)}</span>
          <MatchCountdown match={{ matchDate: nextRound.date }} timeZone={timeZone} />
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groupCard("GRANDES", grandes, "green")}
          {groupCard("CHICAS", chicas, "blue")}
        </div>
      </CardContent>
    </Card>
  );
}
