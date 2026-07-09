import React from "react";
import { Printer } from "lucide-react";
import moment from "moment";
import { CLUB_BRAND } from "@/lib/clubBrand";
import PlayerPhoto from "@/components/player/PlayerPhoto";

function pct(value, total) {
  if (!total) return 0;
  return Math.round((Number(value || 0) / total) * 100);
}

function minutes(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("es-AR")}'`;
}

function PctPill({ value }) {
  const bg = value >= 70 ? CLUB_BRAND.colors.green : value >= 40 ? CLUB_BRAND.colors.yellow : value >= 10 ? "#F59E0B" : "#D1D5DB";
  const color = value >= 40 ? CLUB_BRAND.colors.greenDeep : CLUB_BRAND.colors.ink;
  return <span className="inline-flex min-w-12 justify-center rounded-full px-2 py-1 text-[10px] font-black" style={{ backgroundColor: bg, color }}>{value}%</span>;
}

export default function MinutesExportView({ rows, torneo, viewMode = "ambos", playerMap, activeSquad, activeSeasonId, onExit }) {
  const totals = rows.reduce((acc, row) => ({
    res: acc.res + Number(row.res || 0),
    juv: acc.juv + Number(row.juv || 0),
    total: acc.total + Number(row.res || 0) + Number(row.juv || 0),
  }), { res: 0, juv: 0, total: 0 });
  const showRes = torneo?.res_total !== null && (viewMode === "reserva" || viewMode === "ambos");
  const showJuv = torneo?.juv_total !== null && (viewMode === "juveniles" || viewMode === "ambos");
  const viewLabel = viewMode === "reserva" ? "Reserva" : viewMode === "juveniles" ? "Juveniles" : "Reserva + Juveniles";

  function downloadCsv() {
    const headers = ["Jugador", "Posición", ...(showRes ? ["Reserva"] : []), ...(showJuv ? ["Juveniles"] : []), "Total"];
    const lines = rows.map((row, index) => {
      const player = row.player_id ? playerMap[row.player_id] : null;
      const total = (showRes ? Number(row.res || 0) : 0) + (showJuv ? Number(row.juv || 0) : 0);
      return [row.player_name, player?.position || "", ...(showRes ? [row.res || 0] : []), ...(showJuv ? [row.juv || 0] : []), total]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",");
    });
    const blob = new Blob([[headers.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `minutos-${viewMode}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-white text-zinc-950 p-6 print:p-0">
      <style>{`@media print { .no-print { display: none !important; } body { background: white !important; } .break-inside-avoid { break-inside: avoid; } }`}</style>
      <div className="no-print flex justify-end gap-2 mb-4">
        <button onClick={downloadCsv} className="px-3 py-2 bg-emerald-700 text-white rounded-lg text-sm">Descargar Excel CSV</button>
        <button onClick={() => window.print()} className="px-3 py-2 bg-zinc-900 text-white rounded-lg text-sm flex items-center gap-2"><Printer size={15} /> Imprimir / PDF</button>
        <button onClick={onExit} className="px-3 py-2 bg-zinc-200 rounded-lg text-sm">Volver</button>
      </div>

      <div className="rounded-2xl border-b-4 pb-4 mb-5 p-4 flex justify-between items-start" style={{ borderColor: CLUB_BRAND.colors.green, background: `linear-gradient(135deg, ${CLUB_BRAND.colors.panel}, #ffffff 62%, ${CLUB_BRAND.colors.yellow}22)` }}>
        <div className="flex items-center gap-4">
          <img src={CLUB_BRAND.logoUrl} alt={CLUB_BRAND.name} className="w-16 h-16 object-contain" />
          <div>
            <p className="text-xs font-bold uppercase" style={{ color: CLUB_BRAND.colors.greenDark }}>{CLUB_BRAND.name}</p>
            <h1 className="text-3xl font-black">Minutos Jugados</h1>
            <p className="text-sm text-zinc-600">{activeSquad?.name || "Plantel"} · {activeSeasonId || activeSquad?.season || "Temporada"} · {torneo?.label || "Todo el semestre"} · {viewLabel}</p>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-black uppercase" style={{ color: CLUB_BRAND.colors.greenDeep }}>Informe exportable</p>
          <p className="text-zinc-600">{moment().format("DD/MM/YYYY HH:mm")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl border p-3" style={{ borderColor: CLUB_BRAND.colors.line }}><p className="text-[10px] font-black uppercase text-zinc-500">Jugadores</p><p className="text-2xl font-black">{rows.length}</p></div>
        {showRes && <div className="rounded-xl border p-3" style={{ borderColor: CLUB_BRAND.colors.line }}><p className="text-[10px] font-black uppercase text-zinc-500">Reserva</p><p className="text-2xl font-black" style={{ color: CLUB_BRAND.colors.greenDark }}>{minutes(totals.res)}</p></div>}
        {showJuv && <div className="rounded-xl border p-3" style={{ borderColor: CLUB_BRAND.colors.line }}><p className="text-[10px] font-black uppercase text-zinc-500">Juveniles</p><p className="text-2xl font-black" style={{ color: CLUB_BRAND.colors.greenDark }}>{minutes(totals.juv)}</p></div>}
        <div className="rounded-xl border p-3" style={{ borderColor: CLUB_BRAND.colors.line }}><p className="text-[10px] font-black uppercase text-zinc-500">Total</p><p className="text-2xl font-black">{minutes((showRes ? totals.res : 0) + (showJuv ? totals.juv : 0))}</p></div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: CLUB_BRAND.colors.line }}>
        <div className="grid items-center px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white" style={{ gridTemplateColumns: showRes && showJuv ? "42px 1.25fr .8fr .75fr .75fr .65fr" : "42px 1.35fr .9fr .85fr .65fr", backgroundColor: CLUB_BRAND.colors.greenDark }}>
          <span>Foto</span><span>Jugador</span><span>Posición</span>{showRes && <span>Reserva</span>}{showJuv && <span>Juveniles</span>}<span>Total</span>
        </div>
        <div>
          {rows.map((row, index) => {
            const player = row.player_id ? playerMap[row.player_id] : null;
            const resPct = pct(row.res, torneo?.res_total);
            const juvPct = pct(row.juv, torneo?.juv_total);
            return (
              <div key={row.player_id || row.player_name} className="grid items-center gap-3 px-3 py-2.5 border-b break-inside-avoid" style={{ gridTemplateColumns: showRes && showJuv ? "42px 1.25fr .8fr .75fr .75fr .65fr" : "42px 1.35fr .9fr .85fr .65fr", borderColor: CLUB_BRAND.colors.line, backgroundColor: index % 2 ? "#FFFFFF" : CLUB_BRAND.colors.panel }}>
                <PlayerPhoto player={player || { full_name: row.player_name }} alt={row.player_name} className="w-9 h-9 rounded-full object-cover border border-zinc-300 bg-white" fallbackClassName="w-9 h-9 rounded-full border border-zinc-300 flex items-center justify-center" textClassName="text-xs font-black" />
                <div><p className="text-sm font-black">{row.player_name}</p><p className="text-[10px] text-zinc-500 font-bold">#{player?.jersey_number || row.player_number || index + 1}</p></div>
                <p className="text-xs font-bold text-zinc-600">{player?.position || "—"}</p>
                {showRes && <div><p className="text-sm font-black">{minutes(row.res)}</p><PctPill value={resPct} /></div>}
                {showJuv && <div><p className="text-sm font-black">{minutes(row.juv)}</p><PctPill value={juvPct} /></div>}
                <p className="text-sm font-black" style={{ color: CLUB_BRAND.colors.greenDeep }}>{minutes((showRes ? Number(row.res || 0) : 0) + (showJuv ? Number(row.juv || 0) : 0))}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}