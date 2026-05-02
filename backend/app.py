import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import av
from PIL import Image

from utils.video_utils import (
    generate_keyframes,
    emit_progress,
    get_binary,
    merge_short_scenes,
    snap_to_keyframes,
    get_audio_info,
    audio_needs_transcode,
)

# Running commands like ffmpeg can open a command window on Windows.
# This prevents that when the backend is launched from the app.
CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0

# sys.frozen is an attribute added by PyInstaller when running as an executable.
IS_EXECUTABLE = getattr(sys, "frozen", False)

if IS_EXECUTABLE:
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(__file__)

FFMPEG = get_binary("ffmpeg")
FFPROBE = get_binary("ffprobe")


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

def get_log_dir() -> str:
    """Return a writable log directory for the current platform."""
    if sys.platform == "win32":
        base = (
            os.getenv("LOCALAPPDATA")
            or os.getenv("APPDATA")
            or tempfile.gettempdir()
        )
    elif sys.platform == "darwin":
        base = os.path.expanduser("~/Library/Application Support")
    else:
        # Linux / other Unix — honour XDG spec.
        base = os.getenv("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")

    return os.path.join(base, "AMVerge")


def ensure_log_dir() -> str:
    log_dir = get_log_dir()
    try:
        os.makedirs(log_dir, exist_ok=True)
        return log_dir
    except Exception:
        return tempfile.gettempdir()


DEBUG_LOG_DIR = ensure_log_dir()
DEBUG_LOG = os.path.join(DEBUG_LOG_DIR, "backend_debug.txt")


def log(message: str) -> None:
    try:
        with open(DEBUG_LOG, "a", encoding="utf-8") as file:
            file.write(message + "\n")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def format_timestamp(seconds: float) -> str:
    # Keep 6-decimal precision, but trim redundant trailing zeros.
    value = f"{float(seconds):.6f}"
    return value.rstrip("0").rstrip(".")


# ---------------------------------------------------------------------------
# Thumbnails
# ---------------------------------------------------------------------------

def make_thumbnail(clip_path: str, thumb_path: str) -> None:
    thumb_width = 360
    thumb_quality = 80

    try:
        with av.open(clip_path) as container:
            if not container.streams.video:
                log(f"Thumbnail skipped, no video stream: {clip_path}")
                return

            stream = container.streams.video[0]
            stream.codec_context.skip_frame = "NONKEY"

            for frame in container.decode(stream):
                image = frame.to_image()

                new_width = thumb_width
                new_height = max(1, int(new_width * image.height / image.width))

                image = image.resize(
                    (new_width, new_height),
                    resample=Image.Resampling.BICUBIC,
                )

                image.save(thumb_path, "JPEG", quality=thumb_quality)
                return

            log(f"Thumbnail skipped, no decodable frame: {clip_path}")

    except Exception as error:
        log(f"Thumbnail failed for {clip_path}: {error}")


def generate_thumbnails(output_dir: str, scenes: list[dict[str, Any]], file_name: str) -> None:
    total = len(scenes)
    if total == 0:
        return

    progress_step = max(1, total // 25)
    completed = 0

    def build_thumbnail(scene: dict[str, Any]) -> None:
        scene_index = scene["scene_index"]
        clip_path = os.path.join(output_dir, f"{file_name}_{scene_index:04d}.mp4")
        thumb_path = os.path.join(output_dir, f"{file_name}_{scene_index:04d}.jpg")

        if not os.path.exists(clip_path):
            log(f"Thumbnail skipped, clip missing: {clip_path}")
            return

        make_thumbnail(clip_path, thumb_path)

    emit_progress(90, f"Generating thumbnails... 0/{total}")

    max_workers = min(4, os.cpu_count() or 4)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(build_thumbnail, scene) for scene in scenes]

        for future in as_completed(futures):
            completed += 1

            try:
                future.result()
            except Exception as error:
                log(f"Thumbnail worker failed: {error}")

            if completed % progress_step == 0 or completed == total:
                emit_progress(90, f"Generating thumbnails... {completed}/{total}")


# ---------------------------------------------------------------------------
# FFmpeg segmenting
# ---------------------------------------------------------------------------

