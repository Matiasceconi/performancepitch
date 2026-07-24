import React from "react";
import { Group, Circle, Rect, Line, Text, Ellipse, Path, Star, Ring, Arrow } from "react-konva";

// Renderiza un solo elemento de la pizarra como nodos Konva.
// No maneja selección ni drag; eso lo hace el Stage contenedor.
export default function TacticalElementNode({ el, onSelect, onChange, draggable }) {
  const { id, x, y, width, height, rotation, scaleX, scaleY, opacity, visible } = el;
  const d = el.data || {};
  if (visible === false) return null;

  const commonProps = {
    id,
    name: "tactical-element",
    x,
    y,
    rotation,
    scaleX,
    scaleY,
    opacity,
    draggable,
    onMouseDown: onSelect,
    onTap: onSelect,
    onDragEnd: (e) => onChange({ x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e) => {
      const node = e.target;
      onChange({ x: node.x(), y: node.y(), rotation: node.rotation(), scaleX: node.scaleX(), scaleY: node.scaleY() });
    },
  };

  switch (el.type) {
    case "player":
    case "generic_player":
    case "goalkeeper":
    case "coach":
      return (
        <Group {...commonProps}>
          <Circle radius={width / 2} fill={d.color || "#3b82f6"} stroke={d.borderColor || "#fff"} strokeWidth={3} />
          {d.captain && <Text text="C" x={-6} y={-width / 2 - 16} fontSize={14} fill="#facc15" fontStyle="bold" />}
          {d.number ? (
            <Text text={String(d.number)} x={-width / 4} y={-width / 4} width={width / 2} height={width / 2} fontSize={width * 0.4} fill="#fff" fontStyle="bold" align="center" verticalAlign="middle" />
          ) : null}
          {d.label ? (
            <Text text={d.label} x={-60} y={width / 2 + 4} width={120} fontSize={14} fill="#fff" fontStyle="bold" align="center" wrap="none" />
          ) : null}
        </Group>
      );
    case "ball":
      return (
        <Group {...commonProps}>
          <Circle radius={width / 2} fill={d.color || "#fff"} stroke="#000" strokeWidth={1} />
          <Circle radius={width / 4} fill="none" stroke="#000" strokeWidth={1} />
        </Group>
      );
    case "cone":
      return (
        <Group {...commonProps}>
          <Line points={[0, height, width / 2, 0, width, height]} fill={d.color || "#f97316"} stroke="#000" strokeWidth={1} closed />
        </Group>
      );
    case "pole":
      return (
        <Group {...commonProps}>
          <Rect width={width} height={height} fill={d.color || "#ef4444"} cornerRadius={width / 2} />
        </Group>
      );
    case "mannequin":
      return (
        <Group {...commonProps}>
          <Circle x={width / 2} y={height * 0.12} radius={width * 0.3} fill={d.color || "#64748b"} />
          <Rect x={width * 0.3} y={height * 0.25} width={width * 0.4} height={height * 0.6} fill={d.color || "#64748b"} cornerRadius={4} />
        </Group>
      );
    case "hurdle":
      return (
        <Group {...commonProps}>
          <Rect width={width} height={height} fill={d.color || "#22c55e"} cornerRadius={2} />
          <Line points={[0, 0, 0, -8, width, -8, width, 0]} stroke={d.color || "#22c55e"} strokeWidth={4} />
        </Group>
      );
    case "hoop":
      return (
        <Group {...commonProps}>
          <Ring innerRadius={width * 0.35} outerRadius={width / 2} fill={d.color || "#a855f7"} />
        </Group>
      );
    case "ladder":
      return (
        <Group {...commonProps}>
          <Rect width={width} height={height} stroke={d.color || "#eab308"} strokeWidth={3} />
          {Array.from({ length: 5 }).map((_, i) => (
            <Line key={i} points={[(width / 5) * (i + 1), 0, (width / 5) * (i + 1), height]} stroke={d.color || "#eab308"} strokeWidth={2} />
          ))}
        </Group>
      );
    case "large_goal":
    case "mini_goal":
      return (
        <Group {...commonProps}>
          <Rect width={width} height={height} stroke={d.color || "#fff"} strokeWidth={4} />
          <Line points={[0, 0, width, height]} stroke={d.color || "#fff"} strokeWidth={1} opacity={0.3} />
          <Line points={[width, 0, 0, height]} stroke={d.color || "#fff"} strokeWidth={1} opacity={0.3} />
        </Group>
      );
    case "marker":
      return (
        <Group {...commonProps}>
          <Star numPoints={5} innerRadius={width * 0.3} outerRadius={width / 2} fill={d.color || "#facc15"} />
          {d.label ? <Text text={d.label} x={-30} y={width / 2 + 2} width={60} fontSize={12} fill="#fff" fontStyle="bold" align="center" /> : null}
        </Group>
      );
    case "text":
      return (
        <Group {...commonProps}>
          <Text text={d.text || ""} fontSize={d.fontSize || 28} fontFamily={d.fontFamily || "sans-serif"} fontStyle={d.fontWeight || "bold"} fill={d.color || "#fff"} align={d.align || "left"} width={width} />
        </Group>
      );
    case "line":
    case "tactical_line":
      return (
        <Line
          {...commonProps}
          points={d.points || [0, 0, width, 0]}
          stroke={d.color || "#facc15"}
          strokeWidth={d.strokeWidth || 4}
          dash={d.dash || []}
          lineCap="round"
        />
      );
    case "arrow":
      return (
        <Arrow
          {...commonProps}
          points={d.points || [0, 0, width, 0]}
          stroke={d.color || "#facc15"}
          strokeWidth={d.strokeWidth || 4}
          dash={d.dash || []}
          fill={d.color || "#facc15"}
          pointerLength={12}
          pointerWidth={12}
          pointerAtBeginning={d.arrowStart}
          pointerAtEnd={d.arrowEnd !== false}
        />
      );
    case "curved_arrow": {
      const [x1, y1, x2, y2] = d.points || [0, 0, width, 0];
      const [cx, cy] = d.control || [width / 2, -80];
      const pathData = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
      return (
        <Group {...commonProps}>
          <Path data={pathData} stroke={d.color || "#f97316"} strokeWidth={d.strokeWidth || 4} dash={d.dash || []} fill={null} />
          <Arrow points={[x2 - 20, y2, x2, y2]} stroke={d.color || "#f97316"} strokeWidth={d.strokeWidth || 4} fill={d.color || "#f97316"} pointerLength={12} pointerWidth={12} />
        </Group>
      );
    }
    case "freehand":
      return (
        <Line
          {...commonProps}
          points={(d.points || []).flat()}
          stroke={d.color || "#22c55e"}
          strokeWidth={d.strokeWidth || 4}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
        />
      );
    case "rectangle":
    case "zone":
      return (
        <Rect
          {...commonProps}
          width={width}
          height={height}
          stroke={d.color || "#3b82f6"}
          strokeWidth={d.strokeWidth || 3}
          fill={d.fill || "rgba(59,130,246,0.15)"}
          cornerRadius={d.cornerRadius || 0}
        />
      );
    case "ellipse":
      return (
        <Ellipse
          {...commonProps}
          x={x + width / 2}
          y={y + height / 2}
          radiusX={width / 2}
          radiusY={height / 2}
          stroke={d.color || "#a855f7"}
          strokeWidth={d.strokeWidth || 3}
          fill={d.fill || "rgba(168,85,247,0.15)"}
        />
      );
    case "polygon":
      return (
        <Line
          {...commonProps}
          points={(d.points || []).flat()}
          closed
          stroke={d.color || "#ef4444"}
          strokeWidth={d.strokeWidth || 3}
          fill={d.fill || "rgba(239,68,68,0.15)"}
        />
      );
    default:
      return null;
  }
}