import subprocess
import json
import os
def preprocess_video(input_path, output_path):
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        "-vf", "scale=480:-1",
        output_path
    ]
    subprocess.run(
        cmd,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=True
    )

def generate_keyframes(video_path: str):
    """Generates keyframe for a given video"""
    cmd = [
        "ffprobe",                      # Launches the ffprobe executable
        "-skip_frame", "nokey",         # ONLY look at keyframes, skip others (speed)
        "-select_streams", "v:0",       # Only looks at the first video stream
        "-show_frames",                 # Shows metadata for EVERY frame
        "-show_entries", "frame=best_effort_timestamp_time",  # Filter, we only get the frame of the data
        "-of", "json",                  # Export as json format
        video_path
    ]
    # Executing system command
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,  # Return strings instead of bytes
        check=True  # Crash if the command fails
    )

    data = json.loads(result.stdout)
    
    return [
        float(frame["best_effort_timestamp_time"])
        for frame in data.get("frames", [])
        if "best_effort_timestamp_time" in frame
    ]

def keyframe_windows(keyframes, radius=1.0):
    """Generates keyframe windows for """
    windows = [(max(0, key - radius), key + radius) for key in keyframes]

    windows.sort()
    merged = [windows[0]]  
    
    # Ensures that none of the windows overlap each other
    for start, end in windows[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end)) # Replace appended start with the last end
        else:
            merged.append((start, end))
    
    return merged

def trim_keyframes(video_path: str, output_dir="./keyframe_clips", radius=1.0):
    os.makedirs(output_dir, exist_ok=True)

    # generating keyframes
    keyframes = generate_keyframes(video_path)
    if not keyframes:
        return []

    # generating keyframe windows
    windows = keyframe_windows(keyframes, radius)
    clips = []
    
    # going through each keyframe window to trim the video
    for i, (start, end) in enumerate(windows):
        out_path = os.path.join(output_dir, f"kf_clip_{i:04d}.mp4")

        cmd = [
            "ffmpeg",
            "-y",
            "-ss", str(start),  # trim from start of keyframe
            "-to", str(end),    # trim until end of keyframe 
            "-i", video_path,
            "-c", "copy",
            out_path
        ]

        subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )

        clips.append(
            {
                "clip_path": out_path,
                "window_start": start,
                "window_end": end
            }
        )
    return clips

def merge_short_scenes(boundaries, min_duration=0.5):
    """
    Merges scene boundaries if the resulting segment
    would be shorter than min_duration seconds.
    """

    if len(boundaries) <= 2:
        return boundaries

    merged = [boundaries[0]]

    for t in boundaries[1:]:
        if t - merged[-1] < min_duration:
            # Skip this boundary (merge small segment)
            continue
        merged.append(t)

    return merged

def emit_progress(percent: int, message: str):
    import sys
    percent = max(0, min(100, int(percent)))
    print(f"PROGRESS|{percent}|{message}", file=sys.stderr, flush=True)