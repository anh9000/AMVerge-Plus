import { useState } from "react";
import { DetectionSettings, DetectionMode, MODE_SENSITIVITY_DEFAULTS } from "../utils/episodeUtils";

interface DetectionSettingsProps {
  settings: DetectionSettings;
  onChange: (s: DetectionSettings) => void;
  disabled?: boolean;
}

const MODES: { value: DetectionMode; label: string; hint: string }[] = [
  { value: "keyframe",    label: "Keyframe",    hint: "Fast — cuts at I-frames only" },
  { value: "anime",       label: "Anime",       hint: "dHash + Canny edge analysis" },
  { value: "live-action", label: "Live-action", hint: "HSV histogram (PySceneDetect)" },
  { value: "music-video", label: "Music Video", hint: "dHash fast scan, high sensitivity" },
];

export default function DetectionSettingsPanel({
  settings,
  onChange,
  disabled = false,
}: DetectionSettingsProps) {
  const [open, setOpen] = useState(false);

  const isKeyframe = settings.mode === "keyframe";

  function handleModeChange(mode: DetectionMode) {
    onChange({
      ...settings,
      mode,
      // Reset sensitivity to the mode's default when switching.
      sensitivity: MODE_SENSITIVITY_DEFAULTS[mode],
      // Snap off by default for music-video (MVs re-encode with many keyframes).
      snapKeyframes: mode === "music-video" ? false : true,
    });
  }

  return (
    <div className="ds-wrap">
      <button
        className={`ds-toggle-btn${open ? " active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="Detection settings"
        aria-expanded={open}
        disabled={disabled}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 4.754a3.246 3.246 0 1 0 0 6.492 3.246 3.246 0 0 0 0-6.492zM5.754 8a2.246 2.246 0 1 1 4.492 0 2.246 2.246 0 0 1-4.492 0z"/>
          <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 0 0 2.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 0 0 1.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 0 0-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 0 0-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 0 0-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 0 0 1.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 0 0 3.06 4.47l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 0 0 2.692-1.115l.094-.319z"/>
        </svg>
      </button>

      {open && (
        <div className="ds-panel">

          {/* Mode selector */}
          <div className="ds-row">
            <span className="ds-label">Detection mode</span>
            <select
              className="ds-select"
              value={settings.mode}
              onChange={(e) => handleModeChange(e.target.value as DetectionMode)}
              disabled={disabled}
            >
              {MODES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Mode hint */}
          <div className="ds-hint-row">
            {MODES.find(m => m.value === settings.mode)?.hint}
          </div>

          {/* Min clip duration — always visible */}
          <div className="ds-row">
            <span className="ds-label">
              Min clip duration
              <span className="ds-hint">merge cuts creating shorter clips</span>
            </span>
            <div className="ds-slider-wrap">
              <input
                type="range"
                min={0.5}
                max={5.0}
                step={0.1}
                value={settings.minDuration}
                onChange={(e) =>
                  onChange({ ...settings, minDuration: parseFloat(e.target.value) })
                }
                disabled={disabled}
              />
              <span className="ds-value">{settings.minDuration.toFixed(1)}s</span>
            </div>
          </div>

          {/* Sensitivity — hidden for keyframe mode */}
          {!isKeyframe && (
            <div className="ds-row">
              <span className="ds-label">
                Sensitivity
                <span className="ds-hint">lower = more cuts</span>
              </span>
              <div className="ds-slider-wrap">
                <input
                  type="range"
                  min={10}
                  max={40}
                  step={0.5}
                  value={settings.sensitivity}
                  onChange={(e) =>
                    onChange({ ...settings, sensitivity: parseFloat(e.target.value) })
                  }
                  disabled={disabled}
                />
                <span className="ds-value">{settings.sensitivity.toFixed(1)}</span>
              </div>
            </div>
          )}

          {/* Snap to keyframes — hidden for keyframe mode */}
          {!isKeyframe && (
            <div className="ds-row ds-row-toggle">
              <span className="ds-label">
                Snap to keyframes
                <span className="ds-hint">ensures clean I-frame cuts</span>
              </span>
              <button
                className={`ds-toggle${settings.snapKeyframes ? " active" : ""}`}
                onClick={() =>
                  onChange({ ...settings, snapKeyframes: !settings.snapKeyframes })
                }
                disabled={disabled}
              >
                {settings.snapKeyframes ? "On" : "Off"}
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
