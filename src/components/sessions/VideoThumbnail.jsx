import React, { useState } from "react";
import { Play } from "lucide-react";
import { getVideoThumbnailUrl } from "@/components/sessions/exerciseLibrarySync";

/**
 * Muestra siempre una previsualización real del video:
 * - YouTube: usa la miniatura oficial (img).
 * - Otros (mp4, etc.): renderiza un <video> con preload="metadata" para mostrar el primer frame.
 * Solo cae al placeholder gris si el video no puede cargarse.
 */
export default function VideoThumbnail({ url, alt = "miniatura de video", className = "w-full max-h-40 object-cover", fallbackHeight = "h-28" }) {
  const [videoError, setVideoError] = useState(false);
  const youtubeThumb = url ? getVideoThumbnailUrl(url) : "";

  if (youtubeThumb) {
    return <img src={youtubeThumb} alt={alt} className={className} />;
  }

  if (url && !videoError) {
    // #t=0.1 fuerza al navegador a buscar un frame para mostrarlo como poster
    const srcWithFragment = url.includes("#") ? url : `${url}#t=0.1`;
    return (
      <video
        src={srcWithFragment}
        muted
        preload="metadata"
        playsInline
        className={className}
        onError={() => setVideoError(true)}
      />
    );
  }

  return (
    <div className={`w-full ${fallbackHeight} flex items-center justify-center bg-zinc-700`}>
      <Play size={24} className="text-zinc-500" />
    </div>
  );
}