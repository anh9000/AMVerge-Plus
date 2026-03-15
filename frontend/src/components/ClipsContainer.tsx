import { memo, startTransition, useCallback, useEffect, useRef, useState } from "react";
import { convertFileSrc, invoke } from "@tauri-apps/api/core";

// --------------------
//     Types/Props
// --------------------

type ClipContainerProps = {
  onSelectClip: (clip: string) => void;
  gridSize: number;
  gridRef: React.RefObject<HTMLDivElement | null>;
  cols: number;
  gridPreview: boolean;
  setSelectedClips: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedClips: Set<string>;
  clips: { id: string; src: string; thumbnail: string }[];
  importToken: string;
  loading: boolean;
  isEmpty: boolean;
  videoIsHEVC: boolean | null;
  userHasHEVC: React.RefObject<boolean>;
};

// --------------------
//   Lazy Video Cell
// --------------------

type LazyClipProps = {
  clip: { id: string; src: string, thumbnail: string };
  index: number;
  importToken: string;
  isSelected: boolean;
  gridPreview: boolean;
  requestProxySequential: (clipPath: string, priority: boolean) => Promise<string>;
  reportProxyDemand: (clipPath: string, demand: { order: number; priority: boolean } | null) => void;
  onClipClick: (
    clipId: string,
    clipSrc: string,
    index: number,
    e: React.MouseEvent<HTMLDivElement>
  ) => void;
  registerVideoRef: (clipId: string, el: HTMLVideoElement | null) => void;
  videoIsHEVC: boolean | null;
  userHasHEVC: React.RefObject<boolean>;
};

