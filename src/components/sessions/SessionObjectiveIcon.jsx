import React from "react";

function BaseSvg({ children, size = 78, color = "#FDE047", className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
}

function LudicoIcon(props) {
  return (
    <BaseSvg {...props}>
      <circle cx="52" cy="42" r="27" />
      <path d="M52 15l15 10 7 16-9 16-13 8-15-8-8-16 8-16z" />
      <path d="M37 25l15 10 15-10M29 41h17l6-6 6 6h16M37 57l9-16M66 57l-8-16" />
      <path d="M24 104h28M16 96l9-39 13 39M13 104h34" />
      <path d="M82 104h26M80 96l7-33 12 33M76 104h34" />
      <path d="M78 76h22l-11-30z" />
    </BaseSvg>
  );
}

function MetabolicoIcon(props) {
  return (
    <BaseSvg {...props}>
      <circle cx="72" cy="18" r="8" />
      <path d="M58 31l-18 9-12 25" />
      <path d="M58 31l19 18-7 23" />
      <path d="M43 48l22 12" />
      <path d="M41 64l-16 20 26 7" />
      <path d="M69 72l-1 27" />
      <path d="M14 86c16 0 20 14 36 14" />
      <path d="M86 58h12l5-13 8 30 6-17h9" />
    </BaseSvg>
  );
}

function VelocidadIcon(props) {
  return (
    <BaseSvg {...props}>
      <circle cx="74" cy="21" r="9" />
      <path d="M53 37l23 12 16-11" />
      <path d="M53 37L32 52" />
      <path d="M53 37l-10 28 30 3" />
      <path d="M43 65L22 92h28" />
      <path d="M73 68l-8 33" />
      <path d="M20 45h24M9 62h24M15 104h67" />
    </BaseSvg>
  );
}

function DuracionIcon(props) {
  return (
    <BaseSvg {...props}>
      <circle cx="39" cy="35" r="27" />
      <path d="M39 17v18l12 11" />
      <path d="M18 76h86v35H18z" />
      <path d="M61 76v35M18 94h25M79 94h25" />
      <circle cx="61" cy="94" r="10" />
      <path d="M31 76v35M91 76v35" />
    </BaseSvg>
  );
}

function TensionIcon(props) {
  return (
    <BaseSvg {...props}>
      <path d="M17 72l18 7 19-34 26 16" />
      <path d="M55 45l-17-17" />
      <path d="M80 61l20-11 1 19 15 8-17 10-3 20-15-13-22 8 10-22z" />
      <path d="M24 101h54" />
      <path d="M39 28l12 9M31 39l11 5" />
    </BaseSvg>
  );
}

export function getSessionVisual(name = "", objective = {}) {
  const value = String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (value.includes("lud")) return { Icon: LudicoIcon, accent: "#FDE047", text: "Lúdico" };
  if (value.includes("metab") || value.includes("mixto")) return { Icon: MetabolicoIcon, accent: "#F43F5E", text: name || "Mixto / Metabólico" };
  if (value.includes("velocidad")) return { Icon: VelocidadIcon, accent: "#22C55E", text: name || "Velocidad" };
  if (value.includes("duracion") || value.includes("duración")) return { Icon: DuracionIcon, accent: "#93C5FD", text: name || "Duración" };
  if (value.includes("tension") || value.includes("tensión") || value.includes("neuromuscular")) return { Icon: TensionIcon, accent: "#60A5FA", text: name || "Tensión" };
  return { Icon: VelocidadIcon, accent: objective.color || "#FDE047", text: name || "Sesión" };
}