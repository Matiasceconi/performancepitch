import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { buildUnlinkedCompetitionGroups, normalizeCompetitionName } from "@/lib/competitions";

export default function CompetitionMigrationTool({ matches, competitions, aliases, onDone }) {
  const [assigning, setAssigning] = useState(false);
  const groups = useMemo(() => buildUnlinkedCompetitionGroups(matches), [matches]);
  const aliasKeys = new Set(aliases.filter((a) => a.active !== false).map((a) => a.normalized_alias));
  const unresolved = groups.filter((group) => !aliasKeys.has(group.normalized));

  async function assign(group, competitionId) {
    const competition = competitions.find((item) => item.id === competitionId);
    if (!competition) return;
    setAssigning(true);
    for (const match of group.matches) await base44.entities.MatchReport.update(match.id, { competition_id: competition.id, competition: competition.name });
    for (const raw of group.rawNames) await base44.entities.CompetitionAliases.create({ competition_id: competition.id, alias: raw, normalized_alias: normalizeCompetitionName(raw), active: true });
    setAssigning(false);
    onDone?.();
  }

  async function mergeDuplicate(sourceId, targetId) {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const source = competitions.find((item) => item.id === sourceId);
    const target = competitions.find((item) => item.id === targetId);
    if (!source || !target || !confirm(`¿Fusionar ${source.name} dentro de ${target.name}?`)) return;
    setAssigning(true);
    const affected = matches.filter((match) => match.competition_id === sourceId);
    for (const match of affected) await base44.entities.MatchReport.update(match.id, { competition_id: targetId, competition: target.name });
    await base44.entities.CompetitionAliases.create({ competition_id: targetId, alias: source.name, normalized_alias: normalizeCompetitionName(source.name), active: true });
    await base44.entities.Competitions.update(sourceId, { active: false, updated_at: new Date().toISOString() });
    setAssigning(false);
    onDone?.();
  }

  return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
    <div><p className="text-white font-semibold">Normalizar competencias existentes</p><p className="text-xs text-zinc-500">Detecta partidos sin competition_id y conserva sus nombres anteriores como alias.</p></div>
    {unresolved.map((group) => <div key={group.normalized} className="bg-zinc-800/60 rounded-lg p-3 flex items-center gap-3"><div className="flex-1"><p className="text-sm text-white">{group.rawNames.join(" / ")}</p><p className="text-xs text-zinc-500">{group.matches.length} partido(s) · {group.normalized}</p></div><select disabled={assigning} onChange={(e) => assign(group, e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"><option value="">Asignar a...</option>{competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name}</option>)}</select></div>)}
    {unresolved.length === 0 && <p className="text-zinc-500 text-sm">No hay competencias sin vincular.</p>}
    <MergeBox competitions={competitions} onMerge={mergeDuplicate} assigning={assigning} />
  </div>;
}

function MergeBox({ competitions, onMerge, assigning }) {
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  return <div className="border-t border-zinc-800 pt-4"><p className="text-sm text-white font-medium mb-2">Fusionar competencias duplicadas</p><div className="flex flex-col md:flex-row gap-2"><select value={source} onChange={(e) => setSource(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"><option value="">Duplicada</option>{competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={target} onChange={(e) => setTarget(e.target.value)} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"><option value="">Oficial</option>{competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button disabled={assigning || !source || !target} onClick={() => onMerge(source, target)} className="px-3 py-2 rounded-lg bg-zinc-700 text-white text-sm disabled:opacity-40">Fusionar</button></div></div>;
}