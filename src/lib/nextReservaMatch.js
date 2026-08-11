function normalizeTeamName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(club|social|deportivo|asociacion|atletico|futbol)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sameTeam(left, right) {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function getReservaCompetitions(competitions = []) {
  return (competitions || []).filter(
    (competition) =>
      competition?.division === "reserva" &&
      competition?.provider_competition_id &&
      competition?.active !== false
  );
}

export function getReservaCompetition(competitions = []) {
  return getReservaCompetitions(competitions)[0] || null;
}

function competitionForFixture(competitions, fixture) {
  const tournament = normalizeTeamName(fixture?.tournament || fixture?.round);
  return competitions.find((competition) => {
    const label = normalizeTeamName(`${competition?.name || ""} ${competition?.short_name || ""}`);
    return tournament && label.includes(tournament);
  }) || competitions[0] || null;
}

export function getUpcomingReservaFixtures({ fixtures = [], competitions = [], teamName = "", now = new Date() } = {}) {
  const reservaCompetitions = getReservaCompetitions(competitions);
  if (!reservaCompetitions.length) return [];

  const providerIds = new Set(reservaCompetitions.map((competition) => competition.provider_competition_id));
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const upcoming = (fixtures || [])
    .filter((fixture) => providerIds.has(fixture?.competitionId))
    .filter((fixture) => fixture?.status === "scheduled")
    .filter((fixture) => sameTeam(fixture?.homeTeam, teamName) || sameTeam(fixture?.awayTeam, teamName))
    .filter((fixture) => {
      const fixtureMs = new Date(fixture?.date).getTime();
      return !Number.isFinite(fixtureMs) || !Number.isFinite(nowMs) || fixtureMs >= nowMs;
    })
    .sort((left, right) => new Date(left?.date).getTime() - new Date(right?.date).getTime());

  return upcoming.map((fixture) => ({
    ...fixture,
    competitionRecord: competitionForFixture(reservaCompetitions, fixture),
  }));
}

export function getNextReservaFixture(args = {}) {
  return getUpcomingReservaFixtures(args)[0] || null;
}

function formatMatchTime(date) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleTimeString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

export function fixtureToPdfMatchContext(fixture, teamName = "Defensa y Justicia") {
  if (!fixture) return null;
  const isHome = sameTeam(fixture.homeTeam, teamName);
  const rival = isHome ? fixture.awayTeam : fixture.homeTeam;
  const rivalLogo = isHome ? fixture.awayLogo : fixture.homeLogo;
  const competition = fixture.competitionRecord;

  return {
    source: "club_dashboard_reserva",
    fixture_id: fixture.id || fixture.fixtureId || "",
    date: fixture.date || "",
    time: formatMatchTime(fixture.date),
    rival: rival || "",
    rival_logo_url: rivalLogo || "",
    home_away: isHome ? "Local" : "Visitante",
    is_home: isHome,
    competition: competition?.short_name || competition?.name || fixture.competitionName || "Torneo Proyección",
    round: fixture.round || "",
    venue: fixture.venue || "",
    home_team: fixture.homeTeam || "",
    away_team: fixture.awayTeam || "",
    home_logo_url: fixture.homeLogo || "",
    away_logo_url: fixture.awayLogo || "",
  };
}
