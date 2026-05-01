import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

interface UpdateInfo {
  has_update: boolean;
  current_version: string;
  latest_version: string;
  download_url: string;
}

type UpdateState = "idle" | "available" | "downloading" | "restarting";

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<UpdateState>("idle");
  const [progress, setProgress] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const result = await invoke<UpdateInfo>("check_for_update");
        if (result.has_update && result.download_url) {
          setInfo(result);
          setState("available");
        }
      } catch {
        // non-critical, silently ignore
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    (async () => {
      const stop = await listen<number>("update-download-progress", (e) => {
        setProgress(e.payload);
        if (e.payload >= 100) setState("restarting");
      });
      unlisten = stop;
    })();

    return () => { if (unlisten) unlisten(); };
  }, []);

  async function handleUpdate() {
    if (!info) return;
    setState("downloading");
    setProgress(0);
    try {
      await invoke("download_and_apply_update", { downloadUrl: info.download_url });
    } catch (err) {
      console.error("Update failed:", err);
      setState("available");
    }
  }

  if (state === "idle" || dismissed || !info) return null;

  return (
    <div className="update-banner">
      {state === "available" && (
        <>
          <span className="update-banner-text">
            v{info.latest_version} is available
          </span>
          <button className="update-banner-btn" onClick={handleUpdate}>
            Update Now
          </button>
          <button className="update-banner-dismiss" onClick={() => setDismissed(true)}>
            ✕
          </button>
        </>
      )}
      {state === "downloading" && (
        <>
          <span className="update-banner-text">Downloading... {progress}%</span>
          <div className="update-banner-bar">
            <div className="update-banner-fill" style={{ width: `${progress}%` }} />
          </div>
        </>
      )}
      {state === "restarting" && (
        <span className="update-banner-text">Applying update, restarting...</span>
      )}
    </div>
  );
}
