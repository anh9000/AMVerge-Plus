import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type ClipItem = { id: string; src: string; thumbnail: string; originalName?: string };

export type RenameOrder = "forward" | "reverse";
export type RenamePadding = "1" | "01" | "001" | "0001";
export type RenameSeparator = "_" | "-" | " " | "";

interface RenamePanelProps {
  clips: ClipItem[];
  onRenamed: (updated: ClipItem[]) => void;
  onClose: () => void;
}

// Cross-platform path helpers
function getDirname(path: string): string {
  const last = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return last >= 0 ? path.slice(0, last) : "";
}

function getExtension(path: string): string {
  const base = path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot) : "";
}

function joinPath(dir: string, filename: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return dir + sep + filename;
}

function getFilename(path: string): string {
  return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
}

const SEPARATOR_LABELS: Record<RenameSeparator, string> = {
  "_": "_",
  "-": "-",
  " ": "space",
  "": "none",
};

export default function RenamePanel({ clips, onRenamed, onClose }: RenamePanelProps) {
  const [baseName, setBaseName] = useState("");
  const [order, setOrder] = useState<RenameOrder>("forward");
  const [padding, setPadding] = useState<RenamePadding>("001");
  const [separator, setSeparator] = useState<RenameSeparator>("_");
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const padWidth = padding.length;

  // Build rename pairs in the chosen order
  const pairs = useMemo(() => {
    if (!baseName.trim() || clips.length === 0) return [];

    const ordered = order === "reverse" ? [...clips].reverse() : [...clips];

    return ordered.map((clip, i) => {
      const num = String(i + 1).padStart(padWidth, "0");
      const newBasename = `${baseName.trim()}${separator}${num}`;
      const ext = getExtension(clip.src);
      const dir = getDirname(clip.src);
      const newPath = joinPath(dir, newBasename + ext);
      return { clip, newBasename, newPath };
    });
  }, [clips, baseName, order, padding, separator, padWidth]);

  // Preview: show first 3 and last 3 when list is long
  const previewPairs = useMemo(() => {
    if (pairs.length <= 6) return pairs;
    return [
      ...pairs.slice(0, 3),
      null,
      ...pairs.slice(-3),
    ] as (typeof pairs[0] | null)[];
  }, [pairs]);

  async function handleApply() {
    if (!pairs.length) return;
    setApplying(true);
    setError(null);

    try {
      const renames = pairs.map((p) => ({
        old_path: p.clip.src,
        new_path: p.newPath,
      }));

      await invoke("rename_clips", { renames });

      // Rebuild the clips array with updated paths, restoring original order.
      // `pairs` may be in reverse order — map back to original clip order.
      const pathMap = new Map(pairs.map((p) => [p.clip.id, p.newPath]));

      const updated: ClipItem[] = clips.map((clip) => {
        const newPath = pathMap.get(clip.id);
        if (!newPath) return clip;
        const newThumb = joinPath(getDirname(newPath), getFilename(newPath).replace(/\.[^.]+$/, ".jpg"));
        return { ...clip, src: newPath, thumbnail: newThumb };
      });

      onRenamed(updated);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="rename-panel">
      <div className="rename-panel-header">
        <span className="rename-panel-title">Rename Clips</span>
        <button className="rename-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {/* Base name */}
      <div className="rename-row">
        <span className="rename-label">Base name</span>
        <input
          className="rename-input"
          type="text"
          placeholder="e.g. Your Name"
          value={baseName}
          onChange={(e) => setBaseName(e.target.value)}
          autoFocus
        />
      </div>

      {/* Order */}
      <div className="rename-row">
        <span className="rename-label">Order</span>
        <div className="rename-btns">
          <button
            className={order === "forward" ? "active" : ""}
            onClick={() => setOrder("forward")}
            title="First scene → 001"
          >
            Forward
          </button>
          <button
            className={order === "reverse" ? "active" : ""}
            onClick={() => setOrder("reverse")}
            title="Last scene → 001"
          >
            Reverse
          </button>
        </div>
      </div>

      {/* Separator */}
      <div className="rename-row">
        <span className="rename-label">Separator</span>
        <div className="rename-btns">
          {(["_", "-", " ", ""] as RenameSeparator[]).map((s) => (
            <button
              key={JSON.stringify(s)}
              className={separator === s ? "active" : ""}
              onClick={() => setSeparator(s)}
            >
              {SEPARATOR_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Padding */}
      <div className="rename-row">
        <span className="rename-label">Numbering</span>
        <div className="rename-btns">
          {(["1", "01", "001", "0001"] as RenamePadding[]).map((p) => (
            <button
              key={p}
              className={padding === p ? "active" : ""}
              onClick={() => setPadding(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Live preview */}
      {baseName.trim() && previewPairs.length > 0 && (
        <div className="rename-preview">
          <span className="rename-preview-label">Preview</span>
          {previewPairs.map((p, i) =>
            p === null ? (
              <div key="ellipsis" className="rename-preview-ellipsis">···</div>
            ) : (
              <div key={i} className="rename-preview-row">
                <span className="rename-old">{getFilename(p.clip.src)}</span>
                <span className="rename-arrow">→</span>
                <span className="rename-new">{getFilename(p.newPath)}</span>
              </div>
            )
          )}
        </div>
      )}

      {error && <div className="rename-error">{error}</div>}

      <button
        className="rename-apply"
        onClick={handleApply}
        disabled={applying || !baseName.trim() || pairs.length === 0}
      >
        {applying ? "Renaming…" : `Rename ${clips.length} clip${clips.length !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
