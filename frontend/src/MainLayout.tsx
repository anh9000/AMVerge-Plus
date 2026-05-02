import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ClipsContainer from "./components/clipsGrid/ClipsContainer.tsx";
import PreviewContainer from "./components/previewPanel/PreviewContainer.tsx";
import DetectionSettingsPanel from "./components/DetectionSettings.tsx";
import { DetectionSettings } from "./utils/episodeUtils";
import { ClipItem } from "./types/domain";

type LayoutProps = {
    cols: number;
    gridSize: number;
    gridRef: React.RefObject<HTMLDivElement | null>;
    gridPreview: boolean;
    setGridPreview: React.Dispatch<React.SetStateAction<boolean>>;
    selectedClips: Set<string>;
    setSelectedClips: React.Dispatch<React.SetStateAction<Set<string>>>;
    clips: ClipItem[];
    setClips: (clips: ClipItem[]) => void;
    importToken: string;
    loading: boolean;
    isEmpty: boolean;
    handleExport: (
        selectedClips: Set<string>,
        mergeEnabled: boolean,
        mergeFileName?: string,
        remuxEnabled?: boolean,
    ) => Promise<void>;
    sideBarEnabled: boolean;
    videoIsHEVC: boolean | null;
    userHasHEVC: React.RefObject<boolean>;
    focusedClip: string | null;
    setFocusedClip: React.Dispatch<React.SetStateAction<string | null>>;
    exportDir: string | null;
    onPickExportDir: () => void;
    onExportDirChange: (dir: string) => void;
    defaultMergedName: string;
    snapGridBigger: () => void;
    snapGridSmaller: () => void;
    detectionSettings: DetectionSettings;
    onDetectionSettingsChange: (s: DetectionSettings) => void;
};

export default function MainLayout(props: LayoutProps) {
    // Default 50/50 split — player center, clips right
    const [leftWidth, setLeftWidth] = useState(50);

    const focusedClipThumbnail = useMemo(
        () =>
            props.focusedClip
                ? props.clips.find((c) => c.src === props.focusedClip)?.thumbnail ?? null
                : null,
        [props.focusedClip, props.clips]
    );

    const resizeCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        return () => {
            resizeCleanupRef.current?.();
        };
    }, []);

    const startResize = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const startX = e.clientX;
        const container = e.currentTarget.parentElement as HTMLElement;
        const leftPane = container.children[0] as HTMLElement;

        const startLeftWidth = leftPane.offsetWidth;
        const totalWidth = container.offsetWidth;

        const onMouseMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX;
            const newPercent = ((startLeftWidth + delta) / totalWidth) * 100;
            // 25%–75% limits on both panes
            setLeftWidth(Math.min(75, Math.max(25, newPercent)));
        };

        const onMouseUp = () => {
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
            resizeCleanupRef.current = null;
        };

        resizeCleanupRef.current?.();
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        resizeCleanupRef.current = onMouseUp;
    }, []);

    return (
        <div className="split-layout">
            {/* CENTER: Video player pane */}
            <div className="player-pane has-beam" style={{ width: `${leftWidth}%` }}>
                <PreviewContainer
                    focusedClip={props.focusedClip}
                    focusedClipThumbnail={focusedClipThumbnail}
                    selectedClips={props.selectedClips}
                    handleExport={props.handleExport}
                    videoIsHEVC={props.videoIsHEVC}
                    userHasHEVC={props.userHasHEVC}
                    importToken={props.importToken}
                    exportDir={props.exportDir}
                    onPickExportDir={props.onPickExportDir}
                    onExportDirChange={props.onExportDirChange}
                    defaultMergedName={props.defaultMergedName}
                />
            </div>

            <div
                className="divider"
                onMouseDown={(e) => startResize(e)}
            >
                <span className="subdivider"/>
                <span className="subdivider"/>
            </div>

            {/* RIGHT: Scene detection results pane */}
            <div className="clips-pane has-beam" style={{ width: `${100 - leftWidth}%` }}>
                {/* Clips toolbar: detection settings + grid controls */}
                <div className="clips-toolbar">
                    <DetectionSettingsPanel
                        settings={props.detectionSettings}
                        onChange={props.onDetectionSettingsChange}
                        disabled={props.loading}
                    />
                    <div className="clips-toolbar-right">
                        <span className="clips-sel-count">
                            {props.selectedClips.size > 0 ? `${props.selectedClips.size} sel` : ""}
                        </span>
                        <label className="clips-toolbar-check">
                            <span className="custom-checkbox">
                                <input
                                    type="checkbox"
                                    className="checkbox"
                                    checked={props.gridPreview}
                                    onChange={(e) => props.setGridPreview(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                            </span>
                            <span>Preview</span>
                        </label>
                        <div className="clips-toolbar-zoom">
                            <button onClick={props.snapGridSmaller} title="Smaller grid">−</button>
                            <button onClick={props.snapGridBigger} title="Larger grid">+</button>
                        </div>
                    </div>
                </div>

                <ClipsContainer
                    gridSize={props.gridSize}
                    gridRef={props.gridRef}
                    cols={props.cols}
                    gridPreview={props.gridPreview}
                    selectedClips={props.selectedClips}
                    setSelectedClips={props.setSelectedClips}
                    clips={props.clips}
                    importToken={props.importToken}
                    loading={props.loading}
                    isEmpty={props.isEmpty}
                    videoIsHEVC={props.videoIsHEVC}
                    userHasHEVC={props.userHasHEVC}
                    setFocusedClip={props.setFocusedClip}
                    focusedClip={props.focusedClip}
                />
            </div>
        </div>
    );
}
