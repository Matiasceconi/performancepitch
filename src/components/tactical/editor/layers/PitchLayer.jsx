import React from "react";
import { Rect, Line, Circle } from "react-konva";
import { resolvePitchConfig } from "@/components/tactical/lib/tacticalPitchModels";

// Dibuja el fondo y líneas de la cancha según la configuración.
export default function PitchLayer({ config, width, height }) {
  const cfg = resolvePitchConfig(config);
  const model = cfg.model;
  const style = cfg.style;

  // Colores de fondo
  let bgFill = "#16a34a";
  let lineColor = cfg.lineColor || "rgba(255,255,255,0.85)";
  if (style === "flat_green") bgFill = "#16a34a";
  else if (style === "bw") { bgFill = "#1a1a1a"; lineColor = "rgba(255,255,255,0.7)"; }
  else if (style === "light") { bgFill = "#f4f4f5"; lineColor = "rgba(0,0,0,0.5)"; }
  else if (style === "transparent") bgFill = "transparent";
  else if (style === "custom") bgFill = cfg.customColor1 || "#16a34a";
  else bgFill = "#16a34a";

  const pad = Math.min(width, height) * 0.04;
  const isVertical = height > width;
  const isHalf = model.startsWith("half_");
  const isThird = model.startsWith("third_");
  const isFutsal = model === "futsal";
  const isBlank = model === "blank";

  if (isBlank) {
    return <Rect x={0} y={0} width={width} height={height} fill={style === "transparent" ? "transparent" : bgFill} />;
  }

  // Franjas de césped
  const stripes = [];
  if (style === "stripes" || style === "realistic") {
    const stripeCount = isVertical ? 8 : 10;
    const stripeW = width / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      if (i % 2 === 0) {
        stripes.push(<Rect key={i} x={i * stripeW} y={0} width={stripeW} height={height} fill="#22c55e" opacity={0.12} />);
      }
    }
  }

  // Líneas de cancha
  const lines = [];
  const lw = Math.max(2, Math.min(width, height) * 0.004);

  // Borde exterior
  lines.push(<Rect key="border" x={pad} y={pad} width={width - pad * 2} height={height - pad * 2} stroke={lineColor} strokeWidth={lw} fill={style === "realistic" ? "rgba(34,197,94,0.05)" : undefined} />);

  if (!isHalf && !isThird) {
    // Línea central
    if (isVertical) {
      lines.push(<Line key="center" points={[pad, height / 2, width - pad, height / 2]} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Circle key="centerDot" x={width / 2} y={height / 2} radius={lw * 1.5} fill={lineColor} />);
      lines.push(<Circle key="centerCircle" x={width / 2} y={height / 2} radius={height * 0.1} stroke={lineColor} strokeWidth={lw} />);
    } else {
      lines.push(<Line key="center" points={[width / 2, pad, width / 2, height - pad]} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Circle key="centerDot" x={width / 2} y={height / 2} radius={lw * 1.5} fill={lineColor} />);
      lines.push(<Circle key="centerCircle" x={width / 2} y={height / 2} radius={width * 0.1} stroke={lineColor} strokeWidth={lw} />);
    }
  }

  // Áreas de penal (solo si no es futsal sin áreas o no_areas)
  if (model !== "no_areas") {
    const paW = isVertical ? width * 0.5 : width * 0.16;
    const paH = isVertical ? height * 0.22 : height * 0.44;
    const gaW = isVertical ? width * 0.3 : width * 0.08;
    const gaH = isVertical ? height * 0.1 : height * 0.22;

    if (isVertical) {
      // Áreas arriba y abajo
      lines.push(<Rect key="paTop" x={(width - paW) / 2} y={pad} width={paW} height={paH} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Rect key="paBot" x={(width - paW) / 2} y={height - pad - paH} width={paW} height={paH} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Rect key="gaTop" x={(width - gaW) / 2} y={pad} width={gaW} height={gaH} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Rect key="gaBot" x={(width - gaW) / 2} y={height - pad - gaH} width={gaW} height={gaH} stroke={lineColor} strokeWidth={lw} />);
    } else {
      // Áreas izquierda y derecha
      lines.push(<Rect key="paLeft" x={pad} y={(height - paH) / 2} width={paW} height={paH} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Rect key="paRight" x={width - pad - paW} y={(height - paH) / 2} width={paW} height={paH} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Rect key="gaLeft" x={pad} y={(height - gaH) / 2} width={gaW} height={gaH} stroke={lineColor} strokeWidth={lw} />);
      lines.push(<Rect key="gaRight" x={width - pad - gaW} y={(height - gaH) / 2} width={gaW} height={gaH} stroke={lineColor} strokeWidth={lw} />);
    }
  }

  // Overlays
  const overlays = [];
  if (cfg.overlays?.includes("lanes5")) {
    for (let i = 1; i < 5; i++) {
      const x = (width / 5) * i;
      overlays.push(<Line key={`lane${i}`} points={[x, pad, x, height - pad]} stroke={lineColor} strokeWidth={lw * 0.5} dash={[8, 8]} opacity={0.4} />);
    }
  }
  if (cfg.overlays?.includes("zones3")) {
    for (let i = 1; i < 3; i++) {
      const y = (height / 3) * i;
      overlays.push(<Line key={`zone${i}`} points={[pad, y, width - pad, y]} stroke={lineColor} strokeWidth={lw * 0.5} dash={[8, 8]} opacity={0.4} />);
    }
  }
  if (cfg.overlays?.includes("halves")) {
    if (isVertical) {
      overlays.push(<Line key="half" points={[pad, height / 2, width - pad, height / 2]} stroke={lineColor} strokeWidth={lw} opacity={0.5} />);
    } else {
      overlays.push(<Line key="half" points={[width / 2, pad, width / 2, height - pad]} stroke={lineColor} strokeWidth={lw} opacity={0.5} />);
    }
  }
  if (cfg.overlays?.includes("thirds")) {
    if (isVertical) {
      overlays.push(<Line key="t1" points={[pad, height / 3, width - pad, height / 3]} stroke={lineColor} strokeWidth={lw * 0.5} dash={[6, 6]} opacity={0.4} />);
      overlays.push(<Line key="t2" points={[pad, (height / 3) * 2, width - pad, (height / 3) * 2]} stroke={lineColor} strokeWidth={lw * 0.5} dash={[6, 6]} opacity={0.4} />);
    } else {
      overlays.push(<Line key="t1" points={[width / 3, pad, width / 3, height - pad]} stroke={lineColor} strokeWidth={lw * 0.5} dash={[6, 6]} opacity={0.4} />);
      overlays.push(<Line key="t2" points={[(width / 3) * 2, pad, (width / 3) * 2, height - pad]} stroke={lineColor} strokeWidth={lw * 0.5} dash={[6, 6]} opacity={0.4} />);
    }
  }

  // Cuadrícula
  if (cfg.showGrid) {
    const gs = cfg.gridSize || 80;
    for (let x = gs; x < width; x += gs) {
      overlays.push(<Line key={`gv${x}`} points={[x, 0, x, height]} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />);
    }
    for (let y = gs; y < height; y += gs) {
      overlays.push(<Line key={`gh${y}`} points={[0, y, width, y]} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />);
    }
  }

  return (
    <>
      <Rect x={0} y={0} width={width} height={height} fill={bgFill} />
      {stripes}
      {lines}
      {overlays}
    </>
  );
}