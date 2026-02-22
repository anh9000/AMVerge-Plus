import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Navbar from "./components/Navbar";
import ImportButtons from "./components/ImportButtons";
import "./App.css";
import MainLayout from "./MainLayout";

function App() {
  /*
  Create setSelectedClip function, whatever gets passed into it
  becomes selectedClip
  */
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set());
  const [clips, setClips] = useState<{ id: string; src: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [gridPreview, setGridPreview] = useState<true | false>(false);
  const [cols, setCols] = useState(6);
  const gridRef = useRef<HTMLDivElement>(null);
  const width = gridRef.current?.offsetWidth || 0;
  const gridSize = Math.floor(width / cols);

  // divides width of grid by input grid size
  const currentCols = Math.max(
    1, // has to be minimum 1 column so we max it with 1 here
    Math.floor(width / (gridSize))
  );

  const snapGridBigger = () => {
    setCols(c => Math.max(1, c - 1));
  };

  const runDetection = async () => {
    try {
      const result = await invoke("detect_scenes", {
        videoPath: "C:/path/to/video.mp4",
        threshold: 0.8,
        outputDir: "output_test"
      });

      console.log("RAW RESULT:", result);
      const scenes = JSON.parse(result as string);

      const formatted = scenes.map((s: any) => ({
        id: String(s.scene_index),
        src: s.path
      }));

      setClips(formatted);

    } catch (err) {
      console.error("Detection failed:", err);
    }
  };

  const handleImport = async () => {
    const file = await open({
      multiple: false,
      filters: [
        {
          name: "Video",
          extensions: ["mp4", "mkv", "mov"]
        }
      ]
    });

    if (!file) return;

    try {
      setLoading(true);

      const result = await invoke<string>("detect_scenes", {
        videoPath: file,
        threshold: 0.8
      });

      const scenes = JSON.parse(result);

      const formatted = scenes.map((s: any) => ({
        id: String(s.scene_index),
        src: s.path
      }));

      setClips(formatted);

    } catch (err) {
      console.error("Detection failed:", err);
    } finally {
      setLoading(false);
    }
  };
  
  const snapGridSmaller = () => {
    setCols(c => Math.min(12, c + 1));
  };

  return (
    <main>
      <Navbar />
      <ImportButtons 
        cols={cols}
        gridSize={gridSize}
        onBigger={snapGridBigger}
        onSmaller={snapGridSmaller}
        setGridPreview={setGridPreview}
        gridPreview={gridPreview}
        selectedClips={selectedClips}
        setSelectedClips={setSelectedClips}
        onDetect={runDetection}
        onImport={handleImport}
        loading={loading}
      />
      <div className="main" >
        <MainLayout 
         cols={cols}
         gridSize={gridSize}
         gridRef={gridRef}
         gridPreview={gridPreview}
         selectedClips={selectedClips}
         setSelectedClips={setSelectedClips}
         clips={clips}/>
      </div>
    </main>
  );
}

export default App;