def run_ffmpeg_segment(
    video_path: str,
    output_pattern: str,
    cut_points: list[float],
    audio_streams: list[dict] | None = None,
) -> None:
    """Segment the video at cut_points using stream copy.

    Probes audio codecs and transcodes to AAC 192k if the source codec is
    incompatible with MP4 (FLAC, DTS, TrueHD, etc.).  Video is always
    stream-copied — no re-encoding.
    """
    needs_transcode = audio_needs_transcode(audio_streams or [])

    cmd = [
        FFMPEG,
        "-y",
        "-i", video_path,
        # Explicit stream mapping — always take the first video track and
        # ALL audio tracks so dual-audio MKVs are preserved.
        "-map", "0:v:0",
    ]

    if audio_streams:
        cmd += ["-map", "0:a"]

    cmd += ["-c:v", "copy"]

    if audio_streams:
        if needs_transcode:
            log(f"Audio transcode required: incompatible codec detected → AAC 192k")
            cmd += ["-c:a", "aac", "-b:a", "192k"]
        else:
            cmd += ["-c:a", "copy"]

    cmd += [
        "-f", "segment",
        "-segment_times", ",".join(format_timestamp(point) for point in cut_points),
        "-reset_timestamps", "1",
        output_pattern,
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        creationflags=CREATE_NO_WINDOW,
    )

    log(result.stdout)
    log(result.stderr)

    if result.returncode != 0:
        tail = result.stderr[-2000:] if result.stderr else "No stderr output."
        raise RuntimeError(f"ffmpeg failed with code {result.returncode}: {tail}")


def collect_scenes(
    output_dir: str,
    file_name: str,
    cut_points: list[float],
) -> list[dict[str, Any]]:
    final_scenes: list[dict[str, Any]] = []
    boundaries = [0.0] + cut_points

    for index, start in enumerate(boundaries):
        end = boundaries[index + 1] if index + 1 < len(boundaries) else None

        out_path = os.path.join(output_dir, f"{file_name}_{index:04d}.mp4")
        thumb_path = os.path.join(output_dir, f"{file_name}_{index:04d}.jpg")

        if os.path.exists(out_path) and os.path.getsize(out_path) > 0:
            final_scenes.append(
                {
                    "scene_index": index,
                    "start": start,
                    "end": end,
                    "path": out_path,
                    "thumbnail": thumb_path,
                    "original_file": file_name,
                }
            )

    return final_scenes


