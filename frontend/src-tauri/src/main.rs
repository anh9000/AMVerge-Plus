use std::io::{BufRead, BufReader, Read};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

use tauri::{AppHandle, Manager};
use tauri::Emitter;
use serde::Serialize;

#[derive(Serialize, Clone)]
struct ProgressPayload {
    percent: u8,
    message: String,
}

#[tauri::command]
fn detect_scenes(
    app: AppHandle,
    video_path: String,
    threshold: f32,
    blocksize: i32
) -> Result<String, String> {
    // ----------------------------
    // Output directory (app data)
    // ----------------------------
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

    // ----------------------------
    // Dev-only: find python + script
    // ----------------------------
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

    let mut child = Command::new(python_path)
        .arg(script_path)
        .arg(&video_path)
        .arg(threshold.to_string())
        .arg(blocksize.to_string())
        .arg(&output_dir_str)
        .stdout(Stdio::piped()) // JSON only
        .stderr(Stdio::piped()) // progress + logs
        .spawn()
        .map_err(|e| format!("Failed to spawn python: {e}"))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // We'll collect *all* stderr lines (incase python fails)
    let stderr_accum = Arc::new(Mutex::new(String::new()));

    // Clone handles for the stderr thread
    let app_for_thread = app.clone();
    let stderr_accum_for_thread = Arc::clone(&stderr_accum);


    // ----------------------------
    // Thread: read stderr line-by-line and emit progress
    // ----------------------------
    let stderr_thread = thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            // Save line for debugging/errors
            if let Ok(mut buf) = stderr_accum_for_thread.lock() {
                buf.push_str(&line);
                buf.push('\n');
            }

            // Expected format:
            // PROGRESS|<percent>|<message>
            if let Some(rest) = line.strip_prefix("PROGRESS|") {
                let mut parts = rest.splitn(2, '|');
                let p_str = parts.next().unwrap_or("");
                let msg = parts.next().unwrap_or("").to_string();

                if let Ok(p) = p_str.parse::<u8>() {
                    let _ = app_for_thread.emit(
                        "scene_progress",
                        ProgressPayload { percent: p, message: msg },
                    );
                }
            }
        }
    });

    // ----------------------------
    // Main thread: read stdout fully (JSON)
    // ----------------------------
    let mut stdout_reader = BufReader::new(stdout);
    let mut stdout_string = String::new();
    stdout_reader
        .read_to_string(&mut stdout_string)
        .map_err(|e| format!("Failed reading stdout: {e}"))?;

    // Wait for python to finish
    let status = child
        .wait()
        .map_err(|e| format!("Failed waiting for python: {e}"))?;

    // Ensure stderr thread finishes too
    let _ = stderr_thread.join();

    // If python failed, return stderr
    if !status.success() {
        let err = stderr_accum
            .lock()
            .map(|s| s.clone())
            .unwrap_or_else(|_| "Python failed (stderr lock poisoned)".to_string());
        return Err(err);
    }

    // Success: stdout is pure JSON
    Ok(stdout_string)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![detect_scenes])
        .run(tauri::generate_context!())
        .expect("error running app");
}