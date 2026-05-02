# How AMVerge Plus Works

A plain-language explanation of the scene detection and export pipeline, what happens under the hood and why it's fast.

---

## The two things every video file is made of

Every video file has two distinct layers:

- **Container** - the wrapper format (MKV, MP4, AVI). Defines how streams are stored and indexed, what metadata is embedded, which devices and apps can open the file.
- **Streams** - the actual compressed video and audio data inside. The codec (H.264, H.265, AAC, etc.) lives here. This is what your GPU or CPU decodes when you play the file.

Container and codec are independent. H.264 video can live in an MKV, an MP4, or an AVI. The video data is identical either way, only the wrapper is different.

---

## What "remux" means (and why it matters)

Remuxing means swapping the container without touching the streams. FFmpeg's `-c copy` flag does this: it copies each compressed frame byte-for-byte into the new container. No decoding. No re-encoding. No quality loss. No generation loss.

**MKV to MP4 via remux:**
- Takes a few seconds regardless of file size
- Output is bit-for-bit identical to the source video
- File size is virtually the same (within a few KB for container overhead)
- Works because both containers support the same codecs

This is what AMVerge Plus does when it exports your clips. Your source MKV files are already compressed at full quality, there is no reason to decode and re-encode them just to change the container or split them at scene cuts.

---

## H.264 parameters during remux

CRF, bitrate, profile, level, x264 presets, these are encoding-time decisions. They get baked into the compressed bitstream when the video was originally encoded. Once encoded, those parameters are part of the compressed data itself and are not stored as separate editable values in the file.

Remuxing never touches the bitstream, so all of those parameters are preserved 100% by definition. There is nothing to configure, nothing to adjust. The output clip will have exactly the same CRF-equivalent quality, bitrate, and codec profile as the source.

---

## Re-encode vs. remux

| Situation | Remux | Re-encode |
|---|---|---|
| Change MKV to MP4 | yes, instant and lossless | unnecessary |
| Split at scene cuts (keyframe-aligned) | yes, stream copy | unnecessary |
| Split at a non-keyframe timestamp | no, can't do cleanly | yes, needed for frame accuracy |
| Source is H.264/H.265 to delivery MP4 | yes | no |
| Source is an editing intermediate (Grass Valley HQX, DNxHR, ProRes) to delivery MP4 | no, codec stays inside the container | yes, transcode to H.264 |
| Reduce file size or change quality | no | yes |

Editing intermediates are high-quality codecs designed for post-production, not distribution. Remuxing an AVI with an intermediate codec into MP4 only changes the wrapper. The codec inside is still the editing codec, which most players cannot decode. A full re-encode to H.264 is required in that case.

For broadcast-source MKV files (already H.264 or H.265), remux is always the right choice.

---

## How scene detection works

AMVerge Plus has four detection modes, each suited for different content:

### Keyframe mode (fastest)
Reads packet metadata from the video file without decoding any frames. Every keyframe (I-frame) in the stream is a potential scene boundary. This is often accurate enough for well-encoded files and takes under a second for any file size.

### Anime mode (dHash + Canny edge analysis)
Designed for anime, which has flat colour fills, hard lineart, and fast cuts that encoders sometimes miss.

1. Extracts the keyframe list from the file
2. Identifies "suspicious intervals" - gaps between keyframes longer than 3 seconds, where an encoder likely missed a scene cut
3. Decodes frames only within those intervals (at reduced resolution, in grayscale)
4. Computes a **difference hash (dHash)** between consecutive frames: resize to 9x8, compare adjacent pixels row-by-row to produce a 64-bit hash; Hamming distance measures how different two frames are
5. For ambiguous cases (medium Hamming distance), runs **Canny edge detection** on both frames, pools the edge maps, and computes cosine similarity of the structure. A hard structural change (new composition) confirms a cut.
6. Each confirmed cut is snapped to the nearest keyframe before export

### Live-action mode
Uses PySceneDetect's HSV histogram comparison, which measures changes in hue, saturation, and value distribution between frames. More reliable for real-world footage with gradual lighting changes and complex motion.

### Music video mode (dHash sampled)
Samples approximately 8 frames per second and runs dHash comparison only. Music videos cut very frequently and don't need the Canny verification pass. Speed matters more than minimising false positives.

---

## Keyframe snapping

Content-aware detection (anime, live-action, music video) finds the timestamp where a scene cut occurs. That timestamp may not align with a keyframe in the compressed stream.

This matters because stream copy only works cleanly when cuts fall on keyframes. If you tell FFmpeg to start a clip at a non-keyframe timestamp using `-c copy`, it seeks backward to the nearest keyframe and includes those extra frames. Your clip starts too early, or the beginning is visually corrupted.

Keyframe snapping resolves this automatically: after detection, every cut timestamp is mapped to the nearest keyframe in the already-extracted keyframe list. The snapped timestamps are then passed to FFmpeg for segmenting. Cost is near-zero (an in-memory sort). Result: every clip always starts and ends on a clean I-frame.

---

## Audio handling

Video is always stream copied. Audio depends on what is in the source:

- **AAC, AC-3 (Dolby Digital)** - stream copied into the output container, no quality loss
- **FLAC, DTS, TrueHD, Vorbis, PCM** - transcoded to AAC 192k, because these formats are not supported inside MP4 containers by most players and platforms

The audio codec check runs once when you import a file. If transcoding is needed, only the audio is re-encoded. The video stream is still stream copied.

---

## The "recontainer" concept

If you have used AMVtool before, you may already know this operation by a different name. AMVtool has a "Recontainer" feature that lets you change an MKV or AVI file into an MP4 without re-encoding. That is exactly what is happening under the hood: it runs FFmpeg with stream copy and puts the existing video and audio streams into a new container.

AMVerge Plus does the same thing as its default export. Every clip you export is recontainered from the source format into MP4 using FFmpeg's `-c copy` mode. No quality is lost, no encoding time is spent. The only change is the file wrapper.

The reason tools like AMVtool expose this as a named feature is that a lot of users do not realize container and codec are separate things. "Recontainer" makes it clear you are only changing the box, not the content inside it.

---

## How clip previews work

When AMVerge Plus displays your clips in the grid, it is not streaming or decoding any video. For each clip, FFmpeg extracts a single frame at a specific timestamp and saves it as a JPEG on disk. That image is then loaded into the card like any regular picture.

This means the clip grid is essentially an image gallery. No video is being processed or decoded to render the thumbnails, which is why the grid stays fast and responsive even with hundreds of clips loaded. The app only renders what is visible on screen at any given time, so memory usage stays low regardless of library size.

The actual video is only decoded when you click a clip to preview it. At that point the built-in video player handles playback natively, no FFmpeg involved. Everything else in the grid is just static JPEGs.

---

## Practical workflow

```
Source MKV (H.264 or H.265)
        |
  Scene detection
  (keyframe / anime / live-action / music video)
        |
  Keyframe snapping
  (cut timestamps aligned to I-frames)
        |
  FFmpeg stream copy segmenting
  (-c copy, audio fallback if needed)
        |
  Output MP4 clips
  (same codec, same quality, universal compatibility)
```

Total time for a 45-minute MKV: typically 5-30 seconds depending on detection mode. A full re-encode of the same file would take 5-15 minutes on the same hardware.
