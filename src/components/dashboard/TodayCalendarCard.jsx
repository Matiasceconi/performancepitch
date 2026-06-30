import React from "react";
import { Link } from "react-router-dom";
import { Clock, MapPin, ChevronRight } from "lucide-react";

const COLOR_DOT = {
  blue: "bg-blue-400", green: "bg-emerald-400", yellow: "bg-yellow-400", orange: "bg-orange-400",
  red: "bg-red-400", purple: "bg-violet-400", pink: "bg-pink-400", cyan: "bg-cyan-400",
};

export default function TodayCalendarCard({ events }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Calendario de hoy</h2>
        <Link to="/schedule" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver cronograma <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-3">
        {events.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-5">Sin eventos para hoy</p>
        ) : (
          <div className="space-y-1.5">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/60">
                <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[ev.color] || "bg-blue-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-zinc-500 flex items-center gap-3">
                    {ev.time && <span className="flex items-center gap-1"><Clock size={10} />{ev.time}</span>}
                    {ev.location && <span className="flex items-center gap-1 truncate"><MapPin size={10} />{ev.location}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}