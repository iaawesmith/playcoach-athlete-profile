# PHASE-2A — Clip trim commands (operator-executed, local)

**Status:** ready to run. **Executor:** operator (Eric), locally.
**Why local:** the Drive connector gateway authorizes the bytes but will not carry
them — a ranged `alt=media` request returned `HTTP 206` from Drive followed by
`unsupported gateway response content type "video/mp4"`. Metadata reads work;
binary media does not cross the gateway. Trimming cannot happen in the agent sandbox.

Companion to [`calibration-clip-intake.md`](./calibration-clip-intake.md).
Provenance field definitions: [`../reference/calibration/_schema.md`](../reference/calibration/_schema.md).

**Nothing here appends to `ground-truth.yaml`.** Step 2 remains held.

---

## 0. Verify master content before trimming

Drive file IDs pin identity, not content. Verify the downloaded masters against
Drive's `md5Checksum` before any trim:

```bash
# from the directory holding the downloaded masters
md5sum -c /path/to/repo/scripts/verification/drive-masters.md5
```

Expect `OK` for each file present. A `FAILED` line means the local copy is not
the master Drive holds — halt, re-download, do not trim.

### Duplicate scan across all 20 (already run, 2026-08-24)

20 files, **19 distinct MD5s**. One collision:

| File | MD5 | Bytes |
|---|---|---|
| `Slant2-calibration-behind.MP4` | `5bf96b96f63014b8bc536e18d1e708ed` | 268708532 |
| `In6-calibration-behind.MP4` | `5bf96b96f63014b8bc536e18d1e708ed` | 268708532 |

Byte-identical. One is mislabeled or a duplicate upload; the folder does not
contain 20 distinct clips. **Neither is admissible as a distinct clip until
resolved.** Neither is in the intake set below.

Also worth knowing, because it is the reason size cannot substitute for a hash:
several *distinct* files share exact byte sizes (`302263424` ×3, `268708532` ×6,
`235153176` ×3) with different MD5s — the camera writes at a fixed bitrate
ceiling. Size collision is normal here; hash collision is not.

---

## 1. Per-clip trim parameters

Budget: **170 MiB** (≈15% headroom under the service's 200 MiB `MAX_VIDEO_BYTES`
in `mediapipe-service/app/video.py:16`). Duration derived per clip from its own
bitrate, then reduced 5% because stream copy snaps to keyframe boundaries and can
overshoot a proportional estimate.

| Clip | Master bytes | Master duration | Bitrate | Max @170 MiB | **Trim duration** | Est. output |
|---|---|---|---|---|---|---|
| `Slant2-calibration-side.MP4` | 235153176 (224.3 MiB) | 6.240 s | 35.94 MiB/s | 4.730 s | **4.49 s** | ~161.5 MiB |
| `Out3-calibration-side.MP4` | 335818780 (320.3 MiB) | 8.640 s | 37.07 MiB/s | 4.586 s | **4.36 s** | ~161.5 MiB |
| `Comeback5-calibration-side.MP4` | 302263424 (288.3 MiB) | 7.679 s | 37.54 MiB/s | 4.529 s | **4.30 s** | ~161.5 MiB |

All three masters are 3840×2160 per Drive `videoMediaMetadata`.

Each trim duration exceeds `MAX_WINDOW_SECONDS = 3.0`, so the analysis window sits
**strictly interior** to the trim in every case, as the schema requires.

### Choosing in-points

The in-point is operator-set — the trim must contain the route action, and I cannot
see the frames. Generate a contact sheet per master to pick it:

```bash
ffmpeg -i "$MASTER" -vf "fps=2,scale=480:-1,tile=6x4" -frames:v 1 /tmp/sheet_$(basename "$MASTER" .MP4).png
```

Constraint: `IN + trim_duration` must not exceed master duration. Usable in-point
ranges: Slant2 `0 – 1.75 s`, Out3 `0 – 4.28 s`, Comeback5 `0 – 3.38 s`.

---

## 2. The three invocations

```bash
# --- Slant2 (side) ---
MASTER="Slant2-calibration-side.MP4"
OUT="slant2-side-trim-v1.MP4"
ffmpeg -ss <IN> -i "$MASTER" -t 4.49 -c copy -map 0 -avoid_negative_ts make_zero "$OUT"

# --- Out3 (side) ---
MASTER="Out3-calibration-side.MP4"
OUT="out3-side-trim-v1.MP4"
ffmpeg -ss <IN> -i "$MASTER" -t 4.36 -c copy -map 0 -avoid_negative_ts make_zero "$OUT"

# --- Comeback5 (side) ---
MASTER="Comeback5-calibration-side.MP4"
OUT="comeback5-side-trim-v1.MP4"
ffmpeg -ss <IN> -i "$MASTER" -t 4.30 -c copy -map 0 -avoid_negative_ts make_zero "$OUT"
```

