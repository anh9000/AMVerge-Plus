use std::process::Command;
use tauri::{AppHandle, Manager};

#[tauri::command]
fn detect_scenes(
    app: AppHandle,
    video_path: String,
    threshold: f32,
) -> Result<String, String> {

    // 🔥 Get Tauri app data directory (SAFE DIRECTORY)
    let output_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    std::fs::create_dir_all(&output_dir)
        .map_err(|e| e.to_string())?;

    if let Ok(entries) = std::fs::read_dir(&output_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let _ = std::fs::remove_file(path);
            }
        }
    }
    let output_dir_str = output_dir.to_string_lossy().to_string();

    // --- Build backend paths from project root (only for dev) ---
    let mut root = std::env::current_dir().map_err(|e| e.to_string())?;
    root.pop(); // remove src-tauri
    root.pop(); // remove frontend

    let script_path = root.join("backend").join("backend_script.py");

    let python_path = root
        .join("backend")
        .join("venv")
        .join("Scripts")
        .join("python.exe");

    println!("Script: {:?}", script_path);
    println!("Output dir: {:?}", output_dir);

    let output = Command::new(python_path)
        .arg(script_path)
        .arg(&video_path)
        .arg(threshold.to_string())
        .arg(&output_dir_str)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![detect_scenes])
        .run(tauri::generate_context!())
        .expect("error running app");
}