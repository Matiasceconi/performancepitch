import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Save, X, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const DYJ_LOGO = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png";

const CLUB_LOGOS = {
  "aldosivi": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/8996d21df_aldosivi.png",
  "argentinos": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/0e05a002a_argentinos.png",
  "banfield": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/58c2bc7ed_banfield.png",
  "barracas": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4fcdd62b6_barracas.png",
  "belgrano": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/67af3c8f1_belgrano.png",
  "boca": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/276a7aa08_boca.png",
  "central cordoba": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/e18f29c5d_centralcordoba.png",
  "defensa": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png",
  "defensa y justicia": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png",
  "estudiantes": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/3a3706975_estudiantes.png",
  "ferro": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/bed607ceb_ferro.png",
  "ferro carril oeste": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/bed607ceb_ferro.png",
  "gimnasia": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/6114df84b_gimnasia.png",
  "huracan": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/933efb702_huracan.png",
  "independiente": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a2a471da7_independiente.png",
  "lanus": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/99213e3ca_lanus.png",
  "newells": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/9050b34cc_newells.png",
  "platense": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/7ff5c5303_platense.png",
  "racing": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/e0d6a6146_racing.png",
  "river": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/7efeaf539_river.png",
  "river plate": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/7efeaf539_river.png",
  "rosario central": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/724bdfba3_rosariocentral.png",
  "san lorenzo": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/2b8112b77_sanlorenzo.png",
  "talleres": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/070c306fb_talleres.png",
  "tigre": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/913703796_tigre.png",
  "union": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/16e7a6924_union.png",
  "velez": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/973c619a4_velez.png",
  "san martin": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/03e039b58_sanmartinsj.png",
  "quilmes": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a2c70d41a_quilmes.png",
  "sarmiento": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/db1e161fb_sarmiento.png",
};

function normalizeStr(str) {
  return (str || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getLogoForRival(name) {
  if (!name) return null;
  const key = normalizeStr(name);
  for (const [k, v] of Object.entries(CLUB_LOGOS)) {
    if (normalizeStr(k) === key) return v;
  }
  return null;
}

const EMPTY_MATCH = { date: "", rival: "", location: "Local", our_score: "", rival_score: "" };

const DIVISIONS = ["Cuarta División", "Quinta División", "Sexta División"];
const DIV_COLORS = {
  "Cuarta División": "text-yellow-400 border-yellow-800/50 bg-yellow-900/20",
  "Quinta División": "text-violet-400 border-violet-800/50 bg-violet-900/20",
  "Sexta División":  "text-cyan-400 border-cyan-800/50 bg-cyan-900/20",
};

function ClubLogo({ url, name, size = 8 }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div className={`w-${size} h-${size} rounded-full bg-zinc-700 flex items-center justify-center shrink-0`}>
        <span className="text-[10px] font-bold text-zinc-400">{(name || "?").charAt(0)}</span>
      </div>
    );
  }
  return <img src={url} alt={name} className={`w-${size} h-${size} object-contain shrink-0`} onError={() => setErr(true)} />;
}

function PlayerRow({ player, minutesMap, setMinutesMap }) {
  return (
    <div className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-800/30">
      {player.photo_url ? (
        <img src={player.photo_url} alt={player.full_name} className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-zinc-400">{player.full_name?.charAt(0)}</span>
        </div>
      )}
      <span className="text-xs text-zinc-400 font-mono w-5 text-center shrink-0">{player.jersey_number || "—"}</span>
      <span className="text-sm text-white flex-1 truncate">{player.full_name}</span>
      <input
        type="number" min="0" max="120" placeholder="min"
        value={minutesMap[player.id]?.minutes ?? ""}
        onChange={(e) => setMinutesMap(m => ({ ...m, [player.id]: { minutes: e.target.value, name: player.full_name } }))}
        className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-violet-500/50 shrink-0"
      />
    </div>
  );
}

