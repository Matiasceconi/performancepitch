import React, { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Stage, Layer, Transformer, Rect as KRect } from "react-konva";
import PitchLayer from "./layers/PitchLayer";
import TacticalElementNode from "./elements/TacticalElementNode";

// Stage de Konva con cancha, elementos, transformer y selección.
// Expone el stage vía ref para exportación.
const TacticalStage = forwardRef(function TacticalStage(
  { board, elements, selectedIds, onSelect, onChangeElement, zoom, pan, showGrid: _showGrid, readOnly },
  ref
) {
  const stageRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = React.useState({ width: 800, height: 600 });

  const docWidth = board?.document_width || 1600;
  const docHeight = board?.document_height || 900;

  useImperativeHandle(ref, () => ({
    getStage: () => stageRef.current,
    toDataURL: (opts) => stageRef.current?.toDataURL(opts),
  }));

  // Medir contenedor
  useEffect(() => {
    function update() {
      if (containerRef.current) {
        setContainerSize({ width: containerRef.current.offsetWidth, height: containerRef.current.offsetHeight });
      }
    }
    update();
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Actualizar transformer cuando cambia la selección
  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = stageRef.current;
    if (!transformer || !stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [selectedIds, elements]);

  function handleStageMouseDown(e) {
    if (readOnly) return;
    // Click en vacío: deseleccionar
    if (e.target === stageRef.current) {
      onSelect([]);
      return;
    }
    const id = e.target.id?.() || e.target.parent?.id?.();
    if (id) {
      if (e.evt?.shiftKey) {
        onSelect(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
      } else if (!selectedIds.includes(id)) {
        onSelect([id]);
      }
    }
  }

  const scale = zoom || 1;
  const stageWidth = containerSize.width;
  const stageHeight = containerSize.height;
  // Centrar el documento en el stage
  const docScale = Math.min(stageWidth / docWidth, stageHeight / docHeight) * scale;
  const offsetX = (stageWidth - docWidth * docScale) / 2 - (pan?.x || 0);
  const offsetY = (stageHeight - docHeight * docScale) / 2 - (pan?.y || 0);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-zinc-950">
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onMouseDown={handleStageMouseDown}
        onTouchStart={handleStageMouseDown}
        x={offsetX}
        y={offsetY}
        scaleX={docScale}
        scaleY={docScale}
      >
        {/* Capa de cancha */}
        <Layer listening={false}>
          <KRect x={0} y={0} width={docWidth} height={docHeight} fill="#0a0a0a" />
          <PitchLayer config={board?.pitch_config} width={docWidth} height={docHeight} />
        </Layer>

        {/* Capa de elementos */}
        <Layer>
          {elements.map((el) => (
            <TacticalElementNode
              key={el.id}
              el={el}
              draggable={!readOnly && !el.locked}
              onSelect={(e) => {
                if (readOnly) return;
                e.cancelBubble = true;
                if (e.evt?.shiftKey) {
                  onSelect(selectedIds.includes(el.id) ? selectedIds.filter((x) => x !== el.id) : [...selectedIds, el.id]);
                } else if (!selectedIds.includes(el.id)) {
                  onSelect([el.id]);
                }
              }}
              onChange={(patch) => onChangeElement(el.id, patch)}
            />
          ))}
          {!readOnly && (
            <Transformer
              ref={transformerRef}
              rotateEnabled
              keepRatio={false}
              borderStroke="#facc15"
              anchorStroke="#facc15"
              anchorFill="#000"
              anchorSize={8}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
});

export default TacticalStage;