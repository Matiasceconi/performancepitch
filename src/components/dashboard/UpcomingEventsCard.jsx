import React from "react";
import { Link } from "react-router-dom";
import moment from "moment";
import { ChevronRight } from "lucide-react";

export default function UpcomingEventsCard({ events }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">Próximos eventos</h2>
        <Link to="/schedule" className="text-xs text-zinc-500 hover:text-white flex items-center gap-1">
          Ver cronograma <ChevronRight size={14} />
        </Link>
      </div>
      <div className="p-3">
        {events.length === 0 ? (
          <p className="text-zinc-600 text-sm text-center py-5">Sin eventos próximos</p>
        ) : (
          <div className="space-y-1.5">
            {events.map(ev => (
              <div key={ev.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/60">
                <p className="text-sm text-white font-medium truncate">{ev.title}</p>
                <p className="text-xs text-zinc-500 capitalize shrink-0 ml-2">
                  {moment(ev.date).format("ddd D MMM")}{ev.time ? ` · ${ev.time}` : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}