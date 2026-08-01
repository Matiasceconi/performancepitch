import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { DragDropContext } from "@hello-pangea/dnd";
import { Plus, Sparkles, ImagePlus, Presentation, Pencil, FolderOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import StrengthBlockCard from "@/components/sessions/strength/StrengthBlockCard";
import StrengthPresentationView from "@/components/sessions/strength/StrengthPresentationView";
import StrengthTemplateModal from "@/components/sessions/strength/StrengthTemplateModal";
import StrengthNewExerciseModal from "@/components/sessions/strength/StrengthNewExerciseModal";
import StrengthImageImportModal from "@/components/sessions/strength/StrengthImageImportModal";
import StrengthPDFExport from "@/components/sessions/strength/StrengthPDFExport";
import { METHOD_OPTIONS, TYPE_OPTIONS, syncToLibrary } from "@/components/sessions/strength/strengthOptions";
import { findSimilarStrengthExercise } from "@/components/sessions/exerciseLibrarySync";
import { migrateSeries } from "@/components/sessions/strength/strengthSeries";

const BLOCK_TEMPLATES = [
  { name: "Restaura", color: "#ef4444" },
  { name: "Compensa", color: "#22c55e" },
  { name: "Potencia", color: "#38bdf8" },
  { name: "Preventivo", color: "#f59e0b" },
  { name: "Circuito", color: "#a855f7" },
  { name: "Readaptación", color: "#14b8a6" },
  { name: "Arqueros", color: "#60a5fa" },
];

function uidName(name) {
  return String(name || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cuadro";
}

export default function SessionStrength({ session, onSessionUpdate }) {
  const [stations, setStations] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [mode, setMode] = useState("edit"); // edit | presentation
  const [suggesting, setSuggesting] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);
  const [templateModal, setTemplateModal] = useState(null); // { mode, block } | null
  const [showNewExercise, setShowNewExercise] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadData(); }, [session.id]);

  async function loadData() {
    const rows = await base44.entities.StrengthStation.filter({ session_id: session.id }, "order", 300);
    const rawBlocks = await base44.entities.StrengthWorkBlock.filter({ session_id: session.id }, "order", 100);

    let nextBlocks = rawBlocks.sort((a, b) => (a.order || 0) - (b.order || 0));
    let nextRows = rows.sort((a, b) => (a.order || 0) - (b.order || 0));

    // Migración idempotente: si hay stations sin block, crear blocks desde strength_group
    if (!nextBlocks.length && nextRows.length) {
      const names = [...new Set(nextRows.map((r) => r.strength_group || "Restaura"))];
      nextBlocks = [];
      for (let i = 0; i < names.length; i += 1) {
        const name = names[i];
        const template = BLOCK_TEMPLATES.find((t) => uidName(t.name) === uidName(name)) || BLOCK_TEMPLATES[i % BLOCK_TEMPLATES.length];
        nextBlocks.push(
          await base44.entities.StrengthWorkBlock.create({
            session_id: session.id,
            name,
            color: template.color,
            order: i + 1,
            hidden: false,
          })
        );
      }
      const byName = Object.fromEntries(nextBlocks.map((b) => [uidName(b.name), b]));
      const migratedRows = [];
      for (const row of nextRows) {
        const block = byName[uidName(row.strength_group || "Restaura")] || nextBlocks[0];
        migratedRows.push(await base44.entities.StrengthStation.update(row.id, { work_block_id: block.id, strength_group: block.name }));
      }
      nextRows = migratedRows;
    }

    setBlocks(nextBlocks);
    setStations(nextRows);
  }

  const visibleBlocks = useMemo(() => blocks.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [blocks]);
  const stationsByBlock = useMemo(
    () =>
      Object.fromEntries(
        visibleBlocks.map((block) => [
          block.id,
          stations
            .filter((s) => s.work_block_id === block.id || (!s.work_block_id && uidName(s.strength_group) === uidName(block.name)))
            .sort((a, b) => (a.order || 0) - (b.order || 0)),
        ])
      ),
    [visibleBlocks, stations]
  );

  // ── Block CRUD ──────────────────────────────────────────────────────────
  async function createBlock(initial = {}) {
    const template = BLOCK_TEMPLATES.find((t) => uidName(t.name) === uidName(initial.name)) || BLOCK_TEMPLATES[blocks.length % BLOCK_TEMPLATES.length];
    const created = await base44.entities.StrengthWorkBlock.create({
      session_id: session.id,
      name: initial.name || `Cuadro ${blocks.length + 1}`,
      objective: initial.objective || "",
      color: initial.color || template.color,
      order: blocks.length + 1,
      hidden: false,
    });
    setBlocks((prev) => [...prev, created]);
    return created;
  }

  async function updateBlock(id, patch) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    await base44.entities.StrengthWorkBlock.update(id, patch);
    if (patch.name) {
      setStations((prev) => prev.map((r) => (r.work_block_id === id ? { ...r, strength_group: patch.name } : r)));
    }
  }

  async function duplicateBlock(block) {
    const created = await createBlock({ name: `${block.name} copia`, color: block.color, objective: block.objective });
    const sourceRows = stationsByBlock[block.id] || [];
    for (let i = 0; i < sourceRows.length; i += 1) {
      const row = sourceRows[i];
      const { id, created_date, updated_date, created_by_id, ...rest } = row;
      await base44.entities.StrengthStation.create({
        ...rest,
        work_block_id: created.id,
        strength_group: created.name,
        order: i + 1,
        station_number: i + 1,
      });
    }
    await loadData();
    toast({ title: "✓ Cuadro duplicado" });
  }

  async function deleteBlock(block) {
    if (!window.confirm(`¿Querés eliminar este cuadro de la sesión?`)) return;
    const rows = stationsByBlock[block.id] || [];
    for (const row of rows) {
      await base44.entities.StrengthStation.delete(row.id);
    }
    await base44.entities.StrengthWorkBlock.delete(block.id);
    setBlocks((prev) => prev.filter((b) => b.id !== block.id));
    setStations((prev) => prev.filter((r) => r.work_block_id !== block.id));
    toast({ title: "Cuadro eliminado de la sesión" });
  }

  async function saveTemplate(block) {
    const blockWithExercises = { ...block, _exercises: stationsByBlock[block.id] || [] };
    setTemplateModal({ mode: "save", block: blockWithExercises });
  }

  async function applyTemplate(template) {
    const created = await createBlock({ name: template.name, color: template.color, objective: template.objective });
    const exercises = template.exercises || [];
    for (let i = 0; i < exercises.length; i += 1) {
      const ex = exercises[i];
      await base44.entities.StrengthStation.create({
        session_id: session.id,
        work_block_id: created.id,
        strength_group: created.name,
        order: i + 1,
        station_number: i + 1,
        exercise_name: ex.exercise_name || "",
        library_strength_exercise_id: ex.library_exercise_id || "",
        library_exercise_id: ex.library_exercise_id || "",
        series: ex.series || [],
        rest_time: ex.rest_time || "",
        notes: ex.notes || "",
        image_url: ex.image_url || "",
        video_url: ex.video_url || "",
        sets: String((ex.series || []).length),
      });
    }
    setTemplateModal(null);
    await loadData();
    toast({ title: "✓ Plantilla aplicada" });
  }

  // ── Station CRUD ─────────────────────────────────────────────────────────
  async function addRow(blockId, initial = {}) {
    let block = blocks.find((b) => b.id === blockId);
    if (!block) block = await createBlock({ name: "Cuadro 1" });
    const groupRows = stations.filter((r) => r.work_block_id === block.id);
    const payload = {
      session_id: session.id,
      work_block_id: block.id,
      strength_group: block.name,
      order: groupRows.length + 1,
      station_number: groupRows.length + 1,
      exercise_name: "",
      series: [],
      rest_time: "",
      notes: "",
      video_url: "",
      image_url: "",
      sets: "",
      reps: "",
      time: "",
      volume: "",
      ...initial,
    };
    const created = await base44.entities.StrengthStation.create(payload);
    setStations((prev) => [...prev, created]);
    return created;
  }

  function onChange(id, field, value) {
    setStations((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  // Persistencia inmediata de series (no espera al blur)
  async function onSeriesChange(stationId, newSeries) {
    setStations((prev) => prev.map((r) => (r.id === stationId ? { ...r, series: newSeries, sets: String(newSeries.length) } : r)));
    try {
      await base44.entities.StrengthStation.update(stationId, { series: newSeries, sets: String(newSeries.length) });
    } catch (e) { /* ignore not-found on rapid edits */ }
  }

  async function onBlurField(station) {
    let libraryId = station.library_strength_exercise_id || station.library_exercise_id || "";
    if (station.exercise_name) {
      if (!libraryId) {
        const match = await findSimilarStrengthExercise(station, session.squad_id);
        if (match?.type === "exact") libraryId = match.exercise.id;
        if (match?.type === "similar" && window.confirm(`Este ejercicio parece similar a: ${match.exercise.name}. ¿Querés usar el existente?`)) {
          libraryId = match.exercise.id;
        }
      }
      libraryId = await syncToLibrary(station, session.id, session.squad_id, session.squad_name, { updateExistingId: libraryId || undefined, session, incrementUsage: false });
    }
    const payload = {
      work_block_id: station.work_block_id,
      strength_group: station.strength_group || blocks.find((b) => b.id === station.work_block_id)?.name || "",
      exercise_name: station.exercise_name || undefined,
      image_url: station.image_url || undefined,
      video_url: station.video_url || undefined,
      sets: station.sets || undefined,
      reps: station.reps || undefined,
      time: station.time || undefined,
      rest_time: station.rest_time || undefined,
      notes: station.notes || undefined,
      series: station.series || [],
      library_exercise_id: libraryId || undefined,
      library_strength_exercise_id: libraryId || undefined,
    };
    const updated = await base44.entities.StrengthStation.update(station.id, payload);
    setStations((prev) => prev.map((r) => (r.id === station.id ? { ...r, ...updated } : r)));
  }

  async function onPickLibrary(id, ex) {
    const current = stations.find((s) => s.id === id);
    const updated = {
      work_block_id: current?.work_block_id || "",
      strength_group: current?.strength_group || "",
      exercise_name: ex.name || "",
      image_url: ex.image_url || "",
      video_url: ex.video_url || "",
      notes: ex.notes || "",
      category: ex.category || "",
      library_exercise_id: ex.id,
      library_strength_exercise_id: ex.id,
    };
    setStations((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
    await base44.entities.StrengthStation.update(id, updated);
    await syncToLibrary({ ...current, ...updated }, session.id, session.squad_id, session.squad_name, { updateExistingId: ex.id, session });
  }

  async function onDelete(id) {
    if (!window.confirm("¿Eliminar este ejercicio del cuadro?")) return;
    await base44.entities.StrengthStation.delete(id);
    setStations((prev) => prev.filter((s) => s.id !== id));
  }

  async function onDragEnd(result) {
    if (!result.destination) return;
    const sourceBlockId = result.source.droppableId;
    const destBlockId = result.destination.droppableId;
    const source = [...(stationsByBlock[sourceBlockId] || [])];
    const dest = sourceBlockId === destBlockId ? source : [...(stationsByBlock[destBlockId] || [])];
    const [moved] = source.splice(result.source.index, 1);
    dest.splice(result.destination.index, 0, { ...moved, work_block_id: destBlockId, strength_group: blocks.find((b) => b.id === destBlockId)?.name || moved.strength_group });
    await persistBlockRows(sourceBlockId, source);
    if (sourceBlockId !== destBlockId) await persistBlockRows(destBlockId, dest);
  }

  async function persistBlockRows(blockId, list) {
    const block = blocks.find((b) => b.id === blockId);
    const updated = list.map((row, i) => ({ ...row, work_block_id: blockId, strength_group: block?.name || row.strength_group || "", order: i + 1, station_number: i + 1 }));
    setStations((prev) => prev.filter((r) => r.work_block_id !== blockId).concat(updated));
    for (const row of updated) {
      try {
        await base44.entities.StrengthStation.update(row.id, { work_block_id: row.work_block_id, strength_group: row.strength_group, order: row.order, station_number: row.station_number });
      } catch (error) {
        if (!String(error?.message || error).includes("not found")) throw error;
      }
    }
  }

  async function suggestRow() {
    const targetBlock = visibleBlocks.find((b) => !b.hidden) || visibleBlocks[0] || (await createBlock({ name: "Potencia", color: "#38bdf8" }));
    setSuggesting(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Sos un preparador físico de fútbol profesional. Sugerí UN ejercicio de fuerza para el cuadro "${targetBlock.name}". MD: ${session.match_day_code || "no especificado"}. Propósito: ${session.strength_purpose || "no especificado"}. Método posible: ${METHOD_OPTIONS.join(", ")}. Tipo posible: ${TYPE_OPTIONS.join(", ")}.`,
        response_json_schema: { type: "object", properties: { exercise_name: { type: "string" }, method: { type: "string" }, exercise_type: { type: "string" } }, required: ["exercise_name"] },
      });
      await addRow(targetBlock.id, result);
      toast({ title: "✓ Ejercicio sugerido por IA" });
    } finally {
      setSuggesting(false);
    }
  }

  async function onNewExerciseCreated(exercise) {
    setShowNewExercise(false);
    // Agregar el ejercicio recién creado al primer cuadro visible
    const targetBlock = visibleBlocks.find((b) => !b.hidden) || visibleBlocks[0] || (await createBlock({ name: "Cuadro 1" }));
    await addRow(targetBlock.id, {
      exercise_name: exercise.name,
      library_strength_exercise_id: exercise.id,
      library_exercise_id: exercise.id,
      image_url: exercise.image_url || "",
      video_url: exercise.video_url || "",
      notes: exercise.notes || "",
      category: exercise.category || "",
    });
    toast({ title: "✓ Ejercicio creado y agregado" });
  }

  const handlers = {
    addRow,
    updateBlock,
    duplicateBlock,
    deleteBlock,
    saveTemplate,
    onChange,
    onSeriesChange,
    onBlurField,
    onPickLibrary,
    onDelete,
    onAddNewExercise: () => setShowNewExercise(true),
  };

  return (
    <div className="space-y-4">
      <datalist id="strength-method-options">{METHOD_OPTIONS.map((m) => <option key={m} value={m} />)}</datalist>
      <datalist id="strength-type-options">{TYPE_OPTIONS.map((t) => <option key={t} value={t} />)}</datalist>

      {/* Header con toggle de modo */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-white font-semibold text-sm">Constructor de fuerza</h3>
          <p className="text-xs text-zinc-500">Cuadros de trabajo con rutina colectiva y prescripción serie por serie.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {mode === "edit" ? (
            <button onClick={() => setMode("presentation")} className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-lg text-xs font-semibold hover:bg-blue-500/25">
              <Presentation size={14} /> Vista presentación
            </button>
          ) : (
            <button onClick={() => setMode("edit")} className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-950 rounded-lg text-xs font-semibold hover:bg-zinc-200">
              <Pencil size={14} /> Modo edición
            </button>
          )}
        </div>
      </div>

      {/* Toolbar de acciones (solo edición) */}
      {mode === "edit" && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => createBlock()} className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-950 font-semibold rounded-lg text-xs hover:bg-zinc-200">
            <Plus size={13} /> Nuevo cuadro
          </button>
          <button onClick={() => setTemplateModal({ mode: "apply" })} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg text-xs hover:bg-zinc-700">
            <FolderOpen size={13} /> Aplicar plantilla
          </button>
          <button onClick={suggestRow} disabled={suggesting} className="flex items-center gap-1.5 px-3 py-2 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded-lg text-xs hover:bg-purple-500/25 disabled:opacity-50">
            <Sparkles size={13} /> {suggesting ? "Pensando..." : "Sugerir ejercicio"}
          </button>
          <button onClick={() => setShowImageImport(true)} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-lg text-xs hover:bg-emerald-500/25">
            <ImagePlus size={13} /> Importar desde imagen
          </button>
          <StrengthPDFExport session={session} blocks={visibleBlocks} stations={stations} />
        </div>
      )}

      {/* Plantillas rápidas (solo edición) */}
      {mode === "edit" && (
        <div className="flex gap-1.5 flex-wrap">
          {BLOCK_TEMPLATES.map((template) => (
            <button key={template.name} onClick={() => createBlock({ ...template })} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 text-[10px] hover:border-zinc-500">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: template.color }} />
              {template.name}
            </button>
          ))}
        </div>
      )}

      {/* Modals */}
      {showImageImport && (
        <StrengthImageImportModal
          session={session}
          hasExisting={stations.length > 0 || blocks.length > 0}
          onClose={() => setShowImageImport(false)}
          onImported={(updatedSession) => { setShowImageImport(false); if (onSessionUpdate) onSessionUpdate(updatedSession); loadData(); }}
        />
      )}
      {templateModal && (
        <StrengthTemplateModal
          mode={templateModal.mode}
          block={templateModal.block}
          squadId={session?.squad_id}
          squadName={session?.squad_name}
          onClose={() => setTemplateModal(null)}
          onSaved={() => { setTemplateModal(null); toast({ title: "✓ Plantilla guardada" }); }}
          onApply={applyTemplate}
        />
      )}
      {showNewExercise && (
        <StrengthNewExerciseModal
          squadId={session?.squad_id}
          squadName={session?.squad_name}
          onClose={() => setShowNewExercise(false)}
          onCreated={onNewExerciseCreated}
        />
      )}

      {/* Contenido principal */}
      {mode === "presentation" ? (
        <StrengthPresentationView blocks={visibleBlocks} stationsByBlock={stationsByBlock} onEdit={() => setMode("edit")} />
      ) : (
        <>
          {!blocks.length && (
            <div className="border border-dashed border-zinc-700 rounded-2xl p-8 text-center">
              <p className="text-zinc-500 text-sm">Todavía no hay cuadros de trabajo.</p>
              <button onClick={() => createBlock({ name: "Restaura" })} className="mt-3 px-4 py-2 rounded-lg bg-white text-zinc-950 text-xs font-bold">
                Crear primer cuadro
              </button>
            </div>
          )}
          {!!blocks.length && (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {visibleBlocks.map((block) => (
                  <StrengthBlockCard
                    key={block.id}
                    block={block}
                    stations={stationsByBlock[block.id] || []}
                    squadId={session?.squad_id}
                    handlers={handlers}
                  />
                ))}
              </div>
            </DragDropContext>
          )}
        </>
      )}
    </div>
  );
}