"""
Content-aware scene detection algorithms optimised for different footage types.

- detect_anime:       dHash fast pass + Canny edge cosine verification.
                      Only scans intervals where keyframes are unusually far
                      apart (encoder likely missed a cut).  Evolved from the
                      original AMVerge cosine-similarity algorithm.

- detect_music_video: dHash-only sampled scan.  No Canny — music videos have
                      hard, obvious cuts; the extra verification step just
                      slows things down.
"""

from __future__ import annotations

import math
from typing import Callable

import av
import cv2
import numpy as np
from PIL import Image


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def dhash(arr: np.ndarray, hash_size: int = 8) -> np.ndarray:
    """Compute a difference-hash for a grayscale numpy array.

    Resizes to (hash_size+1) × hash_size, then for each row compares each
    pixel to the one to its right.  Returns a flat bool array of length
    hash_size².
    """
    img = Image.fromarray(arr).convert("L").resize(
        (hash_size + 1, hash_size), Image.Resampling.LANCZOS
    )
    pixels = np.array(img, dtype=np.float32)
    diff = pixels[:, 1:] > pixels[:, :-1]
    return diff.flatten()


def hamming_distance(h1: np.ndarray, h2: np.ndarray) -> int:
    """Count the number of differing bits between two dHash arrays."""
    return int(np.count_nonzero(h1 != h2))


