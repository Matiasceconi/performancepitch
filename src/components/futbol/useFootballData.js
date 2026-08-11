import { useState, useEffect, useCallback } from "react";

const ENDPOINT = "https://base44.app/api/apps/6a6d734e0e73182fe462b682/functions/syncFootballData";

export async function fetchFootballData() {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "get" }),
  });
  if (!res.ok) throw new Error(`Error ${res.status} al obtener datos`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json;
}

export function useFootballData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      const json = await fetchFootballData();
      setData(json);
    } catch (e) {
      setError(e?.message || "No se pudieron cargar los datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  return { data, loading, refreshing, error, refetch: () => fetchData(true) };
}