def run_split_pipeline(
    video_path: str,
    output_dir: str,
    cut_points: list[float],
    audio_streams: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Segment video at cut_points then generate thumbnails. Shared by all modes."""
    total_start = time.perf_counter()
    file_name = os.path.splitext(os.path.basename(video_path))[0]

    emit_progress(50, f"Cutting {len(cut_points)} scenes...")
    output_pattern = os.path.join(output_dir, f"{file_name}_%04d.mp4")
    run_ffmpeg_segment(video_path, output_pattern, cut_points, audio_streams)

    emit_progress(75, "Building scenes...")
    final_scenes = collect_scenes(
        output_dir=output_dir,
        file_name=file_name,
        cut_points=cut_points,
    )

    emit_progress(90, "Generating thumbnails...")
    thumb_start = time.perf_counter()
    log(f"TIMING|thumbs_start|scenes={len(final_scenes)}")

    generate_thumbnails(output_dir, final_scenes, file_name)

    thumb_end = time.perf_counter()
    log(f"TIMING|thumbs_end|seconds={thumb_end - thumb_start:.3f}")

    emit_progress(100, "Done")

    total_end = time.perf_counter()
    log(f"TIMING|total_end_to_end|seconds={total_end - total_start:.3f}")

    return final_scenes


# ---------------------------------------------------------------------------
# Detection modes
# ---------------------------------------------------------------------------

def trim_scenes_at_keyframes(
    video_path: str,
    output_dir: str,
    min_duration: float = 1.5,
    audio_streams: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Fast mode — cut only at existing I-frames."""
    os.makedirs(output_dir, exist_ok=True)

    total_start = time.perf_counter()

    emit_progress(10, "Extracting keyframes...")

    keyframes = generate_keyframes(
        video_path=video_path,
        progress_cb=emit_progress,
        progress_base=10,
        progress_range=30,
        progress_interval_s=1.0,
    )

    log(f"Keyframes found: {len(keyframes)}")
    log(f"First few keyframes: {keyframes[:5]}")

    if not keyframes:
        log("No keyframes found. Returning empty scene list.")
        return []

    cut_points = sorted(keyframes[1:])
    cut_points = merge_short_scenes([0.0] + cut_points, min_duration=min_duration)[1:]

    log(f"TIMING|keyframes_done|seconds={time.perf_counter() - total_start:.3f}")

    return run_split_pipeline(video_path, output_dir, cut_points, audio_streams)


def trim_scenes_content_aware(
    video_path: str,
    output_dir: str,
    min_duration: float = 1.5,
    sensitivity: float = 27.0,
    snap_keyframes_flag: bool = True,
    audio_streams: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Live-action mode — PySceneDetect ContentDetector (HSV histograms)."""
    os.makedirs(output_dir, exist_ok=True)

    emit_progress(10, "Starting content analysis...")

    try:
        from scenedetect import open_video, SceneManager
        from scenedetect.detectors import ContentDetector
    except ImportError as e:
        log(f"PySceneDetect not available: {e}")
        return []

    emit_progress(15, "Opening video for analysis...")
    video = open_video(video_path)
    fps = video.frame_rate

    if fps is None or fps <= 0:
        log("Could not determine video FPS for content detection")
        return []

    min_scene_len = max(1, int(min_duration * fps))
    log(f"Content-aware: fps={fps:.2f} min_scene_len={min_scene_len} threshold={sensitivity}")

    scene_manager = SceneManager()
    scene_manager.add_detector(ContentDetector(threshold=sensitivity, min_scene_len=min_scene_len))

    emit_progress(20, "Analyzing scene changes...")
    scene_manager.detect_scenes(video=video, show_progress=False)

    scene_list = scene_manager.get_scene_list()
    log(f"Content-aware: {len(scene_list)} scenes detected")

    cut_points = [
        start.get_seconds()
        for i, (start, _) in enumerate(scene_list)
        if i > 0
    ]

    if snap_keyframes_flag and cut_points:
        emit_progress(45, "Snapping cuts to keyframes...")
        keyframes = generate_keyframes(video_path=video_path)
        cut_points = snap_to_keyframes(cut_points, keyframes)
        log(f"After snap: {len(cut_points)} cut points")

    if not cut_points:
        log("No scene cuts detected — video treated as single scene")

    cut_points = merge_short_scenes([0.0] + cut_points, min_duration=min_duration)[1:]

    return run_split_pipeline(video_path, output_dir, cut_points, audio_streams)


def trim_scenes_anime(
    video_path: str,
    output_dir: str,
    min_duration: float = 1.5,
    sensitivity: float = 20.0,
    snap_keyframes_flag: bool = True,
    audio_streams: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Anime mode — dHash fast pass + Canny edge cosine verification.

    Extracts keyframes first, then only scans intervals that are suspiciously
    long (encoder likely missed a cut).  Snaps cuts to nearest keyframe by
    default for clean stream-copy segments.
    """
    os.makedirs(output_dir, exist_ok=True)

    from utils.content_algorithms import detect_anime

    emit_progress(10, "Extracting keyframes...")
    keyframes = generate_keyframes(
        video_path=video_path,
        progress_cb=emit_progress,
        progress_base=10,
        progress_range=10,
        progress_interval_s=1.0,
    )

    log(f"Keyframes found: {len(keyframes)}")

    if not keyframes:
        log("No keyframes — falling back to keyframe mode")
        return trim_scenes_at_keyframes(video_path, output_dir, min_duration, audio_streams)

    emit_progress(20, "Running anime scene analysis...")
    extra_cuts = detect_anime(
        video_path=video_path,
        keyframes=keyframes,
        sensitivity=sensitivity,
        progress_cb=emit_progress,
    )

    log(f"Anime detector extra cuts: {len(extra_cuts)}")

    # Merge keyframe cuts + extra content-detected cuts.
    all_cuts = sorted(set(keyframes[1:]) | set(extra_cuts))

    if snap_keyframes_flag and extra_cuts:
        emit_progress(72, "Snapping extra cuts to keyframes...")
        all_cuts = snap_to_keyframes(all_cuts, keyframes)

    all_cuts = merge_short_scenes([0.0] + all_cuts, min_duration=min_duration)[1:]

    log(f"Final cut points: {len(all_cuts)}")

    return run_split_pipeline(video_path, output_dir, all_cuts, audio_streams)


def trim_scenes_music_video(
    video_path: str,
    output_dir: str,
    min_duration: float = 0.5,
    sensitivity: float = 15.0,
    snap_keyframes_flag: bool = False,
    audio_streams: list[dict] | None = None,
) -> list[dict[str, Any]]:
    """Music video mode — dHash only, fast sampled scan."""
    os.makedirs(output_dir, exist_ok=True)

    from utils.content_algorithms import detect_music_video

    emit_progress(10, "Starting music video scan...")
    cut_points = detect_music_video(
        video_path=video_path,
        sensitivity=sensitivity,
        progress_cb=emit_progress,
    )

    log(f"Music video cuts: {len(cut_points)}")

    if snap_keyframes_flag and cut_points:
        emit_progress(76, "Snapping cuts to keyframes...")
        keyframes = generate_keyframes(video_path=video_path)
        cut_points = snap_to_keyframes(cut_points, keyframes)

    if not cut_points:
        log("No cuts detected")

    cut_points = merge_short_scenes([0.0] + cut_points, min_duration=min_duration)[1:]

    return run_split_pipeline(video_path, output_dir, cut_points, audio_streams)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(description="AMVerge Plus scene detector")
    parser.add_argument("input_file", help="Path to input video")
    parser.add_argument("output_dir", help="Directory for output clips")
    parser.add_argument(
        "--mode",
        default="keyframe",
        choices=["keyframe", "live-action", "anime", "music-video"],
        help=(
            "Detection mode: "
            "keyframe (fast, default), "
            "live-action (PySceneDetect HSV), "
            "anime (dHash + Canny), "
            "music-video (dHash fast scan)"
        ),
    )
    parser.add_argument(
        "--min-duration",
        dest="min_duration",
        type=float,
        default=1.5,
        help="Minimum clip duration in seconds (default: 1.5)",
    )
    parser.add_argument(
        "--sensitivity",
        type=float,
        default=27.0,
        help="Detection threshold — lower = more cuts (default: 27.0)",
    )
    parser.add_argument(
        "--snap-keyframes",
        dest="snap_keyframes",
        action="store_true",
        default=True,
        help="Snap content-detected cuts to nearest I-frame (default: on)",
    )
    parser.add_argument(
        "--no-snap-keyframes",
        dest="snap_keyframes",
        action="store_false",
        help="Disable keyframe snapping",
    )

    try:
        args = parser.parse_args()
    except SystemExit:
        print(json.dumps([]))
        sys.stdout.flush()
        return 1

    try:
        # Probe audio tracks once, shared by all modes.
        emit_progress(5, "Probing audio tracks...")
        audio_streams = get_audio_info(args.input_file)
        log(f"Audio streams: {len(audio_streams)}")
        for s in audio_streams:
            log(f"  codec={s.get('codec_name')} channels={s.get('channels')} index={s.get('index')}")

        mode = args.mode

        if mode == "keyframe":
            scenes = trim_scenes_at_keyframes(
                args.input_file,
                args.output_dir,
                min_duration=args.min_duration,
                audio_streams=audio_streams,
            )

        elif mode == "live-action":
            scenes = trim_scenes_content_aware(
                args.input_file,
                args.output_dir,
                min_duration=args.min_duration,
                sensitivity=args.sensitivity,
                snap_keyframes_flag=args.snap_keyframes,
                audio_streams=audio_streams,
            )

        elif mode == "anime":
            scenes = trim_scenes_anime(
                args.input_file,
                args.output_dir,
                min_duration=args.min_duration,
                sensitivity=args.sensitivity,
                snap_keyframes_flag=args.snap_keyframes,
                audio_streams=audio_streams,
            )

        elif mode == "music-video":
            scenes = trim_scenes_music_video(
                args.input_file,
                args.output_dir,
                min_duration=args.min_duration,
                sensitivity=args.sensitivity,
                snap_keyframes_flag=args.snap_keyframes,
                audio_streams=audio_streams,
            )

        else:
            log(f"Unknown mode: {mode}")
            print(json.dumps([]))
            sys.stdout.flush()
            return 1

        # stdout is reserved for the final JSON response.
        # Rust reads this, then React parses it.
        print(json.dumps(scenes))
        sys.stdout.flush()

        return 0

    except Exception as error:
        import traceback

        log(f"FATAL ERROR: {error}")
        log(traceback.format_exc())

        print(json.dumps([]))
        print(f"debug_log_dir: {DEBUG_LOG_DIR}", file=sys.stderr)
        sys.stdout.flush()

        return 1


if __name__ == "__main__":
    raise SystemExit(main())
