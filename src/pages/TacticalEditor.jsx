import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useWorkspace } from "@/lib/WorkspaceContext";
import { Loader2, AlertCircle } from "lucide-react";
import { createHistory } from "@/components/tactical/lib/tacticalHistory";
import { createElement, cloneElement, serializeElements } from "@/components/tactical/lib/tacticalElementFactory";
import { normalizeBoard, createBoardPayload } from "@/components/tactical/lib/tacticalDocument";
import { resolveTacticalBrand } from "@/components/tactical/lib/tacticalBrandResolver";
import { DEFAULT_PITCH_CONFIG } from "@/components/tactical/lib/tacticalPitchModels";
import TacticalTopBar from "@/components/tactical/editor/TacticalTopBar";
import TacticalLeftPanel from "@/components/tactical/editor/TacticalLeftPanel";
import TacticalInspector from "@/components/tactical/editor/TacticalInspector";
import TacticalBottomBar from "@/components/tactical/editor/TacticalBottomBar";
import TacticalBoardsStrip from "@/components/tactical/editor/TacticalBoardsStrip";
import TacticalStage from "@/components/tactical/editor/TacticalStage";
import TacticalExportModal from "@/components/tactical/editor/TacticalExportModal";
import TacticalPresentation from "@/components/tactical/editor/TacticalPresentation";

