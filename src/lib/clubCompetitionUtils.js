const YOUTH_COMPETITIONS = ["cuarta", "quinta", "sexta", "septima", "octava", "novena", "juvenil"];

export function normalizeCompetitionText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'´.]/g, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeTeamName(value = "") {
  return normalizeCompetitionText(value)
    .replace(/\bclub\b|\batletico\b|\batletica\b|\basociacion\b|\bdeportivo\b|\bca\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildClubAliases(institutionProfile, clubBrand) {
  const aliases = [
    institutionProfile?.official_name,
    institutionProfile?.short_name,
    institutionProfile?.abbreviation,
    clubBrand?.name,
    clubBrand?.shortName,
  ]
    .map(normalizeTeamName)
    .filter((value) => value && value.length >= 3 && value !== "club");
  return [...new Set(aliases)].sort((a, b) => b.length - a.length);
}

export function isClubTeam(team, aliases = []) {
  const normalized = normalizeTeamName(team);
  if (!normalized) return false;
  const list = Array.isArray(aliases) ? aliases : [normalizeTeamName(aliases)];
  return list.some((alias) => {
    if (!alias) return false;
    if (normalized === alias) return true;
    const shorter = normalized.length <= alias.length ? normalized : alias;
    const longer = normalized.length > alias.length ? normalized : alias;
    return shorter.length >= 5 && longer.includes(shorter);
  });
}

export function sameClubName(left, right) {
  const a = normalizeTeamName(left);
  const b = normalizeTeamName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  return shorter.length >= 5 && longer.includes(shorter);
}

export function getDateKeyInTimezone(timeZone = "America/Argentina/Buenos_Aires", date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    const local = new Date(date);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
  }
}

export function matchDateValue(match) {
  return match?.matchDate || match?.date || "";
}

export function matchTimeValue(match) {
  return match?.matchTime || match?.time || "";
}

export function matchSortKey(match) {
  return `${matchDateValue(match)}T${matchTimeValue(match) || "23:59"}`;
}

export function isMatchToday(match, timeZone) {
  const date = matchDateValue(match);
  return !!date && date === getDateKeyInTimezone(timeZone);
}

function getOffsetMilliseconds(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUTC = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  );
  return asUTC - date.getTime();
}

export function zonedMatchDate(match, timeZone = "America/Argentina/Buenos_Aires") {
  const date = matchDateValue(match);
  const time = matchTimeValue(match);
  if (!date) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "12:00").split(":").map(Number);
  if (![year, month, day, hour, minute].every(Number.isFinite)) return null;
  try {
    const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const firstOffset = getOffsetMilliseconds(guess, timeZone);
    const adjusted = new Date(guess.getTime() - firstOffset);
    const secondOffset = getOffsetMilliseconds(adjusted, timeZone);
    return new Date(guess.getTime() - secondOffset);
  } catch {
    return new Date(`${date}T${time || "12:00"}:00`);
  }
}

export function formatDateOnly(value, options = {}) {
  const date = typeof value === "string" ? value.slice(0, 10) : "";
  if (!date) return "Fecha por confirmar";
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("es-AR", {
    timeZone: "UTC",
    weekday: options.compact ? undefined : "long",
    day: "2-digit",
    month: options.compact ? "short" : "long",
  });
}

function isReserveCompetition(name) {
  const normalized = normalizeCompetitionText(name);
  return normalized.includes("proyeccion") || normalized.includes("reserva") || normalized.includes("reserve");
}

function isYouthCompetition(name) {
  const normalized = normalizeCompetitionText(name);
  return YOUTH_COMPETITIONS.some((token) => normalized.includes(token));
}

function competitionScore(name, division, configuredCompetitions = []) {
  const normalized = normalizeCompetitionText(name);
  let score = 0;
  if (division === "reserva" && isReserveCompetition(name)) score += 30;
  if (division === "primera" && !isReserveCompetition(name) && !isYouthCompetition(name)) score += 10;
  if (division === "primera" && (normalized.includes("primera") || normalized.includes("nacional") || normalized.includes("liga"))) score += 20;
  configuredCompetitions
    .filter((competition) => competition?.division === division && competition?.active !== false)
    .forEach((competition) => {
      const labels = [competition.name, competition.short_name, competition.normalized_name]
        .map(normalizeCompetitionText)
        .filter(Boolean);
      if (labels.some((label) => normalized.includes(label) || label.includes(normalized))) score += 50;
    });
  return score;
}

export function pickCompetitionName(standings = [], aliases = [], division = "primera", configuredCompetitions = []) {
  const grouped = new Map();
  standings.forEach((row) => {
    if (!row?.competition || !isClubTeam(row.team || row.teamName, aliases)) return;
    const name = row.competition;
    if (!grouped.has(name)) grouped.set(name, []);
    grouped.get(name).push(row);
  });

  return [...grouped.entries()]
    .filter(([name]) => division === "reserva" ? isReserveCompetition(name) : (!isReserveCompetition(name) && !isYouthCompetition(name)))
    .map(([name, rows]) => ({
      name,
      score: competitionScore(name, division, configuredCompetitions),
      newest: rows.map((row) => row.lastUpdated || row.updated_date || "").sort().at(-1) || "",
      size: rows.length,
    }))
    .sort((a, b) => b.score - a.score || b.newest.localeCompare(a.newest) || b.size - a.size)[0]?.name || null;
}

