import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

type RemuxState = "idle" | "running" | "done" | "error";

export default function RemuxSection() {
  const [inputPath, setInputPath] = useState("");
  const [outputFormat, setOutputFormat] = useState<"mp4" | "mkv" | "mov">("mp4");
  const [state, setState] = useState<RemuxState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [outputPath, setOutputPath] = useState("");

  const pickInput = async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4", "mkv", "mov", "avi", "webm", "m4v"] }],
    });
    if (file) setInputPath(file as string);
  };

  const buildOutputPath = (input: string, fmt: string): string => {
    const sep = input.includes("\\") ? "\\" : "/";
    const parts = input.split(sep);
    const filename = parts.pop() || "output";
    const stem = filename.replace(/\.[^/.]+$/, "");
    parts.push(`${stem}_remuxed.${fmt}`);
    return parts.join(sep);
  };

  const handleRemux = async () => {
    if (!inputPath) return;

    const suggestedPath = buildOutputPath(inputPath, outputFormat);

    const chosen = await save({
      defaultPath: suggestedPath,
      filters: [{ name: "Video", extensions: [outputFormat] }],
    });
    if (!chosen) return;

    setState("running");
    setErrorMsg("");
    setOutputPath(chosen as string);

    try {
      await invoke("remux_video", {
        inputPath,
        outputPath: chosen as string,
      });
      setState("done");
    } catch (err) {
      setErrorMsg(String(err));
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setErrorMsg("");
    setOutputPath("");
  };

  return (
    <div className="remux-section">
      <h3 className="remux-title">Remux / Recontainer</h3>
      <p className="remux-desc">
        Change a video's container format without re-encoding. Zero quality loss, very fast.
        Useful for converting MKV → MP4 for NLE compatibility.
      </p>

      <div className="remux-field">
        <label className="remux-label">Input file</label>
        <div className="remux-input-row">
          <input
            type="text"
            className="remux-path-input"
            placeholder="Select a video file..."
            value={inputPath}
            onChange={(e) => setInputPath(e.target.value)}
            readOnly
          />
          <button className="remux-browse-btn" onClick={pickInput} disabled={state === "running"}>
            Browse
          </button>
        </div>
      </div>

      <div className="remux-field">
        <label className="remux-label">Output format</label>
        <div className="remux-format-btns">
          {(["mp4", "mkv", "mov"] as const).map((fmt) => (
            <button
              key={fmt}
              className={`remux-fmt-btn${outputFormat === fmt ? " active" : ""}`}
              onClick={() => setOutputFormat(fmt)}
              disabled={state === "running"}
            >
              .{fmt}
            </button>
          ))}
        </div>
      </div>

      {state === "idle" && (
        <button
          className="remux-run-btn"
          onClick={handleRemux}
          disabled={!inputPath}
        >
          Remux
        </button>
      )}

      {state === "running" && (
        <div className="remux-status running">Remuxing...</div>
      )}

      {state === "done" && (
        <div className="remux-result">
          <div className="remux-status done">Done — saved to:</div>
          <div className="remux-output-path">{outputPath}</div>
          <button className="remux-browse-btn" onClick={reset}>Remux another</button>
        </div>
      )}

      {state === "error" && (
        <div className="remux-result">
          <div className="remux-status error">Failed</div>
          <div className="remux-error-msg">{errorMsg}</div>
          <button className="remux-browse-btn" onClick={reset}>Try again</button>
        </div>
      )}

      <div className="remux-note">
        <strong>Note:</strong> Not all codec + container combos are valid. H.264/H.265 MKV → MP4 always works.
        MKV subtitle tracks (ASS/SSA) will be dropped when remuxing to MP4.
      </div>
    </div>
  );
}
