import { useEffect, useId, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  applyThemeSettings,
  loadThemeSettings,
  saveThemeSettings,
  type ThemeSettings,
} from "../../theme";

const ENCODER_STORAGE_KEY = "amverge_encoder_v1";

interface EncoderInfo {
  name: string;
  label: string;
  available: boolean;
}

async function fileToDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function GpuSection() {
  const [encoders, setEncoders] = useState<EncoderInfo[]>([]);
  const [probing, setProbing] = useState(false);
  const [probed, setProbed] = useState(false);
  const [selected, setSelected] = useState<string>(() =>
    localStorage.getItem(ENCODER_STORAGE_KEY) || "libx264"
  );

  const handleSelect = (name: string) => {
    setSelected(name);
    localStorage.setItem(ENCODER_STORAGE_KEY, name);
  };

  const probe = async () => {
    setProbing(true);
    try {
      const result = await invoke<EncoderInfo[]>("probe_hardware_encoders");
      setEncoders(result);
      setProbed(true);
      const available = result.filter((e) => e.available);
      if (available.length > 0 && selected === "libx264") {
        handleSelect(available[0].name);
      }
    } catch (err) {
      console.error("Probe failed:", err);
    } finally {
      setProbing(false);
    }
  };

  const available = encoders.filter((e) => e.available);

  return (
    <div className="gpu-section">
      <h3 className="gpu-title">GPU Acceleration</h3>
      <p className="gpu-desc">
        Hardware encoders speed up export re-encoding. The scene-cutting step always uses stream
        copy and is not affected. GPU is only used when re-encoding (export without Remux checked).
      </p>

      <div className="gpu-encoders">
        <div
          className={`gpu-option${selected === "libx264" ? " active" : ""}`}
          onClick={() => handleSelect("libx264")}
        >
          <span className="gpu-dot" />
          <div>
            <div className="gpu-name">CPU — libx264</div>
            <div className="gpu-sublabel">Software encoder, always available</div>
          </div>
        </div>

        {available.map((enc) => (
          <div
            key={enc.name}
            className={`gpu-option${selected === enc.name ? " active" : ""}`}
            onClick={() => handleSelect(enc.name)}
          >
            <span className="gpu-dot" />
            <div>
              <div className="gpu-name">{enc.label}</div>
              <div className="gpu-sublabel">{enc.name}</div>
            </div>
          </div>
        ))}

        {probed && available.length === 0 && (
          <div className="gpu-none">No hardware encoders found on this machine.</div>
        )}
      </div>

      <button className="gpu-probe-btn" onClick={probe} disabled={probing}>
        {probing ? "Detecting..." : probed ? "Re-detect" : "Detect hardware encoders"}
      </button>

      {!probed && (
        <p className="gpu-note">
          Click detect to scan for NVIDIA NVENC, AMD AMF, and Intel Quick Sync.
        </p>
      )}
    </div>
  );
}

export default function SettingsSection() {
  const accentId = useId();
  const bgGradientId = useId();
  const bgId = useId();

  const [settings, setSettings] = useState<ThemeSettings>(() => loadThemeSettings());

  useEffect(() => {
    applyThemeSettings(settings);
    saveThemeSettings(settings);
  }, [settings]);

  return (
    <div className="settings-scroll">
      <section className="settings-section">
        <h3>Customization</h3>
        <div className="settings-row">
          <label className="settings-label" htmlFor={accentId}>
            Accent color
          </label>
          <div className="settings-control">
            <input
              id={accentId}
              type="color"
              value={settings.accentColor}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, accentColor: e.target.value }))
              }
              aria-label="Accent color"
            />
            <span className="settings-value">{settings.accentColor.toUpperCase()}</span>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label" htmlFor={bgGradientId}>
            Background gradient
          </label>
          <div className="settings-control">
            <input
              id={bgGradientId}
              type="color"
              value={settings.backgroundGradientColor}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  backgroundGradientColor: e.target.value,
                }))
              }
              aria-label="Background gradient color"
            />
            <span className="settings-value">
              {settings.backgroundGradientColor.toUpperCase()}
            </span>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label" htmlFor={bgId}>
            Background image
          </label>
          <div className="settings-control">
            <input
              className="image-input"
              id={bgId}
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const dataUrl = await fileToDataUrl(file);
                setSettings((prev) => ({ ...prev, backgroundImageDataUrl: dataUrl }));
              }}
            />
            <button
              className="buttons"
              type="button"
              onClick={() =>
                setSettings((prev) => ({ ...prev, backgroundImageDataUrl: null }))
              }
              disabled={!settings.backgroundImageDataUrl}
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      <GpuSection />
    </div>
  );
}