def pooling(edges: np.ndarray, blocksize: int = 3) -> np.ndarray:
    """Average-pool an edge map into non-overlapping blocks."""
    h = (edges.shape[0] // blocksize) * blocksize
    w = (edges.shape[1] // blocksize) * blocksize
    arr = edges[:h, :w].astype(np.float32)
    arr = arr.reshape(h // blocksize, blocksize, w // blocksize, blocksize)
    return arr.mean(axis=(1, 3))


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two flattened arrays."""
    a = a.flatten().astype(np.float32)
    b = b.flatten().astype(np.float32)
    denom = float(np.linalg.norm(a)) * float(np.linalg.norm(b))
    if denom == 0.0:
        return 1.0
    return float(np.dot(a, b) / denom)


# ---------------------------------------------------------------------------
# Anime detection  (dHash + Canny, suspicious-interval only)
# ---------------------------------------------------------------------------

# Intervals longer than this (seconds) are scanned for missed cuts.
# Shorter intervals already have dense keyframes — no cut was missed.
_ANIME_SUSPICIOUS_INTERVAL_S = 3.0

# Decode every Nth frame inside a suspicious interval.
# 3 = fast; 1 = frame-perfect but slow.
_ANIME_FRAME_SAMPLE_RATE = 3

# Canny dissimilarity threshold — frames that pass dHash ambiguity check
# are verified with Canny.  Value is 1 - cosine_similarity (0..1).
_ANIME_CANNY_DISSIMILARITY = 0.25


def detect_anime(
    video_path: str,
    keyframes: list[float],
    sensitivity: float = 20.0,
    progress_cb: Callable[[int, str], None] | None = None,
) -> list[float]:
    """Return cut-point timestamps for anime footage.

    Only scans intervals between consecutive keyframes that are suspiciously
    long (> _ANIME_SUSPICIOUS_INTERVAL_S).  This avoids decoding the entire
    video — for well-encoded anime files it may decode nothing at all, since
    the encoder already placed keyframes at every scene cut.

    sensitivity: 10 (many cuts) → 40 (few cuts).  Maps to dHash thresholds.
    """
    # Map sensitivity to dHash thresholds.
    # At sensitivity=20: hi=12, lo=8
    # At sensitivity=10: hi=6,  lo=4
    # At sensitivity=40: hi=24, lo=16
    dhash_hi = max(5, int(sensitivity * 0.6))
    dhash_lo = max(3, int(sensitivity * 0.4))

    # Find suspicious intervals only.
    suspicious: list[tuple[float, float]] = []
    for i in range(len(keyframes) - 1):
        start, end = keyframes[i], keyframes[i + 1]
        if (end - start) > _ANIME_SUSPICIOUS_INTERVAL_S:
            suspicious.append((start, end))

    if not suspicious:
        # Keyframes are already dense — nothing to do.
        return []

    cut_timestamps: list[float] = []
    total = len(suspicious)

    for idx, (start, end) in enumerate(suspicious):
        if progress_cb:
            pct = 20 + int(50 * idx / total)
            progress_cb(pct, f"Anime scan: interval {idx + 1}/{total}")

        try:
            container = av.open(video_path)
            stream = container.streams.video[0]

            # Seek to just before the window.
            container.seek(int(start * 1_000_000), any_frame=False, backward=True)

            prev_hash: np.ndarray | None = None
            prev_edges: np.ndarray | None = None
            frame_count = 0

            for frame in container.decode(stream):
                if frame.time is None:
                    continue
                ts = float(frame.time)
                if ts < start:
                    continue
                if ts > end:
                    break

                frame_count += 1
                if frame_count % _ANIME_FRAME_SAMPLE_RATE != 0:
                    # Reset prev so we don't compare across skipped frames.
                    prev_hash = None
                    prev_edges = None
                    continue

                small = frame.reformat(width=320, height=180, format="gray")
                arr = small.to_ndarray()
                curr_hash = dhash(arr)

                if prev_hash is not None:
                    dist = hamming_distance(curr_hash, prev_hash)

                    if dist >= dhash_hi:
                        # High-confidence cut — dHash alone is decisive.
                        cut_timestamps.append(ts)
                        prev_edges = None

                    elif dist >= dhash_lo:
                        # Ambiguous zone — verify with Canny.
                        edges = cv2.Canny(arr, 50, 100)
                        if np.count_nonzero(edges) > 0:
                            pooled = pooling(edges)
                            if prev_edges is not None:
                                dissim = abs(1.0 - cosine_similarity(pooled, prev_edges))
                                if dissim > _ANIME_CANNY_DISSIMILARITY:
                                    cut_timestamps.append(ts)
                            prev_edges = pooled
                        else:
                            prev_edges = None

                    else:
                        prev_edges = None

                prev_hash = curr_hash

            container.close()

        except Exception:
            # Never let a single interval failure abort the whole scan.
            pass

    return sorted(cut_timestamps)


# ---------------------------------------------------------------------------
# Music video detection  (dHash only, sampled)
# ---------------------------------------------------------------------------

# Target sample rate for music-video scanning (frames per second analysed).
# 8 fps is enough to catch hard cuts without decoding every frame.
_MV_SAMPLES_PER_SECOND = 8


def detect_music_video(
    video_path: str,
    sensitivity: float = 15.0,
    progress_cb: Callable[[int, str], None] | None = None,
) -> list[float]:
    """Return cut-point timestamps for music video footage.

    Uses dHash only — no Canny verification.  Music videos have obvious,
    hard cuts; the extra verification step adds overhead without benefit.

    sensitivity: 10 (many cuts) → 40 (few cuts).
    """
    dhash_threshold = max(3, int(sensitivity * 0.5))

    cut_timestamps: list[float] = []

    try:
        container = av.open(video_path)
        stream = container.streams.video[0]
        fps = float(stream.average_rate or 24)

        # Skip frames so we decode roughly _MV_SAMPLES_PER_SECOND per second.
        sample_every = max(1, int(math.ceil(fps / _MV_SAMPLES_PER_SECOND)))

        prev_hash: np.ndarray | None = None
        frame_count = 0

        duration_s: float | None = None
        try:
            if container.duration is not None:
                duration_s = float(container.duration) / 1_000_000.0
        except Exception:
            pass

        for frame in container.decode(stream):
            if frame.time is None:
                continue

            frame_count += 1
            if frame_count % sample_every != 0:
                continue

            if progress_cb and duration_s and frame_count % (sample_every * 30) == 0:
                ts = float(frame.time)
                pct = 20 + int(55 * min(1.0, ts / duration_s))
                progress_cb(pct, f"Music video scan: {ts:.0f}s / {duration_s:.0f}s")

            small = frame.reformat(width=160, height=90, format="gray")
            arr = small.to_ndarray()
            curr_hash = dhash(arr)

            if prev_hash is not None:
                if hamming_distance(curr_hash, prev_hash) >= dhash_threshold:
                    cut_timestamps.append(float(frame.time))

            prev_hash = curr_hash

        container.close()

    except Exception:
        pass

    return sorted(cut_timestamps)
