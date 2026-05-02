from __future__ import annotations

import json
import subprocess
import sys

from .binaries import get_binary
from .keyframes import generate_keyframes
from .progress import emit_progress


CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0


def merge_short_scenes(boundaries: list[float], min_duration: float = 0.5) -> list[float]:
    """Merge scene boundaries that would create tiny segments."""

    if len(boundaries) <= 2:
        return boundaries

    merged = [boundaries[0]]

    for timestamp in boundaries[1:]:
        if timestamp - merged[-1] < min_duration:
            continue
        merged.append(timestamp)

    return merged


def snap_to_keyframes(cut_points: list[float], keyframes: list[float]) -> list[float]:
    """Snap each cut point to the nearest keyframe.

    Guarantees that every cut lands on an I-frame so FFmpeg stream copy
    always produces clean segments.  Deduplicates and re-sorts the result.
    """
    if not keyframes or not cut_points:
        return cut_points

    snapped = [min(keyframes, key=lambda kf: abs(kf - cut)) for cut in cut_points]
    return sorted(set(snapped))


def get_audio_info(video_path: str) -> list[dict]:
    """Return a list of audio stream dicts from FFprobe.

    Each dict has at least a ``codec_name`` key.  Returns an empty list if
    FFprobe is unavailable or the file has no audio streams.
    """
    ffprobe = get_binary("ffprobe")
    cmd = [
        ffprobe,
        "-v", "quiet",
        "-print_format", "json",
        "-show_streams",
        "-select_streams", "a",
        video_path,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            creationflags=CREATE_NO_WINDOW,
        )
        if result.returncode != 0:
            return []
        data = json.loads(result.stdout)
        return data.get("streams", [])
    except Exception:
        return []


def audio_needs_transcode(audio_streams: list[dict]) -> bool:
    """Return True if any audio stream uses a codec incompatible with MP4."""
    incompatible = {
        "flac", "dts", "truehd", "mlp",
        "opus", "vorbis",
        "pcm_s16le", "pcm_s24le", "pcm_s32le",
        "pcm_f32le", "pcm_f64le",
    }
    return any(
        s.get("codec_name", "").lower() in incompatible
        for s in audio_streams
    )


__all__ = [
    "generate_keyframes",
    "emit_progress",
    "get_binary",
    "merge_short_scenes",
    "snap_to_keyframes",
    "get_audio_info",
    "audio_needs_transcode",
]
