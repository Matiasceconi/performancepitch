import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, TreePine, Dumbbell } from "lucide-react";
import moment from "moment";
import "moment/locale/es";

moment.locale("es");

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const intensityColors = {
  "Baja":     "bg-blue-500/20 text-blue-300 border-blue-500/30",
  "Media":    "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  "Alta":     "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Muy alta": "bg-red-500/20 text-red-300 border-red-500/30",
};

function SessionPill({ session, type }) {
  const colorClass = intensityColors[session.intensity] || "bg-zinc-700/50 text-zinc-300 border-zinc-600";
  return (
    <div className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${colorClass} truncate`}>
      {type === "field" ? <TreePine size={10} className="shrink-0" /> : <Dumbbell size={10} className="shrink-0" />}
      <span className="truncate">{session.title}</span>
      {session.match_day_code && (
        <span className="font-mono font-bold text-violet-300 shrink-0">{session.match_day_code}</span>
      )}
    </div>
  );
}

export default function Schedule() {
  const [fieldSessions, setFieldSessions] = useState([]);
  const [strengthSessions, setStrengthSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(moment().startOf("month"));
  const [view, setView] = useState("month"); // "month" | "week"
  const [currentWeek, setCurrentWeek] = useState(moment().startOf("isoWeek"));

  useEffect(() => {
    Promise.all([
      base44.entities.TrainingSession.list("-date", 300),
      base44.entities.StrengthSession.list("-date", 300),
    ]).then(([field, strength]) => {
      setFieldSessions(field);
      setStrengthSessions(strength);
    }).finally(() => setLoading(false));
  }, []);

  function getSessionsForDate(dateStr) {
    const field = fieldSessions.filter((s) => s.date === dateStr);
    const strength = strengthSessions.filter((s) => s.date === dateStr);
    return { field, strength };
  }

  // --- MONTH VIEW ---
  function renderMonth() {
    const startOfMonth = currentMonth.clone();
    const endOfMonth = currentMonth.clone().endOf("month");
    // Start grid from Monday of the week containing the 1st
    const gridStart = startOfMonth.clone().startOf("isoWeek");
    const gridEnd = endOfMonth.clone().endOf("isoWeek");

    const days = [];
    let day = gridStart.clone();
    while (day.isSameOrBefore(gridEnd, "day")) {
      days.push(day.clone());
      day.add(1, "day");
    }

    const today = moment().format("YYYY-MM-DD");

    return (
      <div>
        {/* Header nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth((m) => m.clone().subtract(1, "month"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white font-semibold capitalize">{currentMonth.format("MMMM YYYY")}</h2>
          <button onClick={() => setCurrentMonth((m) => m.clone().add(1, "month"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-xs text-zinc-500 font-medium py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-px bg-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const isCurrentMonth = d.isSame(currentMonth, "month");
            const isToday = dateStr === today;
            const { field, strength } = getSessionsForDate(dateStr);
            const total = field.length + strength.length;

            return (
              <div
                key={dateStr}
                className={`bg-zinc-900 min-h-[80px] p-1.5 ${!isCurrentMonth ? "opacity-30" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? "bg-white text-zinc-900" : "text-zinc-400"}`}>
                  {d.date()}
                </div>
                <div className="space-y-0.5">
                  {field.slice(0, 2).map((s) => (
                    <SessionPill key={s.id} session={s} type="field" />
                  ))}
                  {strength.slice(0, 2).map((s) => (
                    <SessionPill key={s.id} session={s} type="strength" />
                  ))}
                  {total > 4 && (
                    <p className="text-xs text-zinc-600">+{total - 4} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- WEEK VIEW ---
  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, i) => currentWeek.clone().add(i, "day"));
    const today = moment().format("YYYY-MM-DD");

    return (
      <div>
        {/* Header nav */}
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentWeek((w) => w.clone().subtract(1, "week"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-white font-semibold">
            {currentWeek.format("D MMM")} – {currentWeek.clone().endOf("isoWeek").format("D MMM YYYY")}
          </h2>
          <button onClick={() => setCurrentWeek((w) => w.clone().add(1, "week"))} className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const dateStr = d.format("YYYY-MM-DD");
            const isToday = dateStr === today;
            const { field, strength } = getSessionsForDate(dateStr);

            return (
              <div key={dateStr} className={`bg-zinc-900 border rounded-xl p-2 ${isToday ? "border-white/20" : "border-zinc-800"}`}>
                <div className="text-center mb-2">
                  <p className="text-xs text-zinc-500 uppercase">{d.format("ddd")}</p>
                  <div className={`text-sm font-bold mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday ? "bg-white text-zinc-900" : "text-white"}`}>
                    {d.date()}
                  </div>
                </div>
                <div className="space-y-1">
                  {field.map((s) => (
                    <div key={s.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <TreePine size={10} className="text-emerald-400 shrink-0" />
                        <span className="text-xs text-white font-medium truncate">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {s.match_day_code && <span className="text-xs font-mono text-violet-300">{s.match_day_code}</span>}
                        {s.intensity && <span className={`text-xs px-1 rounded ${intensityColors[s.intensity] || ""}`}>{s.intensity}</span>}
                        {s.duration_minutes && <span className="text-xs text-zinc-500">{s.duration_minutes}min</span>}
                      </div>
                    </div>
                  ))}
                  {strength.map((s) => (
                    <div key={s.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Dumbbell size={10} className="text-orange-400 shrink-0" />
                        <span className="text-xs text-white font-medium truncate">{s.title}</span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        {s.match_day_code && <span className="text-xs font-mono text-violet-300">{s.match_day_code}</span>}
                        {s.intensity && <span className={`text-xs px-1 rounded ${intensityColors[s.intensity] || ""}`}>{s.intensity}</span>}
                        {s.duration_minutes && <span className="text-xs text-zinc-500">{s.duration_minutes}min</span>}
                      </div>
                    </div>
                  ))}
                  {field.length === 0 && strength.length === 0 && (
                    <p className="text-xs text-zinc-700 text-center py-2">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Calendario</h1>
          <p className="text-zinc-500 text-sm mt-1">Sesiones de campo y fuerza</p>
        </div>
        <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
          <button onClick={() => setView("week")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "week" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            Semana
          </button>
          <button onClick={() => setView("month")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "month" ? "bg-white text-zinc-900" : "text-zinc-400 hover:text-white"}`}>
            Mes
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><TreePine size={12} className="text-emerald-400" /> Campo</span>
        <span className="flex items-center gap-1"><Dumbbell size={12} className="text-orange-400" /> Fuerza</span>
      </div>

      {view === "month" ? renderMonth() : renderWeek()}
    </div>
  );
}