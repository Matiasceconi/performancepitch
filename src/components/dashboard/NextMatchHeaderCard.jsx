import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";
import moment from "moment";

export default function NextMatchHeaderCard({ match, matchReport }) {
  const [logoError, setLogoError] = useState(false);
  const daysLeft = moment(match.date).diff(moment().startOf("day"), "days");
  const rivalName = matchReport?.rival || match.title;
  const logoUrl = matchReport?.rival_logo_url || match.rival_logo_url;

  return (
    <div className="bg-zinc-800/60 border border-zinc-700 rounded-xl p-4 flex items-center gap-4 lg:w-auto w-full">
      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
        {logoUrl && !logoError
          ? <img src={logoUrl} alt="Rival" className="w-full h-full object-contain p-1" onError={() => setLogoError(true)} />
          : <Shield size={20} className="text-zinc-500" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Próximo partido</p>
        <p className="text-white font-bold text-sm truncate">{rivalName}</p>
        <p className="text-zinc-400 text-xs">
          {matchReport?.location ? `${matchReport.location} · ` : ""}
          {moment(match.date).format("DD/MM")}
          {match.time ? ` · ${match.time}hs` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-2xl font-black text-white leading-none">{daysLeft}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{daysLeft === 1 ? "día" : "días"}</p>
      </div>
      <Link to="/matches"
        className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 transition-colors font-medium">
        Ver partido
      </Link>
    </div>
  );
}