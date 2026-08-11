import { base44 } from "@/api/base44Client";

function unwrap(response) {
  return response?.data ?? response;
}

async function invoke(name, payload) {
  try {
    const response = await base44.functions.invoke(name, payload);
    const data = unwrap(response);
    if (data?.error) throw new Error(data.error);
    return data;
  } catch (error) {
    throw new Error(error?.response?.data?.error || error?.data?.error || error?.message || "Error en Evaluaciones");
  }
}

export async function evaluationsGateway(action, payload = {}) {
  return invoke("evaluationsGateway", { action, ...payload });
}

export async function evaluationsSummary(payload) {
  return invoke("getEvaluationsSummary", payload);
}

export async function evaluationPlayerProfile(payload) {
  return invoke("getEvaluationPlayerProfile", payload);
}

export async function importEvaluations(payload) {
  return invoke("importEvaluationCsv", payload);
}
