# Upstream Merge Guide

This repo is a fork of [crptk/AMVerge](https://github.com/crptk/AMVerge).

```bash
# Fetch upstream changes
git fetch upstream

# Merge (expect conflicts in the files listed below)
git merge upstream/main
```

During a conflict, use this guide to decide what to keep.  
Any line tagged `// [AMVerge Plus]` or `{/* [AMVerge Plus] */}` in source files is **ours, always keep it**.

---

## Files we added (no upstream equivalent)

Accept ours unconditionally in any conflict.

| File | Purpose |
|------|---------|
| `frontend/src/components/menu/RemuxSection.tsx` | Standalone remux tool (Menu → Remux page) |
| `frontend/src/components/DetectionSettings.tsx` | Gear-button panel for scene detection settings |
| `frontend/src/styles/detection.css` | Styles for the detection settings panel |
| `.github/ISSUE_TEMPLATE/` | Bug report + feature request templates |

---

## Files we modified (conflict likely)

### `frontend/src-tauri/src/main.rs`

Our additions - keep all of these on merge:

| What | Where |
|------|-------|
| `parse_version()` helper | Update check section |
| `check_for_update` command | Hits **anh9000/AMVerge-Plus** GitHub API - keep our URL, not upstream's |
| `download_and_apply_update` command | In-app one-click updater |
| `EncoderInfo` struct | GPU section |
| `probe_hardware_encoders` command | GPU section |
| `remux_video` command | Remux section |
| `video_encoder_args(encoder)` helper | Inside `export_clips` |
| `ffmpeg_reencode_ae_args(input, output, encoder)` | Accepts encoder param - keep the extra arg |
| `detect_scenes` - extra params | `detection_mode`, `min_duration`, `sensitivity` + `extra_args` vec |
| `export_clips` - extra params | `remux_enabled: bool`, `video_encoder: Option<String>` |
| `invoke_handler` entries | `remux_video`, `probe_hardware_encoders` - keep both |

**Merge strategy for `invoke_handler`:** upstream adds new entries at the bottom of the list; ours are also near the bottom with a comment separator. Accept both sides.

---

### `frontend/src/utils/episodeUtils.ts`

- `DetectionSettings` interface + `DEFAULT_DETECTION_SETTINGS` export (top of file)
- `detectScenes` third param `settings?: DetectionSettings`; passes `detectionMode`, `minDuration`, `sensitivity` to the invoke call

---

### `frontend/src/hooks/useImportExport.ts`

- `detectionSettings` state + `setDetectionSettings` (uses `DetectionSettings` type)
- Both `detectScenes` calls pass `detectionSettings` as third arg
- `handleExport` signature: added `remuxEnabled?: boolean` fourth param
- Inside `handleExport`: reads `amverge_encoder_v1` from `localStorage`; passes `remuxEnabled` and `videoEncoder` to `invoke("export_clips", ...)`

---

### `frontend/src/components/previewPanel/PreviewContainer.tsx`

- `remuxEnabled` state (default `false`)
- "Remux (no re-encode)" checkbox in the export panel
- Both `onExportClick` and `confirmMergeExport` pass `remuxEnabled` as 4th arg to `handleExport`
- `handleExport` type signature: added `remuxEnabled?: boolean`

---

### `frontend/src/components/menu/SettingsSection.tsx`

- `GpuSection` component (defined above the main export): probe button, encoder radio options, `localStorage` persistence under key `amverge_encoder_v1`
- Main return uses `<div className="settings-scroll">` wrapping the existing customization section + new `<GpuSection />`

---

### `frontend/src/pages/Menu.tsx`

- `{ key: "remux", label: "Remux" }` added to `PAGES` array
- `import RemuxSection` + `{activePage === "remux" && <RemuxSection />}` render

---

### `frontend/src/styles/menu.css`

- `.remux-section` block (added before the `/* ABOUT */` section comment)

### `frontend/src/styles/settings.css`

- `.settings-scroll` rule
- Full GPU section: `.gpu-section`, `.gpu-title`, `.gpu-desc`, `.gpu-encoders`, `.gpu-option`, `.gpu-dot`, `.gpu-name`, `.gpu-sublabel`, `.gpu-none`, `.gpu-probe-btn`, `.gpu-note`

---

### `frontend/src/MainLayout.tsx` + `frontend/src/pages/HomePage.tsx`

- `remuxEnabled?: boolean` added to `handleExport` prop type signature (trailing comma change only)

---

## Branding / config (always keep ours)

- `src-tauri/tauri.conf.json`: product name `AMVerge Plus`, identifier `com.amvergeplus.app`
- Update check URL: `https://api.github.com/repos/anh9000/AMVerge-Plus/releases/latest`
- App window title and any references to "AMVerge Plus"

---

## Quick grep after a merge

```bash
# Find every line we tagged
grep -rn "\[AMVerge Plus\]" frontend/src
```

All our non-trivial additions carry this tag - if a line is missing after a merge it needs to be restored.