`-c copy` = stream copy, no re-encode: pixels are the camera's, so `body_based_ppy`
measures the camera and not a transcode. `-map 0` keeps every stream so the artifact
stays a faithful excerpt. `-avoid_negative_ts make_zero` rebases timestamps to zero
so `start_seconds` is trim-relative, which is what `athlete_uploads.start_seconds`
expects.

**`-ss` before `-i` with `-c copy` seeks to the keyframe at or before `<IN>`.** The
actual cut point will differ from the requested one. That is expected and is exactly
why the readback in §3 records *observed* values rather than requested ones.

---

## 3. Readback — run per output, record the results

```bash
OUT="slant2-side-trim-v1.MP4"   # repeat per file

# (a) size, must be < 178257920 bytes (170 MiB)
stat -c '%s %n' "$OUT"

# (b) content hash for provenance.post_trim_sha256
sha256sum "$OUT"

# (c) dimensions / codec / profile — must equal the master on all three
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name,profile,r_frame_rate,nb_frames \
  -of default=noprint_wrappers=1 "$OUT"

# (d) actual start timestamp and duration after keyframe snap
ffprobe -v error -show_entries format=duration,size,start_time \
  -of default=noprint_wrappers=1 "$OUT"

# (e) same probe on the master, for the equality comparison in (c)
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,codec_name,profile \
  -of default=noprint_wrappers=1 "$MASTER"

# (f) ffmpeg build string for provenance.ffmpeg_version
ffmpeg -version | head -1
```

**Halt conditions.** Any of these means do not append and do not upload:

- (a) ≥ 178257920 bytes — over budget; reduce duration and re-cut.
- (c) width/height ≠ 3840×2160, or codec/profile ≠ master — the trim did **not**
  stream-copy. Re-encode is not permitted at intake.
- (d) duration long enough to push size over budget despite the estimate.

---

## 4. Provenance, pre-filled

Master-side fields are populated from Drive metadata retrieved 2026-08-24.
`<OPERATOR>` fields come from §2–§3. Field semantics in `_schema.md`.

```yaml
# Slant2 (side)
provenance:
  source_file_id: "1wQtgf63FXYgkKvYxQzOvEMLdZI9F2Xxe"
  source_file_name: "Slant2-calibration-side.MP4"
  source_bytes: 235153176
  source_sha256: "24925f0e0f705044c106ecce5cf7e367"
  source_hash_algo: drive_md5
  trim_in: "<OPERATOR: HH:MM:SS.mmm, master-relative, observed>"
  trim_out: "<OPERATOR: HH:MM:SS.mmm, master-relative, observed>"
  trim_command: 'ffmpeg -ss <IN> -i "$MASTER" -t 4.49 -c copy -map 0 -avoid_negative_ts make_zero "$OUT"'
  ffmpeg_version: "<OPERATOR: §3(f)>"
  trim_mode: stream_copy
  post_trim_bytes: <OPERATOR: §3(a)>
  post_trim_sha256: "<OPERATOR: §3(b)>"
  post_trim_verified:
    dimensions: "3840x2160"
    codec: "<OPERATOR: §3(c)>"
    profile: "<OPERATOR: §3(c)>"
  analysis_window:
    start_seconds: <OPERATOR: strictly interior, >0>
    end_seconds: <OPERATOR: start + <=3.0, strictly < post-trim duration>
    master_equivalent_start: <OPERATOR: trim_in + start_seconds>
    master_equivalent_end: <OPERATOR: trim_in + end_seconds>

# Out3 (side)
provenance:
  source_file_id: "1ZNUE-1DdWkuJ_ubPw8ysFsMoAK45hjGg"
  source_file_name: "Out3-calibration-side.MP4"
  source_bytes: 335818780
  source_sha256: "114b538b255c00bf730e88b512c5551e"
  source_hash_algo: drive_md5
  trim_command: 'ffmpeg -ss <IN> -i "$MASTER" -t 4.36 -c copy -map 0 -avoid_negative_ts make_zero "$OUT"'
  trim_mode: stream_copy
  # remaining fields as above

# Comeback5 (side)
provenance:
  source_file_id: "1hkhVD34vZglPAari-_pz3hk-40gvD1wj"
  source_file_name: "Comeback5-calibration-side.MP4"
  source_bytes: 302263424
  source_sha256: "88b0eaff16c800483ff1fa27cfe8f141"
  source_hash_algo: drive_md5
  trim_command: 'ffmpeg -ss <IN> -i "$MASTER" -t 4.30 -c copy -map 0 -avoid_negative_ts make_zero "$OUT"'
  trim_mode: stream_copy
  # remaining fields as above
```

---

## 5. What is still held

- **Upload / analysis (step 2)** — held. The trimmed artifacts are shelf-stable;
  they can be cut now and analyzed after the F-POSE-1 fix lands.
- **`ground-truth.yaml` appends** — held. No entry is written until a
  post-fix `body_based_ppy` exists for it, per the admissibility ruling in
  [`F-POSE-1`](../risk-register/F-POSE-1-process-wide-video-mode-landmarker-leaks-tracking-state-across-requests.md).
- **Route wiring** — held.
