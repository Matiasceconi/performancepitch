import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { resolveClubIdentity, resolveShield } from "@/lib/clubIdentityResolver";

let cache = null;

export function useClubIdentityMap() {
  const [data, setData] = useState(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    async function load() {
      try {
        const [clubs, mappings] = await Promise.all([
          base44.entities.RivalClub.list("official_name", 500),
          base44.entities.ExternalTeamMapping.list("provider", 500).catch(() => []),
        ]);
        if (cancelled) return;
        cache = { clubs, mappings };
        setData(cache);
      } catch (e) {
        console.error("club identity map load error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const resolve = useCallback((params) => {
    if (!data) {
      return {
        rival_club_id: null,
        canonicalName: params?.providerTeamName || "",
        shieldUrl: null,
        providerLogo: params?.providerLogoUrl || null,
        status: "unmatched",
        confidence: "low",
        club: null,
      };
    }
    return resolveClubIdentity(data.clubs, data.mappings, params);
  }, [data]);

  const resolveShieldUrl = useCallback((params) => {
    return resolveShield(resolve(params));
  }, [resolve]);

  return { resolve, resolveShieldUrl, loading, clubs: data?.clubs || [], mappings: data?.mappings || [] };
}