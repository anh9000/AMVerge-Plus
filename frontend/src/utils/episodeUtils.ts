import { invoke } from "@tauri-apps/api/core";

// [AMVerge Plus] detection settings type + defaults
export type DetectionMode = "keyframe" | "live-action" | "anime" | "music-video";

export interface DetectionSettings {
  mode: DetectionMode;
  minDuration: number;
  sensitivity: number;
  snapKeyframes: boolean;
}

export const DEFAULT_DETECTION_SETTINGS: DetectionSettings = {
  mode: "keyframe",
  minDuration: 1.5,
  sensitivity: 27.0,
  snapKeyframes: true,
};

// Sensible sensitivity defaults per mode
export const MODE_SENSITIVITY_DEFAULTS: Record<DetectionMode, number> = {
  "keyframe": 27.0,
  "live-action": 27.0,
  "anime": 20.0,
  "music-video": 15.0,
};

export const truncateFileName = (name: string): string => {
    if (name.length <= 23) return name;
    return name.slice(0, 10) + "..." + name.slice(-10);
};

export const detectScenes = async (
  videoPath: string,
  episodeCacheId: string,
  settings?: DetectionSettings,
) => {
    const s = settings ?? DEFAULT_DETECTION_SETTINGS;

    const result = await invoke<string>("detect_scenes", {
      videoPath,
      episodeCacheId,
      detectionMode: s.mode,
      minDuration: s.minDuration,
      sensitivity: s.sensitivity,
      snapKeyframes: s.snapKeyframes,
    });

    const scenes = JSON.parse(result);

    return scenes.map((s: any) => ({
      id: crypto.randomUUID(),
      src: s.path,
      thumbnail: s.thumbnail,
      originalName: s.original_file
    }));
};

export function fileNameFromPath(path: string): string {
  const last = path.split(/[/\\]/).pop();
  return last || path;
}
