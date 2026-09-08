import React, { useMemo, useState } from "react";

const MD_ORDER = ["MD+1", "MD-5", "MD-4", "MD-3", "MD-2", "MD-1", "MD"];
function playerName(p) { return p?.full_name || [p?.first_name,p?.last_name].filter(Boolean).join(" ") || p?.name || "Jugador"; }
function codeForSession(s) { return String(s?.match_day_code || s?.microcycle_day || "Sin MD").toUpperCase(); }
function fmtDate(d) { if (!d) return "—"; const [y,m,day]=String(d).split("-"); return `${day}/${m}`; }

export default function InternalLoadMicrocycleTab({ sessions = [], sessionPlayers = [], players = [] }) {
  const sortedSessions = useMemo(() => [...sessions].filter((s)=>s.date).sort((a,b)=>String(b.date).localeCompare(String(a.date))), [sessions]);
  const uniqueDates = [...new Set(sortedSessions.map((s)=>s.date))];
  const [anchorDate, setAnchorDate] = useState(uniqueDates[0] || "");
  const anchorIndex = Math.max(0, uniqueDates.indexOf(anchorDate));
  const selectedDates = new Set(uniqueDates.slice(anchorIndex, anchorIndex + 8));
  const selectedSessions = sortedSessions.filter((s)=>selectedDates.has(s.date));
  const sessionMap = new Map(selectedSessions.map((s)=>[s.id,s]));
  const playerMap = new Map(players.map((p)=>[p.id,p]));

  const rows = useMemo(() => {
    const map = new Map();
    for (const sp of sessionPlayers) {
      const s = sessionMap.get(sp.session_id);
      if (!s || sp.internal_load == null) continue;
      const code = codeForSession(s);
      const key = sp.player_id;
      if (!map.has(key)) map.set(key, { player_id:key, player_name:playerName(playerMap.get(key)), position:playerMap.get(key)?.position||"—", total:0, sessions:0, byCode:{} });
      const row = map.get(key);
      const load = Number(sp.internal_load) || 0;
      row.total += load; row.sessions += 1; row.byCode[code] = (row.byCode[code] || 0) + load;
    }
    return [...map.values()].sort((a,b)=>b.total-a.total);
  }, [sessionPlayers, selectedSessions, players]);

  const codes = useMemo(() => {
    const present = new Set(selectedSessions.map(codeForSession));
    const ordered = MD_ORDER.filter((c)=>present.has(c));
    const extra = [...present].filter((c)=>!MD_ORDER.includes(c)).sort();
    return [...ordered,...extra];
  }, [selectedSessions]);

  const squadByCode = useMemo(() => codes.map((code) => {
    const vals = rows.map((r)=>r.byCode[code]).filter((v)=>v!=null && v>0);
    return { code, total: vals.reduce((a,b)=>a+b,0), mean: vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null, players: vals.length };
  }), [rows,codes]);

  if (!sessions.length) return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No hay sesiones para construir el microciclo.</div>;

  return <div className="space-y-4">
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Carga interna del microciclo</h2><p className="text-sm text-zinc-500">Lectura descriptiva por jugador y MD. Sin ratios automáticos ni etiquetas diagnósticas.</p></div><select value={anchorDate} onChange={(e)=>setAnchorDate(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white">{uniqueDates.map((d)=><option key={d} value={d}>Ventana desde {fmtDate(d)}</option>)}</select></div>

    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">{squadByCode.map((item)=><div key={item.code} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-xs font-bold text-violet-300">{item.code}</p><p className="text-xl font-black text-white mt-1">{item.mean ?? "—"}</p><p className="text-[10px] text-zinc-600">sRPE medio · {item.players} jugadores</p><p className="text-[10px] text-zinc-500 mt-1">Total {Math.round(item.total)}</p></div>)}</div>

    <div className="rounded-xl border border-zinc-800 overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-zinc-900 text-zinc-500 text-xs uppercase"><tr><th className="text-left p-3">Jugador</th>{codes.map((c)=><th key={c} className="text-center p-3">{c}</th>)}<th className="text-center p-3">Total</th><th className="text-center p-3">Sesiones</th></tr></thead><tbody className="divide-y divide-zinc-800">{rows.map((r)=><tr key={r.player_id} className="hover:bg-zinc-900/50"><td className="p-3"><p className="text-white font-medium">{r.player_name}</p><p className="text-[10px] text-zinc-600">{r.position}</p></td>{codes.map((c)=><td key={c} className="p-3 text-center text-zinc-300">{r.byCode[c] != null ? Math.round(r.byCode[c]) : "—"}</td>)}<td className="p-3 text-center text-white font-bold">{Math.round(r.total)}</td><td className="p-3 text-center text-zinc-400">{r.sessions}</td></tr>)}</tbody></table>{rows.length===0&&<div className="p-8 text-center text-sm text-zinc-600">Todavía no hay sRPE completo en esta ventana.</div>}</div>

    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-500">La vista suma únicamente cargas ya resueltas. Un RPE sin minutos reales queda pendiente y no se fuerza dentro del microciclo.</div>
  </div>;
}
