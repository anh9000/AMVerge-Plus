import React from "react";
import MainLayout from "../MainLayout";
import { fileNameFromPath, DetectionSettings } from "../utils/episodeUtils";
import { ClipItem } from "../types/domain";

interface HomePageProps {
  cols: number;
  gridSize: number;
  gridRef: React.RefObject<HTMLDivElement | null>;
  snapGridBigger: () => void;
  snapGridSmaller: () => void;
  setGridPreview: React.Dispatch<React.SetStateAction<boolean>>;
  gridPreview: boolean;
  selectedClips: Set<string>;
  setSelectedClips: (val: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  loading: boolean;
  mainLayoutWrapperRef: React.RefObject<HTMLDivElement | null>;
  clips: ClipItem[];
  setClips: (clips: ClipItem[]) => void;
  importToken: string;
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
  openedEpisodeId: string | null;
  importedVideoPath: string | null;
  detectionSettings: DetectionSettings;
  onDetectionSettingsChange: (s: DetectionSettings) => void;
}

export default function HomePage({
  cols,
  gridSize,
  gridRef,
  snapGridBigger,
  snapGridSmaller,
  setGridPreview,
  gridPreview,
  selectedClips,
  setSelectedClips,
  loading,
  mainLayoutWrapperRef,
  clips,
  setClips,
  importToken,
  isEmpty,
  handleExport,
  sideBarEnabled,
  videoIsHEVC,
  userHasHEVC,
  focusedClip,
  setFocusedClip,
  exportDir,
  onPickExportDir,
  onExportDirChange,
  defaultMergedName,
  openedEpisodeId,
  importedVideoPath,
  detectionSettings,
  onDetectionSettingsChange,
}: HomePageProps) {
  return (
    <div className="main-layout-wrapper" ref={mainLayoutWrapperRef}>
      <MainLayout
        cols={cols}
        gridSize={gridSize}
        gridRef={gridRef}
        gridPreview={gridPreview}
        setGridPreview={setGridPreview}
        clips={clips}
        setClips={setClips}
        importToken={importToken}
        isEmpty={isEmpty}
        handleExport={handleExport}
        sideBarEnabled={sideBarEnabled}
        videoIsHEVC={videoIsHEVC}
        userHasHEVC={userHasHEVC}
        focusedClip={focusedClip}
        setFocusedClip={setFocusedClip}
        exportDir={exportDir}
        onPickExportDir={onPickExportDir}
        onExportDirChange={onExportDirChange}
        defaultMergedName={defaultMergedName}
        selectedClips={selectedClips}
        setSelectedClips={setSelectedClips}
        loading={loading}
        snapGridBigger={snapGridBigger}
        snapGridSmaller={snapGridSmaller}
        detectionSettings={detectionSettings}
        onDetectionSettingsChange={onDetectionSettingsChange}
      />

      <div className="info-bar">
        {openedEpisodeId && importedVideoPath && (
          <span className="info-bar-filename">
            {fileNameFromPath(importedVideoPath)}
          </span>
        )}
      </div>
    </div>
  );
}
