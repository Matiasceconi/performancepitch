import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Save, X, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import moment from "moment";
import "moment/locale/es";
moment.locale("es");

const EMPTY_MATCH = {
  date: "",
  rival: "",
  location: "Local",
  our_score: "",
  rival_score: "",
  notes: "",
};

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

  useEffect(() => {
    if (!expanded) return;
    setLoading(true);
    base44.entities.MinutesRecord.filter(
      { match_date: match.date, tournament: "Juveniles" },
      "-created_date",
      100
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
      // Guardar/actualizar cada jugador con minutos
      const entries = Object.entries(minutesMap);
      for (const [key, val] of entries) {
        if (val.minutes === "" || val.minutes === undefined) continue;
        const isPlayerId = !key.startsWith("name:");
        const existing = existingRecords.find((r) =>
          isPlayerId ? r.player_id === key : r.player_name === val.name
        );
        const payload = {
          tournament: "Juveniles",
          match_label: matchLabel,
          match_date: match.date,
          rival: match.rival,
          minutes: Number(val.minutes),
          player_name: val.name,
          ...(isPlayerId ? { player_id: key } : {}),
        };
        if (existing) {
          await base44.entities.MinutesRecord.update(existing.id, { minutes: Number(val.minutes) });
        } else {
          await base44.entities.MinutesRecord.create(payload);
        }
      }
      toast({ title: "Minutos de juveniles guardados" });
    } catch {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Jugadores de juveniles (división Cuarta o Quinta, o los existentes en este partido)
  const juvenilePlayers = players.filter(
    (p) => p.division === "Cuarta División" || p.division === "Quinta División"
  );

  // Unión: jugadores del plantel juvenil + jugadores ya registrados en el partido
  const allKeys = new Set([
    ...juvenilePlayers.map((p) => p.id),
    ...Object.keys(minutesMap),
  ]);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="text-center min-w-[44px] shrink-0">
          <p className="text-white font-bold text-sm">{moment(match.date).format("DD/MM")}</p>
          <p className="text-zinc-600 text-xs">{moment(match.date).format("YYYY")}</p>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-center px-3">
          <span className="text-sm text-zinc-300 text-right flex-1">Defensa y Justicia</span>
          {hasResult ? (
            <div className={`flex items-center gap-1 px-3 py-1 rounded-lg font-bold text-base shrink-0 ${won ? "bg-green-900/40 text-green-400" : drew ? "bg-zinc-700 text-zinc-200" : "bg-red-900/40 text-red-400"}`}>
              <span>{match.our_score}</span>
              <span className="text-zinc-500 text-xs mx-0.5">-</span>
              <span>{match.rival_score}</span>
            </div>
          ) : (
            <div className="px-3 py-1 text-zinc-600 text-xs shrink-0">vs</div>
          )}
          <span className="text-sm text-zinc-300 flex-1">{match.rival}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${match.location === "Local" ? "bg-green-900/30 text-green-400" : "bg-orange-900/30 text-orange-400"}`}>
            {match.location}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(match.id); }}
            className="p-1.5 rounded hover:bg-red-900/40 text-zinc-500 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Minutos jugados — Juveniles</p>
            <button
              onClick={saveMinutes}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? <div className="w-3 h-3 border border-violet-400 border-t-transparent rounded-full animate-spin" /> : <Save size={12} />}
              Guardar
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border border-zinc-700 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-1.5 max-h-80 overflow-y-auto">
                {juvenilePlayers.map((player) => (
                  <div key={player.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-zinc-800/30">
                    {player.photo_url ? (
                      <img src={player.photo_url} alt={player.full_name} className="w-7 h-7 rounded-full object-cover border border-zinc-700 shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-zinc-400">{player.full_name?.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-xs text-zinc-400 font-mono w-5 text-center shrink-0">{player.jersey_number || "—"}</span>
                    <span className="text-sm text-white flex-1 truncate">{player.full_name}</span>
                    <span className="text-xs text-zinc-500 shrink-0">{player.division?.replace(" División", "")}</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      placeholder="min"
                      value={minutesMap[player.id]?.minutes ?? ""}
                      onChange={(e) =>
                        setMinutesMap((m) => ({
                          ...m,
                          [player.id]: { minutes: e.target.value, name: player.full_name },
                        }))
                      }
                      className="w-16 bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-violet-500/50 shrink-0"
                    />
                  </div>
                ))}
                {juvenilePlayers.length === 0 && (
                  <p className="text-zinc-500 text-sm text-center py-4">
                    No hay jugadores de Cuarta o Quinta División en el plantel.
                  </p>
                )}
              </div>

              {/* Jugadores registrados en este partido que no están en el plantel actual */}
              {existingRecords.filter(r => r.player_id && !juvenilePlayers.find(p => p.id === r.player_id)).length > 0 && (
                <div className="border-t border-zinc-800 pt-3">
                  <p className="text-xs text-zinc-500 mb-2">Registros anteriores (jugadores no en plantel actual)</p>
                  {existingRecords
                    .filter(r => r.player_id && !juvenilePlayers.find(p => p.id === r.player_id))
                    .map(r => (
                      <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-zinc-400">
                        <span className="text-sm flex-1">{r.player_name}</span>
                        <span className="text-sm font-mono">{r.minutes}'</span>
                      </div>
                    ))}
                </div>
              )}
            </>
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
  const { toast } = useToast();

  useEffect(() => { loadMatches(); }, []);

  async function loadMatches() {
    // Usamos una entidad separada para partidos de juveniles: guardamos en MatchReport con competition = "Juveniles"
    const data = await base44.entities.MatchReport.filter({ competition: "Juveniles" }, "-date", 100);
    setMatches(data);
    setLoading(false);
  }

  async function saveMatch() {
    if (!form.rival || !form.date) return;
    await base44.entities.MatchReport.create({
      ...form,
      competition: "Juveniles",
      our_score: form.our_score !== "" ? Number(form.our_score) : null,
      rival_score: form.rival_score !== "" ? Number(form.rival_score) : null,
    });
    toast({ title: "Partido de juveniles creado" });
    setForm(EMPTY_MATCH);
    setShowForm(false);
    loadMatches();
  }

  async function deleteMatch(id) {
    if (!confirm("¿Eliminar este partido de juveniles?")) return;
    await base44.entities.MatchReport.delete(id);
    toast({ title: "Partido eliminado" });
    loadMatches();
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-400 text-sm">{matches.length} partido{matches.length !== 1 ? "s" : ""} registrados</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={15} /> Nuevo partido
        </button>
      </div>

      {showForm && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 space-y-4">
          <p className="text-white font-semibold">Nuevo partido — Juveniles</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Rival *</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
                placeholder="Nombre del rival"
                value={form.rival}
                onChange={(e) => set("rival", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Fecha *</label>
              <input
                type="date"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Condición</label>
              <select
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
              >
                <option>Local</option>
                <option>Visitante</option>
                <option>Neutral</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Goles propios</label>
                <input
                  type="number" min="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="—" value={form.our_score}
                  onChange={(e) => set("our_score", e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Goles rival</label>
                <input
                  type="number" min="0"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="—" value={form.rival_score}
                  onChange={(e) => set("rival_score", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowForm(false); setForm(EMPTY_MATCH); }}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-1"
            >
              <X size={14} /> Cancelar
            </button>
            <button
              onClick={saveMatch}
              disabled={!form.rival || !form.date}
              className="px-4 py-2 rounded-lg text-sm bg-violet-600 hover:bg-violet-500 text-white font-semibold disabled:opacity-40 flex items-center gap-1"
            >
              <Check size={14} /> Guardar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
      ) : matches.length === 0 && !showForm ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
          <p className="text-zinc-500 text-sm">No hay partidos de juveniles registrados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {matches.map((m) => (
            <JuvMatchCard key={m.id} match={m} players={players} onDelete={deleteMatch} />
          ))}
        </div>
      )}
    </div>
  );
}