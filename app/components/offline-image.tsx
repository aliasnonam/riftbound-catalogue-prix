"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

import { getOfflineImageSource } from "@/app/lib/offline-card-images";

export function CachedCardImage({ src, ...props }: ComponentPropsWithoutRef<"img">) {
  const [offlineImage, setOfflineImage] = useState<{ source: string; localSource: string | null } | null>(null);

  useEffect(() => {
    if (!src) return;

    let active = true;
    void getOfflineImageSource(src)
      .then((localSource) => {
        if (active) setOfflineImage({ source: src, localSource });
      })
      .catch(() => {
        // The normal remote URL remains available whenever a local image cannot be read.
      });

    return () => {
      active = false;
    };
  }, [src]);

  return <img src={(offlineImage?.source === src ? offlineImage.localSource : null) ?? src} {...props} />;
}
