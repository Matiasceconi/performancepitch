// Exportación de la pizarra: PNG, JPG, PDF y portapapeles.
// Usa stage.toDataURL() de Konva para imágenes y jsPDF para PDF.

import jsPDF from "jspdf";

const EXPORT_SIZES = {
  "16:9": { width: 1920, height: 1080 },
  "a4_horizontal": { width: 297, height: 210, unit: "mm" },
  "a4_vertical": { width: 210, height: 297, unit: "mm" },
  "square": { width: 1080, height: 1080 },
  "story": { width: 1080, height: 1920 },
};

export function getExportSize(key) {
  return EXPORT_SIZES[key] || EXPORT_SIZES["16:9"];
}

// Exporta el stage de Konva a PNG/JPG dataURL
export function stageToDataURL(stage, { format = "png", pixelRatio = 2, mimeType, quality } = {}) {
  const fmt = format === "jpg" ? "image/jpeg" : "image/png";
  return stage.toDataURL({
    mimeType: mimeType || fmt,
    quality: quality || 0.95,
    pixelRatio,
  });
}

// Descarga un dataURL como archivo
export function downloadDataURL(dataURL, filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = dataURL;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exporta una pizarra a PNG
export function exportStageAsPNG(stage, filename = "pizarra.png", pixelRatio = 2) {
  const dataURL = stageToDataURL(stage, { format: "png", pixelRatio });
  downloadDataURL(dataURL, filename);
  return dataURL;
}

// Exporta una pizarra a JPG
export function exportStageAsJPG(stage, filename = "pizarra.jpg", pixelRatio = 2) {
  const dataURL = stageToDataURL(stage, { format: "jpg", pixelRatio });
  downloadDataURL(dataURL, filename);
  return dataURL;
}

// Exporta una pizarra a PDF
export function exportStageAsPDF(stage, { filename = "pizarra.pdf", orientation = "landscape", paperSize = "a4", pixelRatio = 2 } = {}) {
  const dataURL = stageToDataURL(stage, { format: "png", pixelRatio });
  const pdf = new jsPDF({ orientation, unit: "mm", format: paperSize });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const imgH = pageH - margin * 2;
  pdf.addImage(dataURL, "PNG", margin, margin, imgW, imgH);
  pdf.save(filename);
  return dataURL;
}

// Exporta múltiples pizarras a un único PDF
export function exportStagesAsPDF(stages, { filename = "pizarras.pdf", orientation = "landscape", paperSize = "a4", pixelRatio = 2 } = {}) {
  const pdf = new jsPDF({ orientation, unit: "mm", format: paperSize });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const imgH = pageH - margin * 2;
  stages.forEach((stage, index) => {
    if (index > 0) pdf.addPage();
    const dataURL = stageToDataURL(stage, { format: "png", pixelRatio });
    pdf.addImage(dataURL, "PNG", margin, margin, imgW, imgH);
  });
  pdf.save(filename);
}

// Copia la imagen al portapapeles (si es compatible)
export async function copyStageToClipboard(stage, pixelRatio = 2) {
  if (!navigator.clipboard || !window.ClipboardItem) {
    throw new Error("El portapapeles no soporta imágenes en este navegador.");
  }
  const dataURL = stageToDataURL(stage, { format: "png", pixelRatio });
  const blob = await (await fetch(dataURL)).blob();
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  return true;
}

// Convierte el stage a un Blob (para subir con UploadFile)
export async function stageToBlob(stage, pixelRatio = 2) {
  const dataURL = stageToDataURL(stage, { format: "png", pixelRatio });
  const res = await fetch(dataURL);
  return await res.blob();
}

// Convierte un Blob a File
export function blobToFile(blob, filename = "pizarra.png") {
  return new File([blob], filename, { type: "image/png" });
}