function groupKind(group = "") {
  const normalized = normalizeCompetitionText(group);
  if (normalized.includes("tabla anual") || normalized === "anual" || normalized.includes(" anual")) return "annual";
  if (normalized.includes("promedio") || normalized.includes("relegation")) return "other";
  if (normalized.includes("clausura")) return "clausura";
  if (normalized.includes("apertura")) return "apertura";
  return "current";
}

function clubGroups(rows, aliases) {
  return [...new Set(rows.filter((row) => isClubTeam(row.team || row.teamName, aliases)).map((row) => row.group ?? ""))];
}

export function pickCurrentGroup(rows = [], aliases = []) {
  const groups = clubGroups(rows, aliases);
  const candidates = groups.filter((group) => !["annual", "other"].includes(groupKind(group)));
  return candidates.find((group) => groupKind(group) === "clausura") ||
    candidates.find((group) => groupKind(group) === "apertura") ||
    candidates[0] || "";
}

export function pickAnnualGroup(rows = [], aliases = []) {
  return clubGroups(rows, aliases).find((group) => groupKind(group) === "annual") || "";
}

export function phaseLabel(group = "") {
  const normalized = normalizeCompetitionText(group);
  if (normalized.includes("clausura")) return "Clausura";
  if (normalized.includes("apertura")) return "Apertura";
  if (normalized.includes("anual")) return "Tabla anual";
  return group || "Torneo vigente";
}

export function zoneLabel(group = "") {
  const value = String(group || "").trim();
  if (!value) return "";
  const parts = value.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length <= 1) return value;
  return parts.slice(1).join(" · ");
}

function adaptStanding(row) {
  return {
    ...row,
    teamName: row.teamName || row.team,
    teamLogo: row.teamLogo || row.logo_url,
    goalDifference: row.goalDifference ?? row.goalDiff ?? 0,
  };
}

export function buildDivisionModel({ standings = [], aliases = [], division = "primera", configuredCompetitions = [], season = "" } = {}) {
  const competition = pickCompetitionName(standings, aliases, division, configuredCompetitions);
  if (!competition) {
    return {
      competition: null,
      currentGroup: "",
      currentRows: [],
      currentRow: null,
      annualGroup: "",
      annualRows: [],
      annualRow: null,
    };
  }
  const competitionRows = standings.filter((row) => row.competition === competition && (!season || !row.season || String(row.season) === String(season)));
  const currentGroup = pickCurrentGroup(competitionRows, aliases);
  const annualGroup = pickAnnualGroup(competitionRows, aliases);
  const currentRowsRaw = currentGroup === ""
    ? competitionRows.filter((row) => (row.group ?? "") === "")
    : competitionRows.filter((row) => row.group === currentGroup);
  const annualRowsRaw = annualGroup ? competitionRows.filter((row) => row.group === annualGroup) : [];
  const currentRows = currentRowsRaw.map(adaptStanding).sort((a, b) => Number(a.position || 999) - Number(b.position || 999));
  const annualRows = annualRowsRaw.map(adaptStanding).sort((a, b) => Number(a.position || 999) - Number(b.position || 999));
  return {
    competition,
    currentGroup,
    currentRows,
    currentRow: currentRows.find((row) => isClubTeam(row.teamName, aliases)) || null,
    annualGroup,
    annualRows,
    annualRow: annualRows.find((row) => isClubTeam(row.teamName, aliases)) || null,
  };
}

function competitionMatches(matchCompetition, selectedCompetition, division) {
  const matchName = normalizeCompetitionText(matchCompetition);
  const selected = normalizeCompetitionText(selectedCompetition);
  if (selected && (matchName === selected || matchName.includes(selected) || selected.includes(matchName))) return true;
  if (division === "reserva") return isReserveCompetition(matchCompetition);
  return false;
}

export function buildMatchModel({ matches = [], aliases = [], competition = null, division = "primera", timeZone, today } = {}) {
  const todayKey = today || getDateKeyInTimezone(timeZone);
  const relevant = matches
    .filter((match) => isClubTeam(match.homeTeam, aliases) || isClubTeam(match.awayTeam, aliases))
    .filter((match) => competitionMatches(match.competition, competition, division))
    .sort((a, b) => matchSortKey(a).localeCompare(matchSortKey(b)));
  const upcoming = relevant.filter((match) => match.status === "scheduled" && matchDateValue(match) >= todayKey);
  const results = relevant
    .filter((match) => match.status === "played" || (match.homeScore != null && match.awayScore != null))
    .sort((a, b) => matchSortKey(b).localeCompare(matchSortKey(a)));
  return { all: relevant, upcoming, results, today: upcoming.filter((match) => matchDateValue(match) === todayKey) };
}

export function fixtureIsHome(match, aliases = []) {
  if (!match) return false;
  if (typeof match.isHome === "boolean") return match.isHome;
  return isClubTeam(match.homeTeam, aliases);
}

export function fixtureRival(match, aliases = []) {
  if (!match) return "";
  if (isClubTeam(match.homeTeam, aliases)) return match.awayTeam;
  if (isClubTeam(match.awayTeam, aliases)) return match.homeTeam;
  return "";
}

export function competitionDisplayName(name, division) {
  const normalized = normalizeCompetitionText(name);
  if (division === "reserva") return "Torneo Proyección";
  if (normalized.includes("nacional")) return "Primera Nacional";
  if (normalized === "primera" || normalized.includes("liga profesional")) return "Primera División";
  return name || (division === "primera" ? "Plantel superior" : "Reserva");
}
