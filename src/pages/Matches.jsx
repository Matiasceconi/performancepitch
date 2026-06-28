import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ChevronDown, ChevronUp, Edit2, Trash2, Youtube, Users, FileText, X, Check, Upload, FileSpreadsheet, ExternalLink, Clock, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
import JuvenileMatchPanel from "@/components/matches/JuvenileMatchPanel.jsx";
moment.locale("es");

const DYJ_LOGO = "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png";

const CLUB_LOGOS = {
  "aldosivi": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/8996d21df_aldosivi.png",
  "argentinos": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/0e05a002a_argentinos.png",
  "argentinos juniors": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/0e05a002a_argentinos.png",
  "atletico tucuman": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/610e3b50e_atleticotucuman.png",
  "atlético tucumán": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/610e3b50e_atleticotucuman.png",
  "banfield": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/58c2bc7ed_banfield.png",
  "barracas": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4fcdd62b6_barracas.png",
  "barracas central": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4fcdd62b6_barracas.png",
  "belgrano": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/67af3c8f1_belgrano.png",
  "boca": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/276a7aa08_boca.png",
  "boca juniors": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/276a7aa08_boca.png",
  "central cordoba": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/e18f29c5d_centralcordoba.png",
  "central córdoba": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/e18f29c5d_centralcordoba.png",
  "defensa": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png",
  "defensa y justicia": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/4379a507a_defensa.png",
  "estudiantes": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/3a3706975_estudiantes.png",
  "estudiantes lp": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/3a3706975_estudiantes.png",
  "estudiantes la plata": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/3a3706975_estudiantes.png",
  "estudiantes (lp)": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/075a5dfb0_estudiantes2.png",
  "estudiantes rc": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/82d92e869_estudiantesrc.png",
  "estudiantes rio cuarto": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/82d92e869_estudiantesrc.png",
  "gimnasia": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/6114df84b_gimnasia.png",
  "gimnasia lp": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/6114df84b_gimnasia.png",
  "gimnasia la plata": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/6114df84b_gimnasia.png",
  "gimnasia mendoza": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/9488b9e24_gimnasiamendoza.png",
  "huracan": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/933efb702_huracan.png",
  "huracán": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/933efb702_huracan.png",
  "independiente": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a2a471da7_independiente.png",
  "independiente rivadavia": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/9fabf18c5_independienteriv.png",
  "instituto": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a9ad926b0_instituto.png",
  "lanus": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/99213e3ca_lanus.png",
  "lanús": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/99213e3ca_lanus.png",
  "newells": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/9050b34cc_newells.png",
  "newell's": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/9050b34cc_newells.png",
  "newell's old boys": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/9050b34cc_newells.png",
  "platense": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/7ff5c5303_platense.png",
  "racing": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/e0d6a6146_racing.png",
  "racing club": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/e0d6a6146_racing.png",
  "riestra": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/d8ac90e42_riestra.png",
  "deportivo riestra": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/d8ac90e42_riestra.png",
  "river": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/7efeaf539_river.png",
  "river plate": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/7efeaf539_river.png",
  "rosario central": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/724bdfba3_rosariocentral.png",
  "san lorenzo": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/2b8112b77_sanlorenzo.png",
  "sarmiento": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/db1e161fb_sarmiento.png",
  "talleres": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/070c306fb_talleres.png",
  "tigre": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/913703796_tigre.png",
  "union": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/16e7a6924_union.png",
  "unión": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/16e7a6924_union.png",
  "union sf": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/16e7a6924_union.png",
  "velez": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/973c619a4_velez.png",
  "vélez": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/973c619a4_velez.png",
  "velez sarsfield": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/973c619a4_velez.png",
  "san martin": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/03e039b58_sanmartinsj.png",
  "san martín": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/03e039b58_sanmartinsj.png",
  "colon": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a2c70d41a_quilmes.png",
  "colón": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a2c70d41a_quilmes.png",
  "ferro": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/bed607ceb_ferro.png",
  "ferro carril oeste": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/bed607ceb_ferro.png",
  "quilmes": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a2c70d41a_quilmes.png",
  "atletico rafaela": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a105893ba_atleticorafaela.png",
  "atlético rafaela": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/a105893ba_atleticorafaela.png",
  "estudiantes de rio cuarto": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/82d92e869_estudiantesrc.png",
  "estudiantes de río cuarto": "https://media.base44.com/images/public/6a3bc03033558cd65ec27f53/82d92e869_estudiantesrc.png",
};

function normalizeStr(str) {
  return str.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "");
}