function JuvMatchCard({ match, players, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [minutesMap, setMinutesMap] = useState({});
  const [existingRecords, setExistingRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const hasResult = match.our_score != null && match.rival_score != null;
  const won = match.our_score > match.rival_score;
  const drew = match.our_score === match.rival_score;

  const rivalLogo = match.rival_logo_url || getLogoForRival(match.rival);
  const isLocal = match.location === "Local";
  const leftLogo = isLocal ? DYJ_LOGO : rivalLogo;
  const rightLogo = isLocal ? rivalLogo : DYJ_LOGO;

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    base44.entities.MinutesRecord.filter(
      { match_date: match.date, tournament: "Juveniles" }, "-created_date", 200
    ).then((records) => {
      setExistingRecords(records);
      const map = {};
      records.forEach((r) => {
        if (r.player_id) map[r.player_id] = { minutes: r.minutes ?? "", name: r.player_name };
        else if (r.player_name) map[`name:${r.player_name}`] = { minutes: r.minutes ?? "", name: r.player_name };
      });
      setMinutesMap(map);
    }).finally(() => setLoading(false));
  }, [expanded, match.date]);

  async function saveMinutes() {
    setSaving(true);
    try {
      const matchLabel = `vs ${match.rival} ${moment(match.date).format("DD/MM/YY")} (Juv)`;
      for (const [key, val] of Object.entries(minutesMap)) {
        if (val.minutes === "" || val.minutes === undefined) continue;
        const isPlayerId = !key.startsWith("name:");
        const existing = existingRecords.find(r => isPlayerId ? r.player_id === key : r.player_name === val.name);
        const payload = {
          tournament: "Juveniles", match_label: matchLabel,
          match_date: match.date, rival: match.rival,
          minutes: Number(val.minutes), player_name: val.name,
          ...(isPlayerId ? { player_id: key } : {}),
        };
        if (existing) {
          await base44.entities.MinutesRecord.update(existing.id, { minutes: Number(val.minutes) });
        } else {
          await base44.entities.MinutesRecord.create(payload);
        }
      }
      toast({ title: "Minutos guardados" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Jugadores por división (incluye Reserva que hayan bajado a Juveniles)
  const juvenilePlayers = players.filter(p =>
    DIVISIONS.includes(p.division) || p.division === "Reserva"
  );
  const byDivision = DIVISIONS.map(div => ({
    div,
    players: juvenilePlayers.filter(p => p.division === div),
  }));
  const reservaBajaron = juvenilePlayers.filter(p => p.division === "Reserva");

  // Conteo de minutos cargados
  const withMinutes = Object.values(minutesMap).filter(v => v.minutes && Number(v.minutes) > 0).length;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <div className="text-center min-w-[44px] shrink-0">
          <p className="text-white font-bold text-sm">{moment(match.date).format("DD/MM")}</p>
          <p className="text-zinc-600 text-xs">{moment(match.date).format("YY")}</p>
        </div>

        {/* Escudos + marcador */}
        <div className="flex items-center gap-3 flex-1 justify-center px-3">
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-xs text-zinc-300 hidden sm:block truncate max-w-[80px] text-right">
              {isLocal ? "Def. y Justicia" : match.rival}
            </span>
            <ClubLogo url={leftLogo} name={isLocal ? "DyJ" : match.rival} size={8} />
          </div>

          {hasResult ? (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-base shrink-0 ${won ? "bg-green-900/40 text-green-400" : drew ? "bg-zinc-700 text-zinc-200" : "bg-red-900/40 text-red-400"}`}>
              <span>{isLocal ? match.our_score : match.rival_score}</span>
              <span className="text-zinc-500 text-xs mx-0.5">-</span>
              <span>{isLocal ? match.rival_score : match.our_score}</span>
            </div>
          ) : (
            <div className="px-3 py-1 text-zinc-600 text-xs shrink-0">vs</div>
          )}

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ClubLogo url={rightLogo} name={isLocal ? match.rival : "DyJ"} size={8} />
            <span className="text-xs text-zinc-300 hidden sm:block truncate max-w-[80px]">
              {isLocal ? match.rival : "Def. y Justicia"}
            </span>
          </div>
        </div>

        {/* Info + acciones */}
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${isLocal ? "bg-green-900/30 text-green-400" : "bg-orange-900/30 text-orange-400"}`}>
            {match.location}
          </span>
          {withMinutes > 0 && (
            <span className="text-xs text-violet-400 font-mono">{withMinutes}j</span>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(match.id); }} className="p-1.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Minutos jugados por categoría</p>
            <button onClick={saveMinutes} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 rounded-lg transition-colors disabled:opacity-50">
              {saving ? <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4"><div className="w-4 h-4 border border-zinc-700 border-t-white rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {/* Secciones por división */}
              {byDivision.map(({ div, players: divPlayers }) => divPlayers.length === 0 ? null : (
                <div key={div} className={`border rounded-xl overflow-hidden ${DIV_COLORS[div]}`}>
                  <div className="px-3 py-2 border-b border-current/20">
                    <p className="text-xs font-semibold uppercase tracking-wider">{div}</p>
                  </div>
                  <div className="p-2 space-y-0.5 bg-zinc-900">
                    {divPlayers.map(p => (
                      <PlayerRow key={p.id} player={p} minutesMap={minutesMap} setMinutesMap={setMinutesMap} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Jugadores de Reserva que bajaron */}
              {reservaBajaron.length > 0 && (
                <div className="border border-yellow-700/40 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-yellow-700/30 bg-yellow-900/10">
                    <p className="text-xs font-semibold uppercase tracking-wider text-yellow-500">Reserva (bajaron a Juveniles)</p>
                  </div>
                  <div className="p-2 space-y-0.5 bg-zinc-900">
                    {reservaBajaron.map(p => (
                      <PlayerRow key={p.id} player={p} minutesMap={minutesMap} setMinutesMap={setMinutesMap} />
                    ))}
                  </div>
                </div>
              )}

              {/* Registros ya existentes por nombre (sin player_id vinculado) */}
              {existingRecords.filter(r => !r.player_id && r.minutes > 0).length > 0 && (
                <div className="border border-zinc-700 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-700 bg-zinc-800/40">
                    <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Registros importados (sin ID)</p>
                  </div>
                  <div className="p-2 space-y-0.5 bg-zinc-900">
                    {existingRecords.filter(r => !r.player_id && r.minutes > 0).map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-zinc-400">
                        <span className="text-sm flex-1">{r.player_name}</span>
                        <span className="text-sm font-mono text-white">{r.minutes}'</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function JuvenileMatchPanel({ players }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MATCH);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadMatches(); }, []);

  async function loadMatches() {
    const data = await base44.entities.MatchReport.filter({ competition: "Juveniles" }, "-date", 100);
    setMatches(data);
    setLoading(false);
  }

  async function saveMatch() {
    if (!form.rival || !form.date) return;
    const autoLogo = getLogoForRival(form.rival);
    await base44.entities.MatchReport.create({
      ...form,
      competition: "Juveniles",
      rival_logo_url: autoLogo || null,
      our_score: form.our_score !== "" ? Number(form.our_score) : null,
      rival_score: form.rival_score !== "" ? Number(form.rival_score) : null,
    });
    toast({ title: "Partido de juveniles creado" });
    setForm(EMPTY_MATCH);
    setShowForm(false);
    loadMatches();
  }

  async function deleteMatch(id) {
    if (!confirm("¿Eliminar este partido?")) return;
    await base44.entities.MatchReport.delete(id);
    loadMatches();
  }

  async function runImport() {
    setImporting(true);
    try {
      const result = await base44.functions.invoke("importJuvenileMinutes", {});
      toast({ title: `Importación: ${result.data?.created || 0} registros creados, ${result.data?.skipped || 0} omitidos` });
    } catch (e) {
      toast({ title: "Error en importación: " + e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const previewLogo = getLogoForRival(form.rival);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-zinc-400 text-sm">{matches.length} partido{matches.length !== 1 ? "s" : ""}</p>
        <div className="flex gap-2">
          <button onClick={runImport} disabled={importing}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-700/50 border border-zinc-600 text-zinc-300 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {importing ? <div className="w-4 h-4 border border-zinc-400 border-t-transparent rounded-full animate-spin" /> : "↓"}
            Importar planilla
          </button>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 rounded-lg text-sm font-medium transition-colors">
            <Plus size={15} /> Nuevo partido
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <p className="text-white font-semibold">Nuevo partido — Juveniles</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Rival *</label>
              <div className="relative flex items-center gap-2">
                {previewLogo && <img src={previewLogo} className="w-6 h-6 object-contain shrink-0" />}
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                  placeholder="Nombre del rival"
                  value={form.rival}
                  onChange={e => set("rival", e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
              <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.date} onChange={e => set("date", e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Condición</label>
              <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" value={form.location} onChange={e => set("location", e.target.value)}>
                <option>Local</option><option>Visitante</option><option>Neutral</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Goles propios</label>
                <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" placeholder="—" value={form.our_score} onChange={e => set("our_score", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Goles rival</label>
                <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none" placeholder="—" value={form.rival_score} onChange={e => set("rival_score", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_MATCH); }} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-1"><X size={14} /> Cancelar</button>
            <button onClick={saveMatch} disabled={!form.rival || !form.date} className="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 flex items-center gap-1"><Check size={14} /> Guardar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" /></div>
      ) : matches.length === 0 && !showForm ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No hay partidos registrados. Presioná "Importar planilla" para cargar los 15 partidos de la temporada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map(m => <JuvMatchCard key={m.id} match={m} players={players} onDelete={deleteMatch} />)}
        </div>
      )}
    </div>
  );
}