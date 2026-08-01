import React, { useState } from "react";
import { useClubIdentityMap } from "@/hooks/useClubIdentityMap";
import { resolveShield } from "@/lib/clubIdentityResolver";

/**
 * Componente compartido para renderizar escudos de clubes.
 * Resuelve la identidad canónica via RivalClub antes de mostrar el logo.
 * Prioridad: RivalClub.shield_url > logo del proveedor > placeholder
 */
export default function ClubShield({ teamName, teamLogo, providerTeamId, provider = "api_sports", size = "w-6 h-6", className = "", rounded = "rounded-full" }) {
  const { resolve } = useClubIdentityMap();
  const [err, setErr] = useState(false);

  const resolved = resolve({ provider, providerTeamId, providerTeamName: teamName, providerLogoUrl: teamLogo });
  const shieldUrl = resolveShield(resolved);
  const displayName = resolved.canonicalName || teamName || "";

  if (!shieldUrl || err) {
    return (
      <div className={`${size} ${rounded} bg-zinc-800 border border-zinc-700 flex items-center justify-center shrink-0 ${className}`}>
        <span className="text-[10px] font-bold text-zinc-400">{(displayName || "?").charAt(0)}</span>
      </div>
    );
  }
  return <img src={shieldUrl} alt={displayName} className={`${size} object-contain shrink-0 ${className}`} onError={() => setErr(true)} />;
}