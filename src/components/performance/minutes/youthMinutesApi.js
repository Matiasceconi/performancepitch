import { base44 } from "@/api/base44Client";

function unwrap(response) {
  return response?.data || response || {};
}

function getErrorMessage(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}

export async function listYouthMinutes() {
  try {
    const response = await base44.functions.invoke("manageYouthMinutes", { action: "list" });
    return unwrap(response)?.records || [];
  } catch (error) {
    throw new Error(getErrorMessage(error, "No se pudieron cargar los minutos de Juveniles."));
  }
}

export async function saveYouthMinutes(payload) {
  try {
    const response = await base44.functions.invoke("manageYouthMinutes", {
      action: "upsert",
      ...payload,
    });
    return unwrap(response);
  } catch (error) {
    throw new Error(getErrorMessage(error, "No se pudo guardar la carga de Juveniles."));
  }
}

export async function deleteYouthMinutes(recordId) {
  try {
    const response = await base44.functions.invoke("manageYouthMinutes", {
      action: "delete",
      recordId,
    });
    return unwrap(response);
  } catch (error) {
    throw new Error(getErrorMessage(error, "No se pudo eliminar la carga de Juveniles."));
  }
}
