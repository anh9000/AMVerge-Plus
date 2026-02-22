import numpy as np
import subprocess
import math
import os
import cv2
import av
import sys
import json
from utils import generate_keyframes, keyframe_windows, merge_short_scenes, emit_progress
#-----------------------------
#   SCENEDETECT ALGORITHM
#-----------------------------
def magnitude(vec):
    vec = math.sqrt(
        np.sum(vec**2) 
    )
    return vec

def pooling(frame, dim):
    arr = np.array(frame)

    # dividing then multiplying by dim to ensure it's divisible 
    h = (arr.shape[0] // dim) * dim
    w = (arr.shape[1] // dim) * dim
    arr = arr[:h, :w] # cropping so its perfectly divisible by dim

    # (# of blocks vertically, 'dim' rows per block, # of blocks horizontally, 'dim' rows per block)
    arr = arr.reshape(h // dim, dim, w // dim, dim)

    # print(f"Arr: {arr}")
    pooled = arr.mean(axis=(1, 3))

    return pooled

def cosine_similarity(frame1, frame2):
    a = np.array(frame1).flatten().astype(np.float32)
    b = np.array(frame2).flatten().astype(np.float32)
    
    numerator = np.dot(a, b)
    denominator = magnitude(a) * magnitude(b)

    cosine = numerator / denominator

    return cosine

def read_frames(
    video_path: str,
    start_sec: float,
    end_sec: float,
    threshold: float,
    blocksize: int = 3,
):
    """
    Runs cosine-based scene detection inside a specific time window
    using PyAV for decoding.

    Returns absolute timestamps (seconds).
    """

    container = av.open(video_path)
    stream = container.streams.video[0]

    # Seek to approximate position (PyAV seeks by microseconds)
    container.seek(int(start_sec * 1_000_000), any_frame=False, backward=True)

    prev = None
    cut_timestamps = []

    for frame in container.decode(stream):

        # frame.time is already in secs
        if frame.time is None:
            continue

        timestamp_sec = float(frame.time)

        # Skip frames before window (seek may land slightly earlier)
        if timestamp_sec < start_sec:
            continue

        # Stop once outside window
        if timestamp_sec > end_sec:
            break

        # Convert to grayscale numpy array
        img = frame.to_ndarray(format="gray")

        # Edge detection
        edges = cv2.Canny(img, 50, 100)

        if np.count_nonzero(edges) == 0:
            continue

        pooled = pooling(edges, blocksize)

        if prev is not None:
            dissimilarity = abs(1 - cosine_similarity(pooled, prev))

            if dissimilarity > threshold:
                cut_timestamps.append(timestamp_sec)

        prev = pooled

    container.close()

    return cut_timestamps

#-----------------------------
#     VIDEO PROCESSING
#-----------------------------

def detect_and_trim_scenes(
        original_video_path: str,
        threshold: float,
        radius: float = 0.3,
        output_dir: str = "./output_test",
        blocksize: int = 3
):
    os.makedirs(output_dir, exist_ok=True)

    emit_progress(10, "Capturing key areas..")
    keyframes = generate_keyframes(original_video_path)
    if not keyframes:
        return []
    windows = keyframe_windows(keyframes, radius)
    
    all_cut_timestamps = []

    emit_progress(30, "Scanning for scene cuts...")
    total_windows = max(1, len(windows))

    for i, (start, end) in enumerate(windows):
        percent = 30 + int(40 * (i / total_windows))
        emit_progress(percent, f"Scanning window {i+1}/{total_windows}")

        window_cuts = read_frames(
            original_video_path,
            start,
            end,
            threshold,
            blocksize
        )

        all_cut_timestamps.extend(window_cuts)

    all_cut_timestamps = sorted(set(all_cut_timestamps))

    duration_cmd = [
        "ffprobe", "-i", original_video_path,
        "-show_entries", "format=duration",
        "-v", "quiet",
        "-of", "csv=p=0"
    ]

    emit_progress(70, "Finalizing scene boundaries")
    result = subprocess.run(duration_cmd, stdout=subprocess.PIPE, text=True)
    duration = float(result.stdout.strip())

    scene_boundaries = [0.0] + all_cut_timestamps + [duration]
    scene_boundaries = sorted(set(scene_boundaries))

    scene_boundaries = merge_short_scenes(scene_boundaries, min_duration=0.5)

    final_scenes = []
    scene_idx = 0

    emit_progress(80, "Cutting scenes..")
    total_scenes = max(1, len(scene_boundaries) - 1)
    for i in range(total_scenes):
        percent = 80 + int(20 * (i / total_scenes))
        emit_progress(percent, f"Exporting clip {i+1}/{total_scenes}")

        start = scene_boundaries[i]
        end = scene_boundaries[i + 1]

        if start >= end:
            continue

        out_path = os.path.join(output_dir, f"scene_{scene_idx:04d}.mp4")

        cmd = [
            "ffmpeg", "-y",
            "-ss", str(start),
            "-to", str(end),
            "-i", original_video_path,
            "-c", "copy",
            out_path
        ]

        subprocess.run(cmd,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        check=True)

        final_scenes.append({
            "scene_index": scene_idx,
            "start": start,
            "end": end,
            "path": out_path
        })

        scene_idx += 1
    emit_progress(100, "Done")
    return final_scenes

if __name__ == "__main__":
    input_file = sys.argv[1]
    threshold = float(sys.argv[2])
    blocksize = int(sys.argv[3])
    output_dir = sys.argv[4]
    scenes = detect_and_trim_scenes(
        original_video_path=input_file,
        threshold=threshold,
        blocksize=blocksize,
        output_dir=output_dir
    )

    print("About to print JSON", file=sys.stderr)
    print(json.dumps(scenes)) # sends to stdout for rust to collect, react parses it