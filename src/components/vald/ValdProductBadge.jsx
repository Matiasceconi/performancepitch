import React from "react";

export const PRODUCT_CONFIG = {
  ForceDecks: { color: "bg-blue-500/15 text-blue-300 border-blue-500/30", chartColor: "#3b82f6", icon: "📊" },
  NordBord: { color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", chartColor: "#10b981", icon: "🦵" },
  ForceFrame: { color: "bg-purple-500/15 text-purple-300 border-purple-500/30", chartColor: "#a855f7", icon: "🔧" },
  SmartSpeed: { color: "bg-orange-500/15 text-orange-300 border-orange-500/30", chartColor: "#f97316", icon: "⚡" },
  DynaMo: { color: "bg-pink-500/15 text-pink-300 border-pink-500/30", chartColor: "#ec4899", icon: "💪" },
  HumanTrak: { color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30", chartColor: "#06b6d4", icon: "🧍" },
};

export const PRODUCTS = ["ForceDecks", "NordBord", "ForceFrame", "SmartSpeed", "DynaMo", "HumanTrak"];

export default function ValdProductBadge({ product, size = "sm" }) {
  const cfg = PRODUCT_CONFIG[product] || PRODUCT_CONFIG.ForceDecks;
  const sizeCls = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1";
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg font-semibold border ${cfg.color} ${sizeCls}`}>
      {cfg.icon} {product}
    </span>
  );
}