export default function TacticalEditor() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { activeSquadId, activeSquad, activeSeasonId, can, clubBrand } = useWorkspace();
  const brand = resolveTacticalBrand({ clubBrand, activeSquad });

  const [project, setProject] = useState(null);
  const [boards, setBoards] = useState([]);
  const [currentBoardId, setCurrentBoardId] = useState(null);
  const [elements, setElements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [mode, setMode] = useState("tactical");
  const [saveStatus, setSaveStatus] = useState("saved");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState(false);
  const [snap, setSnap] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [players, setPlayers] = useState([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);

  const historyRef = useRef(createHistory());
  const saveTimerRef = useRef(null);
  const stageRef = useRef(null);
  const isDirtyRef = useRef(false);

  const canEdit = can("edit", "/tactical");
  const canExport = can("export", "/tactical");
  const canDelete = can("delete", "/tactical");
  const readOnly = !canEdit;

  const currentBoard = useMemo(() => boards.find((b) => b.id === currentBoardId) || null, [boards, currentBoardId]);

  // Cargar proyecto y pizarras
  const loadProject = useCallback(async () => {
    if (!projectId) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const proj = await base44.entities.TacticalProject.get(projectId).catch(() => null);
      if (!proj) { setError("Proyecto no encontrado"); setLoading(false); return; }
      setProject(proj);
      const boardRows = await base44.entities.TacticalBoard.filter({ project_id: projectId }, "order", 200);
      const normalized = boardRows.map(normalizeBoard);
      setBoards(normalized);
      if (normalized.length && !currentBoardId) {
        setCurrentBoardId(normalized[0].id);
      }
      // Actualizar last_opened_at
      base44.entities.TacticalProject.update(projectId, { last_opened_at: new Date().toISOString() }).catch(() => {});
    } catch (e) {
      setError("No se pudo cargar el proyecto");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  // Cargar jugadores del plantel activo
  useEffect(() => {
    if (!activeSquadId) return;
    base44.entities.Player.filter({ squad_id: activeSquadId }, "jersey_number", 50)
      .then(setPlayers)
      .catch(() => setPlayers([]));
  }, [activeSquadId]);

  // Cuando cambia la pizarra actual, cargar sus elementos
  useEffect(() => {
    if (currentBoard) {
      const els = (currentBoard.elements || []).map((el) => ({
        ...el,
        data: el.data || {},
        scaleX: el.scaleX ?? 1,
        scaleY: el.scaleY ?? 1,
        opacity: el.opacity ?? 1,
        visible: el.visible !== false,
        locked: el.locked || false,
      }));
      setElements(els);
      setMode(currentBoard.mode || "tactical");
      historyRef.current.reset(els);
      setSelectedIds([]);
      isDirtyRef.current = false;
      setSaveStatus("saved");
    } else {
      setElements([]);
    }
  }, [currentBoardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardado automático con debounce
  const scheduleSave = useCallback(() => {
    if (readOnly || !currentBoard) return;
    isDirtyRef.current = true;
    setSaveStatus("saving");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const rev = (currentBoard.revision || 1) + 1;
        await base44.entities.TacticalBoard.update(currentBoard.id, {
          elements: serializeElements(elements),
          mode,
          revision: rev,
          updated_at: new Date().toISOString(),
        });
        setBoards((prev) => prev.map((b) => (b.id === currentBoard.id ? { ...b, elements, mode, revision: rev } : b)));
        isDirtyRef.current = false;
        setSaveStatus("saved");
      } catch (e) {
        setSaveStatus("error");
      }
    }, 1500);
  }, [elements, mode, currentBoard, readOnly]);

  useEffect(() => {
    if (isDirtyRef.current) scheduleSave();
  }, [elements, scheduleSave]);

  // Guardar antes de salir/cambiar de pizarra
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // ── Operaciones de elementos ──
  function commitElements(newElements) {
    historyRef.current.push(newElements);
    setElements(newElements);
  }

  function addElement(type, overrides = {}) {
    if (readOnly) return;
    const el = createElement(type, { x: 800, y: 450, ...overrides });
    const next = [...elements, el];
    commitElements(next);
    setSelectedIds([el.id]);
  }

  function addPlayer(player) {
    if (readOnly) return;
    const isGK = player.position === "Arquero";
    const el = createElement(isGK ? "goalkeeper" : "player", {
      x: 800,
      y: 450,
      data: {
        player_id: player.id,
        number: player.jersey_number || "",
        label: player.full_name || "",
        position: player.position || "",
        color: isGK ? "#facc15" : brand.colors.primary,
        snapshot: { name: player.full_name, number: player.jersey_number, position: player.position, photo_url: player.photo_url },
      },
    });
    commitElements([...elements, el]);
    setSelectedIds([el.id]);
  }

  function addRivalPlayer() {
    if (readOnly) return;
    const el = createElement("generic_player", { x: 800, y: 200, data: { isRival: true, color: "#ef4444" } });
    commitElements([...elements, el]);
    setSelectedIds([el.id]);
  }

  function changeElement(id, patch) {
    const next = elements.map((el) => (el.id === id ? { ...el, ...patch, data: patch.data ? { ...el.data, ...patch.data } : el.data } : el));
    commitElements(next);
  }

  function deleteSelected() {
    if (readOnly) return;
    const next = elements.filter((el) => !selectedIds.includes(el.id));
    commitElements(next);
    setSelectedIds([]);
  }

  function duplicateSelected() {
    if (readOnly) return;
    const clones = elements.filter((el) => selectedIds.includes(el.id)).map(cloneElement);
    commitElements([...elements, ...clones]);
    setSelectedIds(clones.map((c) => c.id));
  }

  function copySelected() {
    const items = elements.filter((el) => selectedIds.includes(el.id));
    navigator.clipboard?.writeText(JSON.stringify(items)).catch(() => {});
  }

  function pasteFromClipboard() {
    if (readOnly) return;
    navigator.clipboard?.readText().then((text) => {
      try {
        const items = JSON.parse(text);
        const clones = items.map((item) => cloneElement(item));
        commitElements([...elements, ...clones]);
        setSelectedIds(clones.map((c) => c.id));
      } catch {}
    }).catch(() => {});
  }

  function groupSelected() {
    if (readOnly || selectedIds.length < 2) return;
    const gid = `grp_${Date.now()}`;
    const next = elements.map((el) => (selectedIds.includes(el.id) ? { ...el, groupId: gid } : el));
    commitElements(next);
  }

  function ungroupSelected() {
    if (readOnly) return;
    const next = elements.map((el) => (selectedIds.includes(el.id) ? { ...el, groupId: null } : el));
    commitElements(next);
  }

  function undo() {
    if (readOnly) return;
    const prev = historyRef.current.undo();
    setElements(prev);
    setSelectedIds([]);
  }

  function redo() {
    if (readOnly) return;
    const next = historyRef.current.redo();
    setElements(next);
    setSelectedIds([]);
  }

  // ── Atajos de teclado ──
  useEffect(() => {
    function handler(e) {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (e.key === "z" && e.shiftKey || e.key === "y")) { e.preventDefault(); redo(); }
      else if (mod && e.key === "c") { e.preventDefault(); copySelected(); }
      else if (mod && e.key === "v") { e.preventDefault(); pasteFromClipboard(); }
      else if (mod && e.key === "d") { e.preventDefault(); duplicateSelected(); }
      else if (mod && e.key === "g" && !e.shiftKey) { e.preventDefault(); groupSelected(); }
      else if (mod && e.key === "g" && e.shiftKey) { e.preventDefault(); ungroupSelected(); }
      else if (mod && e.key === "s") { e.preventDefault(); scheduleSave(); }
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSelected(); }
      else if (e.key === "Escape") { setSelectedIds([]); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [elements, selectedIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Operaciones de pizarras ──
  async function addBoard() {
    if (readOnly) return;
    const order = boards.length;
    const payload = createBoardPayload(projectId, {
      name: `Pizarra ${order + 1}`,
      mode,
      pitch_config: currentBoard?.pitch_config || { ...DEFAULT_PITCH_CONFIG },
      squad_id: activeSquadId,
      season_id: activeSeasonId || "",
      order,
    });
    const created = await base44.entities.TacticalBoard.create(payload);
    setBoards((prev) => [...prev, normalizeBoard(created)]);
    setCurrentBoardId(created.id);
  }

  async function duplicateBoard(board) {
    if (readOnly) return;
    const { id, created_date, updated_date, created_by_id, ...rest } = board;
    const payload = {
      ...rest,
      name: `${board.name} (copia)`,
      order: boards.length,
      elements: (board.elements || []).map((el) => ({ ...el, id: `${el.id}_cp_${Date.now()}` })),
      revision: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const created = await base44.entities.TacticalBoard.create(payload);
    setBoards((prev) => [...prev, normalizeBoard(created)]);
    setCurrentBoardId(created.id);
  }

  async function renameBoard(boardId, name) {
    await base44.entities.TacticalBoard.update(boardId, { name, updated_at: new Date().toISOString() });
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, name } : b)));
  }

  async function deleteBoard(boardId) {
    if (!canDelete) return;
    await base44.entities.TacticalBoard.delete(boardId);
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    if (currentBoardId === boardId) setCurrentBoardId(boards[0]?.id || null);
  }

  async function reorderBoards(newOrder) {
    setBoards(newOrder);
    for (let i = 0; i < newOrder.length; i++) {
      if (newOrder[i].order !== i) {
        base44.entities.TacticalBoard.update(newOrder[i].id, { order: i }).catch(() => {});
      }
    }
  }

  async function renameProject(name) {
    await base44.entities.TacticalProject.update(projectId, { name, updated_at: new Date().toISOString() });
    setProject((p) => ({ ...p, name }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <AlertCircle size={40} className="text-red-500 mb-3" />
        <p className="text-zinc-400">{error}</p>
        <button onClick={() => navigate("/tactical")} className="mt-4 px-4 py-2 rounded-lg bg-zinc-800 text-white text-sm hover:bg-zinc-700">Volver a proyectos</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950">
      <TacticalTopBar
        project={project}
        board={currentBoard}
        mode={mode}
        onModeChange={setMode}
        saveStatus={saveStatus}
        onUndo={undo}
        onRedo={redo}
        canUndo={historyRef.current.canUndo()}
        canRedo={historyRef.current.redo()}
        onDuplicateBoard={() => currentBoard && duplicateBoard(currentBoard)}
        onExport={() => setShowExport(true)}
        onPresent={() => setShowPresentation(true)}
        onBack={() => navigate("/tactical")}
        onRenameProject={renameProject}
        onRenameBoard={(name) => currentBoard && renameBoard(currentBoard.id, name)}
        canEdit={canEdit}
        canExport={canExport}
        brand={brand}
      />

      <div className="flex flex-1 min-h-0">
        <TacticalLeftPanel
          mode={mode}
          collapsed={leftCollapsed}
          onToggleCollapse={() => setLeftCollapsed(!leftCollapsed)}
          onAddElement={addElement}
          onAddPlayer={addPlayer}
          onAddRival={addRivalPlayer}
          players={players}
          readOnly={readOnly}
          brand={brand}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <TacticalStage
              ref={stageRef}
              board={currentBoard}
              elements={elements}
              selectedIds={selectedIds}
              onSelect={setSelectedIds}
              onChangeElement={changeElement}
              zoom={zoom}
              pan={pan}
              showGrid={showGrid}
              readOnly={readOnly}
            />
          </div>
          <TacticalBoardsStrip
            boards={boards}
            currentBoardId={currentBoardId}
            onSelect={setCurrentBoardId}
            onAdd={addBoard}
            onDuplicate={duplicateBoard}
            onRename={renameBoard}
            onDelete={deleteBoard}
            onReorder={reorderBoards}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </div>

        <TacticalInspector
          elements={elements}
          selectedIds={selectedIds}
          onChange={changeElement}
          onDelete={deleteSelected}
          onDuplicate={duplicateSelected}
          onGroup={groupSelected}
          onUngroup={ungroupSelected}
          readOnly={readOnly}
        />
      </div>

      <TacticalBottomBar
        zoom={zoom}
        onZoom={setZoom}
        onFit={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
        showGrid={showGrid}
        onToggleGrid={() => setShowGrid(!showGrid)}
        snap={snap}
        onToggleSnap={() => setSnap(!snap)}
        docWidth={currentBoard?.document_width || 1600}
        docHeight={currentBoard?.document_height || 900}
      />

      <TacticalExportModal
        open={showExport}
        onClose={() => setShowExport(false)}
        stageRef={stageRef}
        boards={boards}
        currentBoardId={currentBoardId}
        brand={brand}
        project={project}
      />

      <TacticalPresentation
        open={showPresentation}
        onClose={() => setShowPresentation(false)}
        boards={boards}
        currentBoardId={currentBoardId}
        onSelectBoard={setCurrentBoardId}
      />
    </div>
  );
}