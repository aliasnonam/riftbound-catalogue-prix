"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

export const OFFLINE_IMAGE_CACHE = "riftbound-card-images-v1";

function canReadOfflineCache(src: string) {
  return src.startsWith("http://") || src.startsWith("https://");
}

export function CachedCardImage({ src, ...props }: ComponentPropsWithoutRef<"img">) {
  const [cachedSrc, setCachedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!src || !canReadOfflineCache(src) || typeof caches === "undefined") {
      setCachedSrc(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    void caches.open(OFFLINE_IMAGE_CACHE)
      .then((cache) => cache.match(src))
      .then(async (response) => {
        if (!response || !active) return;
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setCachedSrc(objectUrl);
      })
      .catch(() => {
        // The normal remote URL remains available whenever a cached image cannot be read.
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  return <img src={cachedSrc ?? src} {...props} />;
}
