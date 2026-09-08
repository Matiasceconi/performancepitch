import React, { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock, Users, Gauge, Sigma } from 'lucide-react';

const ATTENDANCE_LABEL = {
  presente: 'Presente', diferenciado: 'Diferenciado', kinesiologia: 'Kinesiología', ausente: 'Ausente', no_entrena: 'No entrena',
};
const NO_LOAD = new Set(['ausente', 'no_entrena']);
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
function fmt(d) { if (!d) return ''; const date = new Date(`${d}T12:00:00`); return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`; }
function fullDate(d) { if (!d) return '—'; const [y,m,day] = String(d).split('-'); return `${day}/${m}/${y}`; }
function playerName(p, fallback='') { return p?.full_name || [p?.first_name,p?.last_name].filter(Boolean).join(' ') || fallback || 'Jugador'; }

export default function RpeBySessionTab({ sessions, sessionPlayers, players }) {
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const sortedSessions = useMemo(() => [...sessions].sort((a,b) => String(b.date||'').localeCompare(String(a.date||''))), [sessions]);
  useEffect(() => { if (!selectedSessionId && sortedSessions.length) setSelectedSessionId(sortedSessions[0].id); }, [sortedSessions, selectedSessionId]);
  const session = sortedSessions.find((s) => s.id === selectedSessionId);
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id,p])), [players]);

  const rows = useMemo(() => sessionPlayers
    .filter((sp) => sp.session_id === selectedSessionId)
    .map((sp) => ({
      ...sp,
      player_name: playerName(playerMap.get(sp.player_id), sp.player_name),
      position: playerMap.get(sp.player_id)?.position || sp.position || '',
      minutes: Number(sp.internal_load_minutes ?? sp.minutes) || 0,
      rpe: sp.rpe == null ? null : Number(sp.rpe),
      internal_load: sp.internal_load == null ? null : Number(sp.internal_load),
      no_load: NO_LOAD.has(String(sp.attendance || '').toLowerCase()),
    })), [sessionPlayers, selectedSessionId, playerMap]);

  const eligible = rows.filter((r) => !r.no_load);
  const respondedRows = eligible.filter((r) => r.rpe != null);
  const pendingRows = eligible.filter((r) => r.rpe == null);
  const loadRows = respondedRows.filter((r) => r.internal_load != null);
  const summary = {
    participants: eligible.length,
    responded: respondedRows.length,
    pending: pendingRows.length,
    avgRpe: respondedRows.length ? (respondedRows.reduce((s,r) => s+r.rpe,0)/respondedRows.length).toFixed(1) : null,
    avgLoad: loadRows.length ? Math.round(loadRows.reduce((s,r) => s+r.internal_load,0)/loadRows.length) : null,
    totalLoad: loadRows.length ? Math.round(loadRows.reduce((s,r) => s+r.internal_load,0)) : null,
  };
  const distribution = useMemo(() => Array.from({length:11},(_,i)=>({rpe:i,count:respondedRows.filter((r)=>r.rpe===i).length})), [respondedRows]);

  if (!sessions.length) return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-500">No hay sesiones disponibles.</div>;

  return <div className="space-y-4">
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
      <select value={selectedSessionId} onChange={(e)=>setSelectedSessionId(e.target.value)} className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white min-w-[300px]">
        {sortedSessions.map((s)=><option key={s.id} value={s.id}>{fmt(s.date)} · {s.title || s.name || 'Sesión'} {s.match_day_code ? `(${s.match_day_code})` : ''}</option>)}
      </select>
      {session && <div className="flex flex-wrap gap-2 text-xs text-zinc-400"><span className="px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900">{fullDate(session.date)}</span>{session.match_day_code&&<span className="px-2.5 py-1 rounded border border-violet-500/20 bg-violet-500/10 text-violet-300">{session.match_day_code}</span>}{(session.objective||session.title)&&<span className="px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900">{session.objective||session.title}</span>}<span className="px-2.5 py-1 rounded border border-zinc-800 bg-zinc-900">{session.duration_minutes ? `${session.duration_minutes} min planificados` : 'Duración sin definir'}</span></div>}
    </div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Kpi icon={Users} label="Participantes" value={summary.participants}/><Kpi icon={Gauge} label="Respondieron" value={summary.responded} tone="green"/><Kpi label="Pendientes" value={summary.pending} tone="amber"/><Kpi label="RPE promedio" value={summary.avgRpe ?? '—'} tone="green"/><Kpi icon={Sigma} label="sRPE total" value={summary.totalLoad ?? '—'}/><Kpi icon={Clock} label="sRPE medio" value={summary.avgLoad ?? '—'}/>
    </div>

    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><h3 className="text-sm font-bold text-white mb-3">Distribución RPE</h3><ResponsiveContainer width="100%" height={190}><BarChart data={distribution}><CartesianGrid strokeDasharray="3 3" stroke="#27272a"/><XAxis dataKey="rpe" stroke="#71717a" fontSize={11}/><YAxis allowDecimals={false} stroke="#71717a" fontSize={11}/><Tooltip contentStyle={{background:'#18181b',border:'1px solid #3f3f46',borderRadius:8}}/><Bar dataKey="count" fill="#10b981" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"><h3 className="text-sm font-bold text-white mb-3">Pendientes reales</h3>{pendingRows.length===0?<p className="text-sm text-zinc-500">Todos los participantes elegibles respondieron.</p>:<div className="space-y-2 max-h-[190px] overflow-y-auto">{pendingRows.map((r)=><div key={r.id} className="flex items-center justify-between gap-3 text-sm"><div><span className="text-zinc-200">{r.player_name}</span><span className="text-xs text-zinc-600 ml-2">{ATTENDANCE_LABEL[r.attendance]||r.attendance||'Presente'}</span></div><span className="text-xs text-amber-400">Pendiente</span></div>)}</div>}</div>
    </div>

    <div className="rounded-xl border border-zinc-800 overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-zinc-900 text-zinc-500 text-xs uppercase"><tr><th className="text-left p-3">Jugador</th><th className="text-left p-3">Asistencia</th><th className="text-center p-3">Minutos reales</th><th className="text-center p-3">RPE</th><th className="text-center p-3">sRPE</th><th className="text-left p-3">Comentario</th><th className="text-center p-3">Hora</th><th className="text-center p-3">Estado</th></tr></thead><tbody className="divide-y divide-zinc-800">{rows.map((r)=><tr key={r.id} className="hover:bg-zinc-900/50"><td className="p-3"><p className="font-medium text-white">{r.player_name}</p><p className="text-[10px] text-zinc-600">{r.position||'—'}</p></td><td className="p-3 text-zinc-400">{ATTENDANCE_LABEL[r.attendance]||r.attendance||'—'}</td><td className="p-3 text-center text-zinc-300">{r.no_load?'—':(r.minutes||'Pend.')}</td><td className="p-3 text-center font-bold text-emerald-400">{r.no_load?'—':(r.rpe??'—')}</td><td className="p-3 text-center text-zinc-300">{r.no_load?'—':r.internal_load!=null?r.internal_load:r.rpe!=null?<span className="text-xs text-amber-400">Pend. minutos</span>:'—'}</td><td className="p-3 text-zinc-400 text-xs max-w-[220px] truncate">{r.rpe_comment||'—'}</td><td className="p-3 text-center text-zinc-500 text-xs">{r.rpe_updated_at?new Date(r.rpe_updated_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'—'}</td><td className="p-3 text-center">{r.no_load?<span className="text-xs text-zinc-600">Sin carga</span>:r.rpe==null?<span className="text-xs text-amber-400">Pendiente</span>:r.internal_load==null?<span className="text-xs text-orange-400">Falta minutos</span>:<span className="text-xs text-emerald-400">Completo</span>}</td></tr>)}</tbody></table></div>
    <p className="text-xs text-zinc-600">sRPE = RPE × minutos realmente realizados. Diferenciados, kinesiología y reintegros requieren minutos individuales; los ausentes no generan carga.</p>
  </div>;
}

function Kpi({icon:Icon,label,value,tone}) { const color=tone==='green'?'text-emerald-400':tone==='amber'?'text-amber-400':'text-white'; return <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">{Icon&&<Icon size={13} className="text-zinc-500"/>}<p className={`text-2xl font-black mt-1 ${color}`}>{value}</p><p className="text-xs text-zinc-500">{label}</p></div>; }