function getLogoForRival(name) {
  if (!name) return null;
  const key = normalizeStr(name);
  // Try normalized keys
  for (const [k, v] of Object.entries(CLUB_LOGOS)) {
    if (normalizeStr(k) === key) return v;
  }
  return null;
}

// ── CSV Panel ─────────────────────────────────────────────────────────────────
function MatchCsvPanel({ match, onCsvSaved }) {
  const [csvUrl, setCsvUrl] = useState(match.csv_url || null);
  const [csvLabel, setCsvLabel] = useState(match.csv_label || null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.MatchReport.update(match.id, { csv_url: file_url, csv_label: file.name });
      setCsvUrl(file_url);
      setCsvLabel(file.name);
      onCsvSaved?.(file_url, file.name);
      toast({ title: "CSV cargado correctamente" });
    } catch {
      toast({ title: "Error al cargar el CSV", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function removeCsv() {
    await base44.entities.MatchReport.update(match.id, { csv_url: null, csv_label: null });
    setCsvUrl(null);
    setCsvLabel(null);
    onCsvSaved?.(null, null);
    toast({ title: "CSV eliminado" });
  }

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-white flex items-center gap-2">
            <FileSpreadsheet size={14} className="text-green-400" /> Datos GPS del partido
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">CSV Catapult del partido</p>
        </div>
        {csvUrl && (
          <div className="flex items-center gap-2">
            <a href={csvUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-white p-1.5 rounded hover:bg-zinc-700 transition-colors">
              <ExternalLink size={13} />
            </a>
            <button onClick={removeCsv} className="text-zinc-600 hover:text-red-400 p-1.5 rounded hover:bg-zinc-700 transition-colors">
              <X size={13} />
            </button>
          </div>
        )}
      </div>
      {!csvUrl ? (
        <label className="cursor-pointer block">
          <div className={`flex items-center justify-center gap-2 border border-dashed border-zinc-700 rounded-xl px-4 py-6 text-sm text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
            {uploading ? <div className="w-4 h-4 border border-zinc-500 border-t-white rounded-full animate-spin" /> : <Upload size={16} />}
            {uploading ? "Subiendo..." : "Cargar CSV del partido"}
          </div>
          <input type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      ) : (
        <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2">
          <FileSpreadsheet size={13} className="text-green-400 shrink-0" />
          <span className="text-xs text-zinc-300 flex-1 truncate">{csvLabel || "Archivo CSV"}</span>
          <label className="cursor-pointer">
            <span className={`text-xs text-zinc-500 hover:text-white transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
              {uploading ? "Subiendo..." : "Reemplazar"}
            </span>
            <input type="file" accept=".csv,.txt" onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      )}
    </div>
  );
}

// ── Convocados con minutos ────────────────────────────────────────────────────
function SquadMinutesPanel({ match, players }) {
  const { toast } = useToast();
  const [minutesMap, setMinutesMap] = useState({});
  const [existingRecords, setExistingRecords] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const convocadosIds = match.squad_called || [];
  const convocados = players.filter(p => convocadosIds.includes(p.id));

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const records = await base44.entities.MinutesRecord.filter({ match_date: match.date }, "-created_date", 100);
        setExistingRecords(records);
        const map = {};
        records.forEach(r => {
          if (r.player_id) map[r.player_id] = r.minutes ?? "";
        });
        setMinutesMap(map);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [match.id, match.date]);

  async function saveMinutes() {
    setSaving(true);
    try {
      const matchLabel = `vs ${match.rival} ${moment(match.date).format("DD/MM/YY")}`;
      for (const player of convocados) {
        const mins = minutesMap[player.id];
        const existing = existingRecords.find(r => r.player_id === player.id);
        const minutesVal = mins !== "" && mins !== undefined ? Number(mins) : 0;
        if (existing) {
          await base44.entities.MinutesRecord.update(existing.id, { minutes: minutesVal });
        } else {
          await base44.entities.MinutesRecord.create({
            player_id: player.id,
            player_name: player.full_name,
            player_number: player.jersey_number || player.number,
            tournament: "Proyección Apertura",
            match_label: matchLabel,
            match_date: match.date,
            rival: match.rival,
            minutes: minutesVal,
          });
        }
      }
      toast({ title: "Minutos guardados correctamente" });
    } catch {
      toast({ title: "Error al guardar minutos", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 flex justify-center">
      <div className="w-4 h-4 border border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (convocados.length === 0) return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 text-center">
      <p className="text-zinc-500 text-sm">Sin convocados registrados — editar el partido para agregarlos</p>
    </div>
  );

  return (
    <div className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock size={14} className="text-yellow-400" /> Minutos jugados — Convocados ({convocados.length})
        </p>
        <button
          onClick={saveMinutes}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
          Guardar
        </button>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto">
        {convocados.map(player => (
          <div key={player.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-700/30 transition-colors">
            {player.photo_url ? (
              <img src={player.photo_url} alt={player.full_name} className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-zinc-400">{player.full_name?.charAt(0)}</span>
              </div>
            )}
            <span className="text-xs text-zinc-400 font-mono w-5 text-center shrink-0">{player.jersey_number || player.number || "—"}</span>
            <span className="text-sm text-white flex-1 truncate">{player.full_name}</span>
            <span className="text-xs text-zinc-500 shrink-0">{player.position?.split(" ")[0] || ""}</span>
            <input
              type="number"
              min="0"
              max="120"
              placeholder="min"
              value={minutesMap[player.id] ?? ""}
              onChange={e => setMinutesMap(m => ({ ...m, [player.id]: e.target.value }))}
              className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-yellow-500/50 shrink-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Logo helpers ──────────────────────────────────────────────────────────────
function ClubLogo({ url, name, size = 10 }) {
  const [err, setErr] = useState(false);
  if (!url || err) {
    return (
      <div className={`w-${size} h-${size} rounded-full bg-zinc-700 flex items-center justify-center shrink-0`}>
        <span className="text-[10px] font-bold text-zinc-400">{name?.charAt(0)}</span>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={name}
      className={`w-${size} h-${size} object-contain shrink-0`}
      onError={() => setErr(true)}
    />
  );
}

function YoutubeEmbed({ url, label }) {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|\/v\/|embed\/)([A-Za-z0-9_-]{11})/);
  const id = m?.[1];
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-zinc-400 font-medium">{label}</p>
      {id ? (
        <div className="relative w-full rounded-xl overflow-hidden border border-zinc-700" style={{ paddingBottom: "56.25%" }}>
          <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${id}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm underline">
          <Youtube size={14} /> Ver video
        </a>
      )}
    </div>
  );
}

// ── MatchCard ─────────────────────────────────────────────────────────────────
function MatchCard({ match, players, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [matchData, setMatchData] = useState(match);
  const hasResult = match.our_score != null && match.rival_score != null;
  const won = match.our_score > match.rival_score;
  const drew = match.our_score === match.rival_score;

  const isLocal = match.location === "Local";
  const rivalLogo = match.rival_logo_url || getLogoForRival(match.rival);
  const leftLogo = isLocal ? DYJ_LOGO : rivalLogo;
  const rightLogo = isLocal ? rivalLogo : DYJ_LOGO;
  const leftName = isLocal ? "Defensa y Justicia" : match.rival;
  const rightName = isLocal ? match.rival : "Defensa y Justicia";
  const leftScore = isLocal ? match.our_score : match.rival_score;
  const rightScore = isLocal ? match.rival_score : match.our_score;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Fecha */}
        <div className="text-center min-w-[44px] shrink-0">
          <p className="text-white font-bold text-sm">{moment(match.date).format("DD/MM")}</p>
          <p className="text-zinc-600 text-xs">{moment(match.date).format("YYYY")}</p>
        </div>

        {/* Escudos + marcador */}
        <div className="flex items-center gap-3 flex-1 justify-center px-3">
          <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            <span className="text-xs text-zinc-300 hidden sm:block truncate max-w-[90px] text-right">
              {leftName === "Defensa y Justicia" ? "Def. y Justicia" : leftName}
            </span>
            <ClubLogo url={leftLogo} name={leftName} size={8} />
          </div>

          {hasResult ? (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-base shrink-0 ${won ? "bg-green-900/40 text-green-400" : drew ? "bg-zinc-700 text-zinc-200" : "bg-red-900/40 text-red-400"}`}>
              <span>{leftScore}</span>
              <span className="text-zinc-500 text-xs mx-0.5">-</span>
              <span>{rightScore}</span>
            </div>
          ) : (
            <div className="px-3 py-1 rounded-lg text-zinc-600 text-xs shrink-0">vs</div>
          )}

          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ClubLogo url={rightLogo} name={rightName} size={8} />
            <span className="text-xs text-zinc-300 hidden sm:block truncate max-w-[90px]">
              {rightName === "Defensa y Justicia" ? "Def. y Justicia" : rightName}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasResult && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${won ? "text-green-400" : drew ? "text-zinc-400" : "text-red-400"}`}>
              {won ? "W" : drew ? "D" : "L"}
            </span>
          )}
          {match.squad_names?.length > 0 && (
            <span className="text-zinc-500 text-xs flex items-center gap-1 hidden sm:flex"><Users size={11} />{match.squad_names.length}</span>
          )}
          <button onClick={e => { e.stopPropagation(); onEdit(match); }} className="p-1.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-white transition-colors">
            <Edit2 size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(match.id); }} className="p-1.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors">
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-5">
          {/* Banner con escudos grandes */}
          <div className="bg-zinc-800/60 rounded-xl p-5">
            <div className="flex items-center justify-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <ClubLogo url={leftLogo} name={leftName} size={16} />
                <p className="text-xs text-zinc-400 text-center max-w-[90px] leading-tight">{leftName}</p>
              </div>
              <div className="text-center">
                {hasResult ? (
                  <p className={`text-4xl font-black tracking-tight ${won ? "text-green-400" : drew ? "text-zinc-200" : "text-red-400"}`}>
                    {leftScore} — {rightScore}
                  </p>
                ) : <p className="text-zinc-600 text-2xl font-bold">vs</p>}
                {match.competition && <p className="text-xs text-zinc-500 mt-2">{match.competition}</p>}
                <p className="text-xs text-zinc-600 mt-0.5">{moment(match.date).format("dddd DD [de] MMMM YYYY")}</p>
                <p className="text-xs mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${match.location === "Local" ? "bg-green-900/40 text-green-400" : "bg-orange-900/40 text-orange-400"}`}>
                    {match.location}
                  </span>
                </p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ClubLogo url={rightLogo} name={rightName} size={16} />
                <p className="text-xs text-zinc-400 text-center max-w-[90px] leading-tight">{rightName}</p>
              </div>
            </div>
          </div>

          {/* GPS CSV */}
          <MatchCsvPanel
            match={matchData}
            onCsvSaved={(url, label) => setMatchData(m => ({ ...m, csv_url: url, csv_label: label }))}
          />

          {/* Convocados + Minutos */}
          <SquadMinutesPanel match={match} players={players} />

          {/* Análisis del rival */}
          {match.rival_notes && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5"><FileText size={12} /> Análisis del rival</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap bg-zinc-800/40 rounded-lg p-3">{match.rival_notes}</p>
            </div>
          )}

          {/* Pelota parada */}
          {match.set_pieces_notes && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1 flex items-center gap-1.5"><FileText size={12} /> Pelota parada</p>
              <p className="text-zinc-300 text-sm whitespace-pre-wrap bg-zinc-800/40 rounded-lg p-3">{match.set_pieces_notes}</p>
            </div>
          )}

          {/* Videos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <YoutubeEmbed url={match.video_analysis_url} label="🎥 Análisis del rival" />
            <YoutubeEmbed url={match.video_set_pieces_url} label="⚽ Pelota parada" />
            {match.video_extra_url && <YoutubeEmbed url={match.video_extra_url} label="📹 Video adicional" />}
          </div>

          {/* Notas */}
          {match.notes && (
            <div>
              <p className="text-xs font-semibold text-zinc-400 mb-1">Notas generales</p>
              <p className="text-zinc-400 text-sm">{match.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── MatchForm ─────────────────────────────────────────────────────────────────
const EMPTY = {
  date: "", rival: "", competition: "", location: "Local",
  our_score: "", rival_score: "", rival_formation: "",
  rival_notes: "", set_pieces_notes: "",
  video_analysis_url: "", video_set_pieces_url: "", video_extra_url: "",
  squad_called: [], squad_names: [], notes: "", rival_logo_url: "",
};

function MatchForm({ initial, players, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function togglePlayer(player) {
    const already = form.squad_called.includes(player.id);
    const name = player.full_name || player.name;
    const newIds = already ? form.squad_called.filter(id => id !== player.id) : [...form.squad_called, player.id];
    const newNames = already ? form.squad_names.filter(n => n !== name) : [...form.squad_names, name];
    setForm(f => ({ ...f, squad_called: newIds, squad_names: newNames }));
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
      <p className="text-white font-semibold">{initial?.id ? "Editar partido" : "Nuevo partido"}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Rival *</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="Nombre del rival" value={form.rival} onChange={e => {
            const val = e.target.value;
            const autoLogo = getLogoForRival(val);
            setForm(f => ({ ...f, rival: val, rival_logo_url: autoLogo || f.rival_logo_url }));
          }} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
          <input type="date" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Competencia</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" value={form.competition} onChange={e => set("competition", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Condición</label>
          <select className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" value={form.location} onChange={e => set("location", e.target.value)}>
            <option>Local</option><option>Visitante</option><option>Neutral</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Goles propios</label>
          <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" placeholder="—" value={form.our_score} onChange={e => set("our_score", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Goles del rival</label>
          <input type="number" min="0" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500" placeholder="—" value={form.rival_score} onChange={e => set("rival_score", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">URL Escudo del rival</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://..." value={form.rival_logo_url || ""} onChange={e => set("rival_logo_url", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Formación del rival</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="4-3-3..." value={form.rival_formation} onChange={e => set("rival_formation", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Análisis del rival</label>
          <textarea rows={3} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" value={form.rival_notes} onChange={e => set("rival_notes", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Pelota parada</label>
          <textarea rows={2} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 resize-none" value={form.set_pieces_notes} onChange={e => set("set_pieces_notes", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">YouTube — Análisis</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://youtube.com/..." value={form.video_analysis_url} onChange={e => set("video_analysis_url", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">YouTube — Pelota parada</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://youtube.com/..." value={form.video_set_pieces_url} onChange={e => set("video_set_pieces_url", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">YouTube — Video adicional</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" placeholder="https://youtube.com/..." value={form.video_extra_url} onChange={e => set("video_extra_url", e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-2 block">Convocados</label>
          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
            {players.map(p => {
              const selected = form.squad_called.includes(p.id);
              return (
                <button key={p.id} type="button" onClick={() => togglePlayer(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${selected ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-300" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white"}`}>
                  #{p.jersey_number || p.number} {p.full_name || p.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="col-span-2">
          <label className="text-xs text-zinc-400 mb-1 block">Notas generales</label>
          <input className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" value={form.notes} onChange={e => set("notes", e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"><X size={14} /> Cancelar</button>
        <button onClick={() => onSave(form)} disabled={!form.rival || !form.date} className="px-4 py-2 rounded-lg text-sm bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-semibold disabled:opacity-40 transition-colors flex items-center gap-1"><Check size={14} /> Guardar</button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Matches() {
  const [tab, setTab] = useState("reserva");
  const [matches, setMatches] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const { toast } = useToast();

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [m, p] = await Promise.all([
      base44.entities.MatchReport.list("-date", 100),
      base44.entities.Player.list("-created_date", 100),
    ]);
    setMatches(m);
    setPlayers(p.sort((a, b) => (a.jersey_number || a.number || 0) - (b.jersey_number || b.number || 0)));
    setLoading(false);
  }

  async function save(form) {
    const data = {
      ...form,
      our_score: form.our_score !== "" ? Number(form.our_score) : null,
      rival_score: form.rival_score !== "" ? Number(form.rival_score) : null,
    };
    if (editing?.id) {
      await base44.entities.MatchReport.update(editing.id, data);
      toast({ title: "Partido actualizado" });
    } else {
      await base44.entities.MatchReport.create(data);
      toast({ title: "Partido guardado" });
    }
    setShowForm(false);
    setEditing(null);
    loadAll();
  }

  async function remove(id) {
    if (!confirm("¿Eliminar este partido?")) return;
    await base44.entities.MatchReport.delete(id);
    toast({ title: "Partido eliminado" });
    loadAll();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tabs Reserva / Juveniles */}
      <div className="flex gap-0 border-b border-zinc-800">
        <button
          onClick={() => setTab("reserva")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${tab === "reserva" ? "border-yellow-400 text-yellow-300" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
          Reserva
        </button>
        <button
          onClick={() => setTab("juveniles")}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${tab === "juveniles" ? "border-violet-400 text-violet-300" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
        >
          Juveniles
        </button>
      </div>

      {tab === "juveniles" && (
        <JuvenileMatchPanel players={players} />
      )}

      {tab === "reserva" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-zinc-400 text-sm">{matches.length} partido{matches.length !== 1 ? "s" : ""}</p>
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={15} /> Nuevo partido
            </button>
          </div>

          {showForm && (
            <MatchForm
              initial={editing}
              players={players}
              onSave={save}
              onCancel={() => { setShowForm(false); setEditing(null); }}
            />
          )}

          {matches.length === 0 && !showForm ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <p className="text-zinc-500 text-sm">No hay partidos registrados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matches.map(m => (
                <MatchCard key={m.id} match={m} players={players} onEdit={m2 => { setEditing(m2); setShowForm(true); }} onDelete={remove} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}