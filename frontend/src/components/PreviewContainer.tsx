import VideoPlayer from "../components/VideoPlayer.tsx"
import InfoBox from "../components/InfoBox.tsx"
import React from "react";
type PreviewContainerProps = {
  selectedClip: string | null;
  selectedClipThumbnail: string | null;
  selectedClips: Set<string>;
  videoIsHEVC: boolean | null;
  userHasHEVC: React.RefObject<boolean>;
  importToken: string;
  handleExport: (
    selectedClips: Set<string>,
    enableMerged: boolean
  ) => Promise<void>;
};

export default function PreviewContainer (props: PreviewContainerProps) {
  const [mergeEnabled, setMergeEnabled] = React.useState(true);
  const onExportClick = () => {
    props.handleExport(props.selectedClips, mergeEnabled);
  }
  return (
    <main  className="preview-container" >
      <div className="preview-window">
        {props.selectedClip ? (
          <VideoPlayer 
           selectedClip={props.selectedClip}
           videoIsHEVC={props.videoIsHEVC}
           userHasHEVC={props.userHasHEVC}
           posterPath={props.selectedClipThumbnail}
           importToken={props.importToken}
          />
          ) : (
            <p>No clip selected</p>
        )}
      </div>
      <div className="preview-export">
        <div className="checkbox-row">
          <label className="custom-checkbox">
            <input 
              type="checkbox"
              className="checkbox"
              checked={mergeEnabled}
              onChange={(e) => setMergeEnabled(e.target.checked)}
            />
            <span className="checkmark"></span>
          </label>
          <p>Merge clips</p>
        </div>
        <button 
          className="buttons" 
          id="file-button"
          onClick={onExportClick}
        >
          Export
        </button>
      </div>
      
      <InfoBox/>
    </main>
  );
}