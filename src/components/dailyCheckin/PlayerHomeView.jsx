import React from 'react';
import { Calendar, ClipboardList, CheckCircle2, Gauge, Dumbbell, Lock, Clock, MapPin, Video, Heart, ArrowRight, Trophy, FileText } from 'lucide-react';

const EVENT_ICONS = {
  Entrenamiento: Video, Partido: Trophy, Gimnasio: Dumbbell, Cancha: MapPin, Comida: Heart, Descanso: Clock, Viaje: MapPin, Video: Video, Reunión: ClipboardList,
};
function eventIcon(type) { return EVENT_ICONS[type] || Calendar; }

function fmtTime(t) {
  if (!t) return '';
  return t.slice(0, 5);
}

const STATUS_CFG = {
  available_today: { label: 'Disponible hoy', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  in_progress: { label: 'En curso', color: 'text-blue-400', dot: 'bg-blue-400' },
  rpe_pending: { label: 'RPE pendiente', color: 'text-amber-400', dot: 'bg-amber-400' },
  completed: { label: 'Realizado', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  not_completed: { label: 'No realizado', color: 'text-red-400', dot: 'bg-red-400' },
  pending_expired: { label: 'Pendiente vencido', color: 'text-orange-400', dot: 'bg-orange-400' },
  upcoming: { label: 'Próximo', color: 'text-zinc-400', dot: 'bg-zinc-500' },
};

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T12:00:00');
  return date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function PlayerHomeView({ data, onOpenWellness, onOpenRpe, onOpenStrength, onOpenReport, onLogout }) {
  const schedule = data?.schedule || [];
  const wellnessDone = data?.wellness?.status === 'completed';
  const rpeSessions = data?.rpe_sessions || [];
  const rpeCompleted = data?.rpe_completed_sessions || [];
  const strengthToday = data?.strength?.today || [];
  const strengthUpcoming = data?.strength?.upcoming || [];
  const hasRpe = rpeSessions.length > 0 || rpeCompleted.length > 0;
  const rpePending = rpeSessions.length > 0;
  const firstName = data?.player_first_name || '';
  const latestReport = data?.latest_report;
  const isNewReport = latestReport && !JSON.parse(localStorage.getItem("pp_viewed_reports") || "[]").includes(latestReport.id);

  return (
    <div className="min-h-screen bg-zinc-950 max-w-md mx-auto p-5 space-y-7 pb-8">
      {/* Greeting */}
      <div className="pt-4">
        <h1 className="text-2xl font-black text-white">Hola, {firstName}</h1>
        <p className="text-zinc-500 text-sm mt-1 capitalize">{fmtDate(data?.today)} · Tu día</p>
      </div>

      {/* A. Cronograma del día */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2"><Calendar size={15} /> Cronograma del día</h2>
        {schedule.length === 0 ? (
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">No hay actividades programadas para hoy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedule.map((ev) => {
              const Icon = eventIcon(ev.event_type);
              return (
                <div key={ev.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {ev.time && <span className="text-xs font-mono font-bold text-zinc-300">{fmtTime(ev.time)}</span>}
                      <h3 className="text-white font-semibold text-sm truncate">{ev.title}</h3>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-zinc-500">
                      {ev.event_type && <span>{ev.event_type}</span>}
                      {ev.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {ev.location}</span>}
                      {ev.duration_minutes != null && <span className="flex items-center gap-0.5"><Clock size={10} /> {ev.duration_minutes} min</span>}
                      {ev.rival && <span>vs {ev.rival}</span>}
                    </div>
                    {ev.notes && <p className="text-xs text-zinc-600 mt-1">{ev.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Informes de rendimiento */}
      {latestReport && (
        <section>
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2"><FileText size={15} /> Informes de rendimiento</h2>
          <button onClick={onOpenReport} className="w-full text-left p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 active:scale-[0.98] transition-all">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><FileText size={22} className="text-emerald-400" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">Último informe de rendimiento</h3>
                  {isNewReport && <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-zinc-950 text-[10px] font-black">Nuevo</span>}
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{latestReport.match_labels?.[0] || latestReport.title}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  {latestReport.match_dates?.[0] ? new Date(latestReport.match_dates[0] + "T00:00:00").toLocaleDateString("es-AR") : ""}
                  {latestReport.report_type === "multi_match" ? ` · ${latestReport.match_ids?.length || 0} partidos` : ""}
                </p>
              </div>
              <ArrowRight size={16} className="text-zinc-600 shrink-0" />
            </div>
          </button>
        </section>
      )}

      {/* B. Controles diarios */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2"><Heart size={15} /> Controles diarios</h2>

        {/* Wellness */}
        <button
          onClick={() => !wellnessDone && onOpenWellness()}
          disabled={wellnessDone}
          className={`w-full text-left p-4 rounded-2xl border transition-all mb-3 ${wellnessDone ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-zinc-900 border-zinc-800 hover:border-emerald-500/40 active:scale-[0.98]'}`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${wellnessDone ? 'bg-emerald-500/15' : 'bg-emerald-500/10'}`}>
              {wellnessDone ? <CheckCircle2 size={22} className="text-emerald-400" /> : <ClipboardList size={22} className="text-emerald-400" />}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white text-sm">Wellness de hoy</h3>
              <p className="text-xs text-zinc-500 mt-0.5">{wellnessDone ? 'Completado ✓' : 'Pendiente · Tocá para responder'}</p>
            </div>
          </div>
        </button>

        {/* RPE principal */}
        {hasRpe && (
          <div className="space-y-2">
            {rpeSessions.map((s) => {
              const blocked = !wellnessDone;
              return (
                <div key={s.session_id} className={`p-4 rounded-2xl border transition-all ${blocked ? 'bg-zinc-900 border-zinc-800 opacity-80' : 'bg-zinc-900 border-zinc-800 hover:border-blue-500/40 active:scale-[0.98] cursor-pointer'}`} onClick={() => { if (!blocked) onOpenRpe(s); }}>
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${blocked ? 'bg-zinc-800' : 'bg-blue-500/10'}`}>
                      {blocked ? <Lock size={20} className="text-zinc-500" /> : <Gauge size={22} className="text-blue-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-white text-sm">{s.title}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{blocked ? 'Completá el Wellness primero' : 'RPE de la sesión principal · Pendiente'}</p>
                    </div>
                    {!blocked && <ArrowRight size={16} className="text-zinc-600" />}
                  </div>
                </div>
              );
            })}
            {rpeCompleted.map((s) => (
              <div key={s.session_id} className="p-4 rounded-2xl border bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0"><CheckCircle2 size={22} className="text-emerald-400" /></div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm">{s.title}</h3>
                    <p className="text-xs text-emerald-400 mt-0.5">RPE completado · {s.rpe}/10</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* C. Fuerza complementaria */}
      <section>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wide mb-3 flex items-center gap-2"><Dumbbell size={15} /> Entrenamiento complementario de fuerza</h2>

        {strengthToday.length === 0 && strengthUpcoming.length === 0 ? (
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0"><Dumbbell size={22} className="text-zinc-500" /></div>
              <div className="flex-1"><h3 className="font-bold text-white text-sm">Sin entrenamientos</h3><p className="text-xs text-zinc-500 mt-0.5">No tenés fuerza complementaria asignada.</p></div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {strengthToday.map((c) => {
              const cfg = STATUS_CFG[c.status] || STATUS_CFG.available_today;
              return (
                <button key={c.workout_id} onClick={() => onOpenStrength(c)} className="w-full text-left p-4 rounded-2xl bg-zinc-900 border border-zinc-800 hover:border-blue-500/40 active:scale-[0.98] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0"><Dumbbell size={22} className="text-blue-400" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm truncate">{c.title}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${cfg.color}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{c.plan_name}{c.objective ? ` · ${c.objective}` : ''}</p>
                      {c.rpe != null && <p className="text-xs text-emerald-400 mt-0.5">RPE: {c.rpe}/10</p>}
                    </div>
                    <ArrowRight size={16} className="text-zinc-600 shrink-0" />
                  </div>
                </button>
              );
            })}

            {strengthUpcoming.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-zinc-500 font-semibold uppercase mb-2">Próximos</p>
                {strengthUpcoming.map((c) => (
                  <button key={c.workout_id} onClick={() => onOpenStrength(c)} className="w-full text-left p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-all mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0"><Lock size={16} className="text-zinc-500" /></div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-zinc-300 text-sm truncate">{c.title}</h3>
                        <p className="text-xs text-zinc-500 mt-0.5 capitalize">{fmtDate(c.workout_date)} · {c.plan_name}</p>
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0">Disponible el {fmtDate(c.workout_date)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* All done */}
      {wellnessDone && !rpePending && strengthToday.every((c) => c.status === 'completed' || c.status === 'not_completed') && strengthToday.length > 0 && (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-2"><CheckCircle2 size={28} className="text-emerald-400" /></div>
          <h2 className="text-base font-bold text-white">¡Todo al día!</h2>
        </div>
      )}

      <button onClick={onLogout} className="w-full py-3 rounded-xl bg-zinc-800 text-zinc-400 text-sm font-semibold hover:bg-zinc-700 transition-colors">Cerrar sesión</button>
    </div>
  );
}