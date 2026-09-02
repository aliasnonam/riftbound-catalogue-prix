"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";

import { getOfflineImageSource } from "@/app/lib/offline-card-images";

type LocalImage = { source: string; localSource: string | null };

export function CachedCardImage({ src, onError, ...props }: ComponentPropsWithoutRef<"img">) {
  const [offlineImage, setOfflineImage] = useState<LocalImage | null>(null);
  const [failedRemoteSource, setFailedRemoteSource] = useState<string | null>(null);

  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const localSource = offlineImage?.source === src ? offlineImage.localSource : undefined;
  const remoteFailed = failedRemoteSource === src;
  const waitForLocalCopy = !src || localSource === undefined && (isOffline || remoteFailed);
  const activeSource = waitForLocalCopy
    ? undefined
    : isOffline || remoteFailed
      ? localSource ?? undefined
      : src;

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

  return <img
    src={activeSource}
    {...props}
    onError={(event) => {
      if (activeSource === src && !remoteFailed) {
        setFailedRemoteSource(src);
        return;
      }

      onError?.(event);
    }}
  />;
}
