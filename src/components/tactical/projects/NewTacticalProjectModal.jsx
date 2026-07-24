import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { X, Loader2 } from "lucide-react";
import { PITCH_MODELS, DEFAULT_PITCH_CONFIG, getPitchDimensions } from "@/components/tactical/lib/tacticalPitchModels";
import { createProjectPayload, createBoardPayload } from "@/components/tactical/lib/tacticalDocument";
import { TACTICAL_TEMPLATES } from "@/components/tactical/lib/tacticalTemplates";
import { buildElementsFromMatch, buildRivalElementsFromMatch } from "@/components/tactical/lib/tacticalMatchAdapter";
import { buildBoardMetaFromSession } from "@/components/tactical/lib/tacticalSessionAdapter";

const MODES = [
  { id: "formation", label: "Formación" },
  { id: "tactical", label: "Táctica" },
  { id: "exercise", label: "Ejercicio" },
];

const SOURCES = [
  { id: "blank", label: "En blanco" },
  { id: "formation_auto", label: "Formación automática" },
  { id: "match", label: "Partido existente" },
  { id: "session", label: "Sesión existente" },
  { id: "exercise", label: "Ejercicio existente" },
  { id: "template", label: "Plantilla guardada" },
];

export default function NewTacticalProjectModal({ open, onClose, onCreated }) {
  const { activeSquadId, activeSquad, activeSeasonId } = useWorkspace();
  const [name, setName] = useState("");
  const [mode, setMode] = useState("tactical");
  const [pitchModel, setPitchModel] = useState("full_horizontal");
  const [orientation, setOrientation] = useState("horizontal");
  const [source, setSource] = useState("blank");
  const [system, setSystem] = useState("4-3-3");
  const [matchId, setMatchId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [matches, setMatches] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setMode("tactical");
    setSource("blank");
    setError("");
    // Cargar partidos y sesiones para los selectores
    if (activeSquadId) {
      base44.entities.MatchReport.filter({ squad_id: activeSquadId }, "-date", 30).then(setMatches).catch(() => {});
      base44.entities.TrainingSession.filter({ squad_id: activeSquadId }, "-date", 30).then(setSessions).catch(() => {});
    }
  }, [open, activeSquadId]);

  if (!open) return null;

  async function handleCreate() {
    if (!name.trim()) { setError("Ingresá un nombre"); return; }
    if (!activeSquadId) { setError("Seleccioná un plantel"); return; }
    setSaving(true);
    setError("");
    try {
      const pitchConfig = { ...DEFAULT_PITCH_CONFIG, model: pitchModel, orientation };
      const projPayload = createProjectPayload({
        name: name.trim(),
        default_mode: mode,
        squad_id: activeSquadId,
        squad_name: activeSquad?.name || "",
        season_id: activeSeasonId || activeSquad?.season || "",
      });
      const project = await base44.entities.TacticalProject.create(projPayload);

      // Construir primera pizarra según fuente
      let boardOverrides = { mode, pitch_config: pitchConfig, name: name.trim() };

      if (source === "formation_auto") {
        const { buildFormationSlots } = await import("@/components/matches/tabs/formationSlots");
        const slots = buildFormationSlots(system);
        const { createElement } = await import("@/components/tactical/lib/tacticalElementFactory");
        boardOverrides.elements = slots.map((slot) => {
          const isGK = slot.slot_key === "ARQ";
          return createElement(isGK ? "goalkeeper" : "player", {
            x: (slot.x / 100) * getPitchDimensions(pitchConfig).width,
            y: (slot.y / 100) * getPitchDimensions(pitchConfig).height,
            data: { position: slot.slot_key, color: isGK ? "#facc15" : "#3b82f6" },
          });
        });
      } else if (source === "match" && matchId) {
        const match = matches.find((m) => m.id === matchId);
        if (match) {
          const players = await base44.entities.Player.filter({ squad_id: activeSquadId }, "jersey_number", 30).catch(() => []);
          boardOverrides.mode = "formation";
          boardOverrides.name = `Formación vs ${match.rival || ""}`.trim();
          boardOverrides.elements = [...buildElementsFromMatch(match, players), ...buildRivalElementsFromMatch(match)];
          boardOverrides.objective = `Partido vs ${match.rival || ""} · ${match.date || ""}`;
          // Crear vínculo
          await base44.entities.TacticalBoardLink.create({
            project_id: project.id,
            squad_id: activeSquadId,
            season_id: activeSeasonId || "",
            target_type: "match",
            target_id: matchId,
            label: `Partido vs ${match.rival || ""}`,
            created_at: new Date().toISOString(),
          });
        }
      } else if (source === "session" && sessionId) {
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
          boardOverrides = { ...boardOverrides, ...buildBoardMetaFromSession(session) };
          await base44.entities.TacticalBoardLink.create({
            project_id: project.id,
            squad_id: activeSquadId,
            season_id: activeSeasonId || "",
            target_type: "training_session",
            target_id: sessionId,
            label: session.title || "Sesión",
            created_at: new Date().toISOString(),
          });
        }
      } else if (source === "template" && templateId) {
        const tpl = TACTICAL_TEMPLATES.find((t) => t.id === templateId);
        if (tpl) {
          boardOverrides = {
            ...boardOverrides,
            name: tpl.boards[0].name,
            mode: tpl.boards[0].mode,
            objective: tpl.boards[0].objective || "",
            elements: tpl.boards[0].elements || [],
            pitch_config: tpl.boards[0].pitchConfig || pitchConfig,
          };
        }
      }

      const boardPayload = createBoardPayload(project.id, {
        ...boardOverrides,
        squad_id: activeSquadId,
        season_id: activeSeasonId || "",
        order: 0,
      });
      await base44.entities.TacticalBoard.create(boardPayload);
      onCreated(project.id);
    } catch (e) {
      console.error(e);
      setError("No se pudo crear el proyecto: " + (e.message || "error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h3 className="text-white font-semibold">Nueva pizarra</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Nombre *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Plan vs. Boca" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500" />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Modo inicial</label>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button key={m.id} onClick={() => setMode(m.id)} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${mode === m.id ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"}`}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Modelo de cancha</label>
              <select value={pitchModel} onChange={(e) => setPitchModel(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {PITCH_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Orientación</label>
              <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="horizontal">Horizontal</option>
                <option value="vertical">Vertical</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Fuente inicial</label>
            <div className="grid grid-cols-3 gap-2">
              {SOURCES.map((s) => (
                <button key={s.id} onClick={() => setSource(s.id)} className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${source === s.id ? "bg-white text-zinc-900 border-white" : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:border-zinc-500"}`}>{s.label}</button>
              ))}
            </div>
          </div>
          {source === "formation_auto" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Sistema</label>
              <select value={system} onChange={(e) => setSystem(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                {["4-3-3", "4-2-3-1", "4-4-2", "4-1-4-1", "3-5-2", "3-4-3", "5-3-2"].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {source === "match" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Partido</label>
              <select value={matchId} onChange={(e) => setMatchId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="">Seleccionar...</option>
                {matches.map((m) => <option key={m.id} value={m.id}>vs {m.rival} · {m.date}</option>)}
              </select>
            </div>
          )}
          {source === "session" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Sesión</label>
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="">Seleccionar...</option>
                {sessions.map((s) => <option key={s.id} value={s.id}>{s.title} · {s.date}</option>)}
              </select>
            </div>
          )}
          {source === "template" && (
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Plantilla</label>
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
                <option value="">Seleccionar...</option>
                {TACTICAL_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-zinc-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">Cancelar</button>
          <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-white text-zinc-900 font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Creando..." : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}