const LazyClip = memo(function LazyClip({
  clip,
  index,
  importToken,
  isSelected,
  gridPreview,
  requestProxySequential,
  reportProxyDemand,
  onClipClick,
  registerVideoRef,
  videoIsHEVC,
  userHasHEVC,
}: LazyClipProps) {
  // LazyClip lifecycle in a nutshell:
  // 1) IntersectionObserver sets isVisible (only render media when near viewport).
  // 2) Hover/gridPreview toggles isHovered/showVideo (only mount <video> when needed).
  // 3) A useEffect watches isHovered/gridPreview and calls video.play()/pause().
  // 4) If playback fails or shows black, we ask Rust to generate an H.264 proxy.
  // tracks whether this clip has entered the viewport at least once
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const hasReportedErrorRef = useRef(false); // check if video error has been reported
  const hasPlayedRef = useRef(false);
  const hasFirstFrameRef = useRef(false);
  const videoFrameCallbackIdRef = useRef<number | null>(null);
  const proxyInFlightRef = useRef(false);

  // When playback fails (e.g., missing HEVC codec), keep showing the thumbnail
  // while we generate/switch to a proxy instead of displaying a black video.
  const [forceThumbnail, setForceThumbnail] = useState(false);

  // Used to prevent the brief black flash when we mount/swap the <video>.
  // We keep the thumbnail visible (as an overlay) until the video reports it has data.
  const [isVideoReady, setIsVideoReady] = useState(false);

  // This tile's playback source. Starts as the original clip; may be swapped to a proxy later.
  const [effectiveSrc, setEffectiveSrc] = useState(clip.src);

  // If the imported video is HEVC and the user can't decode HEVC, we must avoid attempting
  // to mount/play the original stream and instead use an H.264 proxy.
  const needsHevcProxy = videoIsHEVC === true && userHasHEVC.current === false;
  const waitingForCodecInfo = videoIsHEVC === null && userHasHEVC.current === false;

  // When Preview-all is enabled and we need an HEVC proxy, register demand only while visible.
  // This allows the parent to re-prioritize work when the user scrolls.
  useEffect(() => {
    if (!gridPreview) {
      reportProxyDemand(clip.src, null);
      return;
    }

    const wantsProxyNow =
      needsHevcProxy &&
      isVisible &&
      effectiveSrc === clip.src; // still on original => proxy not yet applied

    if (wantsProxyNow) {
      reportProxyDemand(clip.src, { order: index, priority: isHovered });
    } else {
      reportProxyDemand(clip.src, null);
    }
  }, [gridPreview, needsHevcProxy, isVisible, effectiveSrc, clip.src, index, isHovered, reportProxyDemand]);

  useEffect(() => {
    hasReportedErrorRef.current = false;
    hasPlayedRef.current = false;
    hasFirstFrameRef.current = false;
    proxyInFlightRef.current = false;

    const v = internalVideoRef.current;
    if (v && videoFrameCallbackIdRef.current && (v as any).cancelVideoFrameCallback) {
      try {
        (v as any).cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      } catch {
        // ignore
      }
    }
    videoFrameCallbackIdRef.current = null;
    setForceThumbnail(false);
    setIsVideoReady(false);
    setEffectiveSrc(clip.src);
  }, [clip.src, importToken]);

  // Proactive HEVC gating:
  // If HEVC isn't supported, request the proxy as soon as the user hovers (or gridPreview is on),
  // and keep the thumbnail visible until we can swap to the proxy.
  useEffect(() => {
    if (!needsHevcProxy) return;
    if (!isVisible) return;

    const showVideo = isHovered || gridPreview;
    if (!showVideo) return;

    if (effectiveSrc !== clip.src) return; // already proxy
    if (proxyInFlightRef.current) return;

    proxyInFlightRef.current = true;
    setForceThumbnail(true);
    setIsVideoReady(false);

    const clipPath = clip.src;

    const run = async () => {
      try {
        const proxyPath = gridPreview
          ? await requestProxySequential(clipPath, /* priority */ isHovered)
          : await invoke<string>("ensure_preview_proxy", { clipPath });

        // If this tile has since been rebound to a different clip, ignore the result.
        if (clip.src !== clipPath) return;

        if (!proxyPath) {
          // If we can't generate a proxy, don't mount the (unsupported) HEVC video.
          setForceThumbnail(true);
          return;
        }

        setEffectiveSrc(proxyPath);
        setForceThumbnail(false);

        setTimeout(() => {
          const vid = internalVideoRef.current;
          if (!vid) return;
          vid.load();
          vid.play().catch(() => {});
        }, 0);
      } catch (err) {
        console.warn("ensure_preview_proxy failed", err);
        // Stay on the thumbnail; the original HEVC stream is not playable.
        setForceThumbnail(true);
      } finally {
        proxyInFlightRef.current = false;
      }
    };

    void run();
  }, [needsHevcProxy, isVisible, isHovered, gridPreview, effectiveSrc, clip.src, requestProxySequential]);

  
  const requestFirstFrame = useCallback((video: HTMLVideoElement) => {
    if (hasFirstFrameRef.current) return;
    if (!(video as any).requestVideoFrameCallback) return;
    if (videoFrameCallbackIdRef.current) return;

    try {
      videoFrameCallbackIdRef.current = (video as any).requestVideoFrameCallback(() => {
        hasFirstFrameRef.current = true;
        hasPlayedRef.current = true;
        videoFrameCallbackIdRef.current = null;
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    // Viewport gating: only mark the tile visible when it's near the viewport.
    // This keeps the grid fast (avoid mounting thumbnails/videos for off-screen tiles).
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "400px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Playback control (robust):
  // - When hovered (or grid preview mode) AND the video is mounted, ensure it loads and plays.
  // - When not hovered, pause and rewind to 0 so hover-preview always starts at the beginning.
  // We intentionally keep this separate from the proxy queue; it applies to all non-proxy playback too.
  useEffect(() => {
    const v = internalVideoRef.current;
    if (!v) return;

    const showVideo = gridPreview || isHovered;
    const waitingForRequiredProxy = needsHevcProxy && effectiveSrc === clip.src;
    const shouldMountVideoNow =
      showVideo && !forceThumbnail && !waitingForRequiredProxy && !waitingForCodecInfo;

    const shouldPlay = showVideo && shouldMountVideoNow;
    if (shouldPlay) {
      // Make autoplay rules deterministic (especially in WebView).
      v.muted = true;
      v.autoplay = true;
      v.loop = true;
      try {
        if (v.readyState === 0) v.load();
      } catch {
        // ignore
      }
      v.play().catch(() => {});
    } else {
      v.pause();
      try {
        v.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, [gridPreview, isHovered, effectiveSrc, clip.src, needsHevcProxy, forceThumbnail, waitingForCodecInfo]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      onClipClick(clip.id, clip.src, index, e);
    },
    [clip.id, clip.src, index, onClipClick]
  );

  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      internalVideoRef.current = el;
      registerVideoRef(clip.id, el);
    },
    [clip.id, registerVideoRef]
  );

  // UI policy:
  // - showVideo: hover or grid preview indicates we *want* to display motion.
  // - shouldMountVideo: whether we actually mount the <video> element (skip it when showing a thumbnail
  //   or when forceThumbnail is enabled during proxy generation / error states).
  const showVideo = isHovered || gridPreview;
  const waitingForRequiredProxy = needsHevcProxy && effectiveSrc === clip.src;
  const shouldMountVideo = showVideo && !forceThumbnail && !waitingForRequiredProxy && !waitingForCodecInfo;

  // Keep the thumbnail visible until the video is actually ready.
  const shouldShowThumbnail = !showVideo || !shouldMountVideo || !isVideoReady;

  return (
    <div
      ref={wrapperRef}
      className={`clip-wrapper ${isSelected ? "selected" : ""}`}
      onClick={handleClick}
      // Hover toggles isHovered, which controls whether the <video> mounts and whether playback starts.
      onMouseEnter={() => {
        // IntersectionObserver can lag by a tick; hovering should always mount/play immediately.
        setIsVisible(true);
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        // Clear transient error/thumbnail flags so a later hover can try again.
        hasReportedErrorRef.current = false;
        setForceThumbnail(false);
        setIsVideoReady(false);
      }}
    >
      {isVisible ? (
        <>
          {/* Thumbnail — always rendered when visible, hidden on hover */}
          <img
            className="clip"
            src={`${convertFileSrc(clip.thumbnail)}?v=${importToken}`}
            style={{ opacity: shouldShowThumbnail ? 1 : 0 }}
          />
          {/* Video — only mounted when hovered or gridPreview, otherwise skip the DOM node entirely */}
          {shouldMountVideo && (
            <video
              className="clip"
              src={`${convertFileSrc(effectiveSrc)}?v=${importToken}`}
              muted
              loop
              autoPlay
              playsInline
              preload="none"
              ref={setVideoRef}
              style={{ position: "absolute", inset: 0 }}
              onLoadedMetadata={(e) => {
                // If the element mounts while hovered, give autoplay another nudge.
                if (gridPreview || isHovered) {
                  e.currentTarget.muted = true;
                  e.currentTarget.play().catch(() => {});
                }
              }}
              onPlaying={(e) => {
                hasPlayedRef.current = true;
                requestFirstFrame(e.currentTarget);
                setIsVideoReady(true);
              }}
              onLoadedData={() => {
                hasFirstFrameRef.current = true;
                setIsVideoReady(true);
              }}
              onError={(e) => {
                console.log(`onError fired!: userHasHEVC -> ${userHasHEVC} | videIsHEVC -> ${videoIsHEVC}`)
                if (hasReportedErrorRef.current) return; // if clip already ran into an error
                hasReportedErrorRef.current = true;      // flag clip as "ran into an error"

                // If the proxy itself errors, don't loop proxy generation; just fall back to thumbnail.
                if (effectiveSrc !== clip.src) {
                  setForceThumbnail(true);
                  return;
                }

                setForceThumbnail(true);

                const v = e.currentTarget;
                const errorCode = v.error?.code ?? null;
                console.log(`Error on video -> CODE: ${errorCode}`)
                // Signal Rust; no additional behavior yet.
                invoke("hover_preview_error", {
                  clipId: clip.id,
                  clipPath: clip.src,
                  errorCode,
                }).catch(() => {
                  // Ignore errors (e.g., command not registered yet)
                });
              }}
            />
          )}
        </>
      ) : (
        <div className="clip clip-skeleton" style={{ borderRadius: 15 }} />
      )}
    </div>
  );
});

// --------------------
//   Main Container
// --------------------

export default function ClipsContainer(props: ClipContainerProps) {
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const lastSelectedIndexRef = useRef<number | null>(null);

  // Grid-preview optimization: run HEVC->H.264 proxy conversions sequentially.
  // The queue is viewport-aware: when the user scrolls, offscreen requests are cancelled and
  // the next conversion is selected from the currently visible tiles (hovered first, then top-most).
  type DeferredProxy = {
    promise: Promise<string>;
    resolve: (proxyPath: string) => void;
    reject: (err: unknown) => void;
  };

  const proxyCacheRef = useRef<Map<string, string>>(new Map());
  const proxyDeferredRef = useRef<Map<string, DeferredProxy>>(new Map());
  const proxyProcessingRef = useRef(false);

  type ProxyDemand = {
    order: number; // lower = earlier in grid (closer to top)
    priority: boolean; // hovered tiles get first dibs
    seq: number; // recency (higher = more recently demanded)
  };

  const proxyDemandRef = useRef<Map<string, ProxyDemand>>(new Map());
  const proxyDemandSeqRef = useRef(0);
  const proxyInFlightClipRef = useRef<string | null>(null);

  const pickNextProxyClip = useCallback((): string | null => {
    const demands = proxyDemandRef.current;
    const deferreds = proxyDeferredRef.current;

    let best: { clipPath: string; demand: ProxyDemand } | null = null;

    for (const [clipPath, demand] of demands) {
      if (!deferreds.has(clipPath)) continue;
      if (proxyInFlightClipRef.current === clipPath) continue;

      if (!best) {
        best = { clipPath, demand };
        continue;
      }

      // Sort key:
      // 1) priority (true first)
      // 2) order (smaller index first => top-most)
      // 3) seq (more recent first)
      const a = demand;
      const b = best.demand;

      const aPri = a.priority ? 1 : 0;
      const bPri = b.priority ? 1 : 0;
      if (aPri !== bPri) {
        if (aPri > bPri) best = { clipPath, demand };
        continue;
      }

      if (a.order !== b.order) {
        if (a.order < b.order) best = { clipPath, demand };
        continue;
      }

      if (a.seq !== b.seq) {
        if (a.seq > b.seq) best = { clipPath, demand };
      }
    }

    return best?.clipPath ?? null;
  }, []);

  const processProxyQueue = useCallback(async () => {
    if (proxyProcessingRef.current) return;
    proxyProcessingRef.current = true;

    try {
      while (true) {
        const clipPath = pickNextProxyClip();
        if (!clipPath) break;

        // Cache hit.
        const cached = proxyCacheRef.current.get(clipPath);
        if (cached) {
          const deferred = proxyDeferredRef.current.get(clipPath);
          if (deferred) {
            deferred.resolve(cached);
            proxyDeferredRef.current.delete(clipPath);
          }
          continue;
        }

        const deferred = proxyDeferredRef.current.get(clipPath);
        if (!deferred) continue;

        try {
          proxyInFlightClipRef.current = clipPath;
          const proxyPath = await invoke<string>("ensure_preview_proxy", { clipPath });
          if (!proxyPath) throw new Error("ensure_preview_proxy returned empty path");

          proxyCacheRef.current.set(clipPath, proxyPath);
          deferred.resolve(proxyPath);
        } catch (err) {
          deferred.reject(err);
        } finally {
          if (proxyInFlightClipRef.current === clipPath) proxyInFlightClipRef.current = null;
          proxyDeferredRef.current.delete(clipPath);
        }
      }
    } finally {
      proxyProcessingRef.current = false;
    }
  }, [pickNextProxyClip]);

  const requestProxySequential = useCallback(
    (clipPath: string, priority: boolean) => {
      const cached = proxyCacheRef.current.get(clipPath);
      if (cached) return Promise.resolve(cached);

      const existing = proxyDeferredRef.current.get(clipPath);
      if (existing) return existing.promise;

      let resolve!: (proxyPath: string) => void;
      let reject!: (err: unknown) => void;
      const promise = new Promise<string>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      proxyDeferredRef.current.set(clipPath, { promise, resolve, reject });

      // Demand/priority is tracked separately (viewport-aware). We still accept `priority`
      // here to avoid any chance of delayed hover prioritization.
      const seq = ++proxyDemandSeqRef.current;
      const existingDemand = proxyDemandRef.current.get(clipPath);
      proxyDemandRef.current.set(clipPath, {
        order: existingDemand?.order ?? Number.POSITIVE_INFINITY,
        priority: priority || existingDemand?.priority === true,
        seq,
      });

      void processProxyQueue();
      return promise;
    },
    [processProxyQueue]
  );

  const reportProxyDemand = useCallback(
    (clipPath: string, demand: { order: number; priority: boolean } | null) => {
      if (!demand) {
        proxyDemandRef.current.delete(clipPath);

        // If this item was queued but scrolled offscreen before being processed, cancel it.
        // This keeps the queue focused on what the user can currently see.
        const deferred = proxyDeferredRef.current.get(clipPath);
        if (deferred && proxyInFlightClipRef.current !== clipPath && !proxyCacheRef.current.has(clipPath)) {
          deferred.reject(new Error("proxy request cancelled (no longer visible)"));
          proxyDeferredRef.current.delete(clipPath);
        }

        return;
      }

      const seq = ++proxyDemandSeqRef.current;
      proxyDemandRef.current.set(clipPath, {
        order: demand.order,
        priority: demand.priority,
        seq,
      });

      // Kick the processor in case it was idle and we just scrolled new items into view.
      void processProxyQueue();
    },
    [processProxyQueue]
  );

  const effectiveCols = props.loading
    ? props.cols
    : Math.max(1, Math.min(props.cols, props.clips.length));

  const clipMaxWidth = !props.loading && props.clips.length <= 2 ? 520 : 260;

  const registerVideoRef = useCallback((clipId: string, el: HTMLVideoElement | null) => {
    videoRefs.current[clipId] = el;
  }, []);

  const onClipClick = useCallback(
    (clipId: string, clipSrc: string, index: number, e: React.MouseEvent<HTMLDivElement>) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      if (import.meta.env.DEV) {
        (window as any).__amverge_lastClipClickT = performance.now();
        (window as any).__amverge_lastClipClickSrc = clipSrc;
      }

      const lastSelectedIndex = lastSelectedIndexRef.current;

      // Preserve existing behavior: shift-range selects only (doesn't change the preview player).
      if (isShift && lastSelectedIndex !== null) {
        const currentIndex = props.clips.findIndex((c) => c.id === clipId);
        if (currentIndex !== -1) {
          const [start, end] = [lastSelectedIndex, currentIndex].sort((a, b) => a - b);
          const range = props.clips.slice(start, end + 1).map((c) => c.id);
          startTransition(() => {
            props.setSelectedClips(new Set(range));
          });
        }
        return;
      }

      // Preview player update should be "urgent".
      props.onSelectClip(clipSrc);

      // Selection can be non-urgent; this avoids blocking the video swap on big grids.
      startTransition(() => {
        if (isCtrl) {
          props.setSelectedClips((prev) => {
            const next = new Set(prev);
            next.has(clipId) ? next.delete(clipId) : next.add(clipId);
            return next;
          });
        } else {
          props.setSelectedClips(new Set([clipId]));
        }
      });

      lastSelectedIndexRef.current = index;
    },
    [props.clips, props.onSelectClip, props.setSelectedClips]
  );

  return (
    <main className="clips-container">
      { props.isEmpty ? (
        <p id="empty-grid">No video loaded.</p>
      ) : (
          <div
            ref={props.gridRef}
            className="clips-grid"
            style={{
              gridTemplateColumns: `repeat(${effectiveCols}, minmax(0, 1fr))`,
              // Let 1–2 clips scale up instead of staying clamped.
              // The CSS reads this as `max-width` for each tile.
              ["--clip-max-width" as any]: `${clipMaxWidth}px`,
            }}
          >
            {props.loading
              ? Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="clip-skeleton" />
                ))
              : props.clips.map((clip, index) => (
                  <LazyClip
                    key={clip.id}
                    clip={clip}
                    index={index}
                    importToken={props.importToken}
                    isSelected={props.selectedClips.has(clip.id)}
                    gridPreview={props.gridPreview}
                    requestProxySequential={requestProxySequential}
                    reportProxyDemand={reportProxyDemand}
                    registerVideoRef={registerVideoRef}
                    onClipClick={onClipClick}
                    videoIsHEVC={props.videoIsHEVC}
                    userHasHEVC={props.userHasHEVC}
                  />
                ))}
          </div>
       )}
    </main>
  );
}