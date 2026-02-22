# AMVergeSystem Architecture & Inter-Process Communication

## Overview

AMVerge is a desktop AI-powered video editing tool built using a multi-layer architecture:

* **Frontend:** React (TypeScript)
* **Bridge Layer:** Tauri (Rust)
* **Backend Engine:** Python (Scene Detection + FFmpeg)
* **Media Processing:** FFmpeg
* **Computer Vision:** OpenCV + PyAV
* **ML Extensions (Planned):** PyTorch

This document outlines how data flows between layers and how each subsystem communicates.

---

# Architecture Diagram

```
┌──────────────────────┐
│      React UI        │
│ (WebView Frontend)   │
└────────────┬─────────┘
             │ invoke()
             ▼
┌──────────────────────┐
│   Rust (Tauri Core)  │
│  System Bridge Layer │
└────────────┬─────────┘
             │ Command::new()
             ▼
┌──────────────────────┐
│   Python Backend     │
│ Scene Detection Core │
└────────────┬─────────┘
             │ Writes clips to disk
             ▼
        File System
```

---

# Layer Responsibilities

## 1. React Frontend

**Purpose:**
Provides the graphical interface and renders video clips.

**Responsibilities:**

* File selection (via Tauri dialog plugin)
* Calling backend commands using `invoke()`
* Parsing JSON results
* Rendering video clips in a grid
* Managing UI state (selection, preview, layout)

**Key Mechanism:**

```ts
await invoke("detect_scenes", {
  videoPath,
  threshold,
  blocksize
});
```

The frontend never directly accesses Python. It communicates exclusively with Rust via Tauri’s IPC bridge.

---

## 2. Tauri (Rust Bridge Layer)

**Purpose:**
Acts as a secure system-level intermediary between the frontend and backend.

**Responsibilities:**

* Expose Rust functions to the frontend using `#[tauri::command]`
* Spawn Python subprocesses
* Manage filesystem access
* Provide secure asset loading for the WebView
* Return results to the frontend

**Command Registration:**

```rust
#[tauri::command]
fn detect_scenes(...)
```

Registered via:

```rust
.invoke_handler(tauri::generate_handler![detect_scenes])
```

---

## 3. Python Backend

**Purpose:**
Performs scene detection and video trimming.

**Responsibilities:**

* Decode video frames (PyAV)
* Edge detection (OpenCV)
* Pooling and cosine similarity comparison
* Determine scene cut boundaries
* Trim scenes using FFmpeg
* Output clip metadata as JSON

**Important:**
Python writes clip files to disk and prints metadata to stdout.

Example output:

```json
[
  {
    "scene_index": 0,
    "start": 0.0,
    "end": 4.2,
    "path": "C:/Users/.../scene_0000.mp4"
  }
]
```

---

# Inter-Process Communication Flow

## Step 1 — Frontend → Rust

```ts
invoke("detect_scenes", {...})
```

* Arguments serialized to JSON
* Sent via Tauri IPC

---

## Step 2 — Rust → Python

Rust spawns:

```
python backend_script.py video.mp4 0.8 3 output_dir
```

Using:

```rust
Command::new(python_path)
```

---

## Step 3 — Python Execution

Python:

1. Processes video
2. Saves clips to `app_data_dir`
3. Prints JSON metadata to stdout

---

## Step 4 — Rust → Frontend

Rust captures:

```rust
output.stdout
```

Returns JSON string to frontend.

Rust does **not**:

* Read clip files
* Parse JSON
* Manipulate scene data

It acts purely as a messenger.

---

## Step 5 — Frontend Rendering

React:

```ts
const scenes = JSON.parse(result);
```

Transforms:

```ts
{
  id: String(scene_index),
  src: path
}
```

Rendered via:

```tsx
<video src={convertFileSrc(clip.src)} />
```

---

# File Access & convertFileSrc

## Problem

The WebView cannot load raw filesystem paths:

```
C:/Users/.../scene_0000.mp4
```

Browsers block this for security reasons.

---

## Solution: convertFileSrc

```ts
convertFileSrc(path)
```

This converts a filesystem path into a secure Tauri protocol URL such as:

```
asset://localhost/...
```

Tauri internally:

1. Intercepts the request
2. Reads the file from disk
3. Streams it into the WebView

No file copying occurs.

It is a protocol wrapper, not a file mover.

---

# Data Transfer Model

Important distinction:

AMVerge does **not** transfer video data between layers.

Only metadata is transferred:

```
Python → JSON (paths + metadata) → Rust → React
```

Video files remain on disk and are loaded directly by the WebView via Tauri.

This design:

* Minimizes memory usage
* Prevents unnecessary data duplication
* Keeps IPC lightweight

---

# Security Model

Tauri enforces:

* Explicit command exposure (`#[tauri::command]`)
* Whitelisted filesystem access
* Controlled dialog permissions
* Secure protocol-based file loading

Frontend cannot directly execute system commands.

All privileged operations pass through Rust.

---

# Key Architectural Advantages

✔ Clear separation of concerns
✔ Lightweight IPC (metadata only)
✔ Efficient disk-based media handling
✔ Secure filesystem abstraction
✔ Modular backend replacement capability

---

# Future Considerations

For production builds:

* Python interpreter must be bundled or embedded
* Paths should avoid dev-only assumptions
* Consider returning structured Rust types instead of raw JSON strings
* Potential migration to embedded Rust-based inference for performance

---

# Summary

AMVerge follows a layered architecture:

* React renders UI
* Tauri bridges system access
* Python performs heavy computation
* Filesystem stores media
* JSON transports metadata only

This architecture ensures scalability, security, and performance while maintaining modular development boundaries.

---

If you’d like, I can now:

* Convert this into a polished README version
* Add UML-style diagrams
* Add sequence diagrams
* Create a “Developer Onboarding Guide”
* Or generate a production deployment section

You’re building this like a real software system now.
