"""MediaPipe Pose Landmarker wrapper. 33 landmarks per frame.

Module-level singleton: one PoseLandmarker is constructed eagerly on first
`get_engine()` call (typically warmed at FastAPI startup) and reused for the
container's lifetime. Running mode is VIDEO for sequential-frame speed and
landmark stability; callers must pass monotonically non-decreasing
timestamps to `detect()`.

Model selection: defaults to Full (higher Yoga mAP for dynamic motion).
Set POSE_MODEL_PATH=/app/models/pose_landmarker_lite.task to revert without
a rebuild.
"""
from __future__ import annotations

import os
import threading
from dataclasses import dataclass, field

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL_PATH = os.getenv("POSE_MODEL_PATH", "/app/models/pose_landmarker_full.task")
LANDMARK_COUNT = 33


@dataclass
class PoseFrame:
    """Per-frame pose result.

    `keypoints` / `scores` are in pixel coords of the (possibly cropped) input
    frame — the long-standing 2D pipeline contract.

    `world_keypoints` are BlazePose GHUM 3D landmarks in **meters**, with the
    **origin at the midpoint of the hips** (see
    `docs/investigations/world-landmark-feasibility-research.md` §2.1). They
    come from the same `PoseLandmarkerResult` as `keypoints` at zero extra
    inference cost. Captured here in PHASE-2A-SLICE-B1; not yet plumbed
    through `AnalyzeResponse` (B2) or consumed by any metric (B3).
    Defaults to a zero-filled 33×3 list when the frame had no detection so
    downstream consumers can assume shape stability.
    """
    detected: bool = False
    keypoints: list[list[float]] = field(
        default_factory=lambda: [[0.0, 0.0] for _ in range(LANDMARK_COUNT)]
    )
    scores: list[float] = field(
        default_factory=lambda: [0.0 for _ in range(LANDMARK_COUNT)]
    )
    world_keypoints: list[list[float]] = field(
        default_factory=lambda: [[0.0, 0.0, 0.0] for _ in range(LANDMARK_COUNT)]
    )


class PoseEngine:
    """MediaPipe PoseLandmarker (VIDEO mode), constructed eagerly."""

    def __init__(
        self,
        model_path: str = MODEL_PATH,
        image_mode: bool = False,
        min_detection_confidence: float = 0.5,
    ) -> None:
        # F-POSE-1: one engine per request (VIDEO) so tracking state and the
        # timestamp clock never leak between requests or from auto-zoom probes.
        # image_mode=True builds a stateless IMAGE-mode landmarker (probes /
        # frame recovery) whose detect() ignores timestamps.
        self.model_path = model_path
        self.image_mode = image_mode
        base_options = mp_python.BaseOptions(model_asset_path=model_path)
        options = mp_vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=mp_vision.RunningMode.IMAGE if image_mode else mp_vision.RunningMode.VIDEO,
            num_poses=1,
            min_pose_detection_confidence=min_detection_confidence,
            min_pose_presence_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self._landmarker = mp_vision.PoseLandmarker.create_from_options(options)
        # Monotonic timestamp counter for callers that don't supply one
        # (VIDEO mode requires non-decreasing timestamps across detect calls).
        self._next_ts_ms = 0
        self._ts_lock = threading.Lock()

    def close(self) -> None:
        landmarker = getattr(self, "_landmarker", None)
        if landmarker is not None:
            landmarker.close()
            self._landmarker = None

    def __enter__(self) -> "PoseEngine":
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    def reserve_timestamp_range(self, n_frames: int, fps: float) -> int:
        """Atomically reserve a contiguous timestamp range for a batch of frames.

        Returns the base timestamp (ms). Callers should compute per-frame
        timestamps as `base + i * frame_interval_ms`. This guarantees global
        monotonicity across requests on the same landmarker instance, which
        VIDEO mode requires for the entire lifetime of the PoseLandmarker.
        """
        if fps <= 0:
            fps = 1.0
        frame_interval_ms = max(1, int(round(1000 / fps)))
        with self._ts_lock:
            base = self._next_ts_ms
            self._next_ts_ms = base + max(0, n_frames) * frame_interval_ms
        return base

    def detect(self, frame_bgr: np.ndarray, timestamp_ms: int | None = None) -> PoseFrame:
        if timestamp_ms is None:
            with self._ts_lock:
                timestamp_ms = self._next_ts_ms
                self._next_ts_ms += 1
        else:
            # Keep the auto-counter ahead of any externally-supplied timestamp
            # so subsequent default-timestamp calls remain monotonic.
            with self._ts_lock:
                if timestamp_ms >= self._next_ts_ms:
                    self._next_ts_ms = timestamp_ms + 1

        h, w = frame_bgr.shape[:2]
        rgb = np.ascontiguousarray(frame_bgr[:, :, ::-1])
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        if self.image_mode:
            result = self._landmarker.detect(mp_image)
        else:
            result = self._landmarker.detect_for_video(mp_image, timestamp_ms)

        pose_landmarks = result.pose_landmarks
        if not pose_landmarks:
            return PoseFrame(detected=False)

        landmarks = pose_landmarks[0]
        kps: list[list[float]] = []
        scs: list[float] = []
        for lm in landmarks:
            kps.append([float(lm.x) * w, float(lm.y) * h])
            scs.append(float(getattr(lm, "visibility", 0.0)))

        # World landmarks (PHASE-2A-SLICE-B1): meters, hip-centered, from the
        # same PoseLandmarkerResult. Defensive against older mediapipe builds
        # that may omit the attribute or return an empty list.
        wkps: list[list[float]] = []
        world_landmarks_all = getattr(result, "pose_world_landmarks", None) or []
        if world_landmarks_all:
            for lm in world_landmarks_all[0]:
                wkps.append([float(lm.x), float(lm.y), float(lm.z)])

        # Defensive padding/truncation to LANDMARK_COUNT
        while len(kps) < LANDMARK_COUNT:
            kps.append([0.0, 0.0])
            scs.append(0.0)
        while len(wkps) < LANDMARK_COUNT:
            wkps.append([0.0, 0.0, 0.0])
        return PoseFrame(
            detected=True,
            keypoints=kps[:LANDMARK_COUNT],
            scores=scs[:LANDMARK_COUNT],
            world_keypoints=wkps[:LANDMARK_COUNT],
        )


# --- Module-level singleton ---------------------------------------------------

_ENGINE: PoseEngine | None = None
_ENGINE_LOCK = threading.Lock()


def get_engine() -> PoseEngine:
    """Lazily construct and return the process-wide PoseEngine singleton."""
    global _ENGINE
    if _ENGINE is None:
        with _ENGINE_LOCK:
            if _ENGINE is None:
                _ENGINE = PoseEngine()
    return _ENGINE


def run_with_skip(
    engine: PoseEngine,
    frames: list[np.ndarray],
    det_frequency: int,
    fps: float,
) -> list[PoseFrame]:
    """Run pose detection every det_frequency-th frame; forward-fill in between.

    Timestamps passed to MediaPipe are derived from frame index and fps and are
    monotonically non-decreasing across detect calls (required by VIDEO mode).
    """
    if det_frequency < 1:
        det_frequency = 1
    if fps <= 0:
        fps = 1.0

    frame_interval_ms = max(1, int(round(1000 / fps)))
    base = engine.reserve_timestamp_range(len(frames), fps)

    results: list[PoseFrame] = []
    last: PoseFrame = PoseFrame(detected=False)
    for i, frame in enumerate(frames):
        if i % det_frequency == 0:
            timestamp_ms = base + i * frame_interval_ms
            last = engine.detect(frame, timestamp_ms)
        results.append(last)
    return results


RECOVERY_MIN_DETECTION_CONFIDENCE = 0.3


def _detect_on_crop(probe: "PoseEngine", frame: np.ndarray, crop: dict[str, int] | None) -> PoseFrame:
    """Detect on a crop (upscaled to frame size) and map landmarks back to frame coords."""
    if not crop:
        return probe.detect(frame)
    import cv2

    h, w = frame.shape[:2]
    x0, y0, cw, ch = crop["x"], crop["y"], crop["w"], crop["h"]
    resized = cv2.resize(frame[y0:y0 + ch, x0:x0 + cw], (w, h), interpolation=cv2.INTER_LINEAR)
    pf = probe.detect(resized)
    if not pf.detected:
        return pf
    sx, sy = cw / float(w), ch / float(h)
    return PoseFrame(
        detected=True,
        keypoints=[[x * sx + x0, y * sy + y0] for x, y in pf.keypoints],
        scores=pf.scores[:],
        world_keypoints=[row[:] for row in pf.world_keypoints],  # metres, not pixel space
    )


def recover_frames(
    frames: list[np.ndarray],
    results: list[PoseFrame],
    width: int,
    height: int,
    max_factor: float,
    zoom_crop: dict[str, int] | None,
    athlete_h: float | None,
    earliest_probe: tuple[int, tuple[float, float]] | None,
) -> tuple[list[int], list[int], list[int], list[dict]]:
    """Leading-frame recovery + following crop, both on athlete-sized crops of the
    ORIGINAL frames through a separate stateless IMAGE-mode engine (the main VIDEO
    tracker is never touched). `results` are in original coordinates and are
    mutated in place.

    Returns (leading_recovered, follow_attempted, follow_recovered, attempts)."""
    from . import framing

    def summary(pf: PoseFrame) -> tuple[float, tuple[float, float]] | None:
        if not pf.detected:
            return None
        h = framing.athlete_height(pf.keypoints, pf.scores)
        hip = framing.hip_center(pf.keypoints, pf.scores)
        return (h, hip) if h is not None and hip is not None else None

    def is_target(pf: PoseFrame) -> bool:
        if not pf.detected:
            return True
        visible = sum(1 for s in pf.scores if s >= framing.MIN_VIS)
        if visible < framing.MIN_VISIBLE_SHARE * len(pf.scores):
            return True
        b = framing.bbox(pf.keypoints, pf.scores)
        return b is None or framing.box_touches_rect(b, zoom_crop)

    attempts: list[dict] = []
    leading_rec: list[int] = []
    good_h = [s[0] for s in (summary(r) for r in results if not is_target(r)) if s]
    ref_h = framing.median(good_h) or athlete_h

    with PoseEngine(image_mode=True, min_detection_confidence=RECOVERY_MIN_DETECTION_CONFIDENCE) as probe:
        def attempt(i: int, rect: dict[str, int]) -> PoseFrame | None:
            pf = _detect_on_crop(probe, frames[i], rect)
            return pf if pf.detected else None

        # 1) Leading run: crop around the earliest detected or probed position.
        leading = framing.leading_missed_run([not is_target(r) for r in results])
        if leading and ref_h:
            first_det = next(((i, summary(r)[1]) for i, r in enumerate(results)
                              if not is_target(r) and summary(r)), None)
            anchors = [a for a in (first_det, earliest_probe) if a is not None]
            if anchors:
                anchor_frame, anchor = min(anchors, key=lambda a: a[0])
                rect = framing.recovery_crop(anchor, ref_h, width, height, max_factor)
                for i in leading:
                    pf = attempt(i, rect)
                    got = summary(pf) if pf else None
                    ok = got is not None and framing.accept_recovery(
                        got[0], got[1], anchor, ref_h, max(1, abs(i - anchor_frame))
                    )
                    attempts.append({"frame": i, "kind": "leading", "crop": rect, "recovered": ok})
                    if ok and pf is not None:
                        results[i] = pf
                        leading_rec.append(i)

        # 2) Following crop for every later lost / partial / crop-edge frame.
        detected = [None if is_target(r) else summary(r) for r in results]
        targets = [i for i, r in enumerate(results) if is_target(r) and i not in leading_rec]
        found: dict[int, PoseFrame] = {}

        def try_detect(i: int, rect: dict[str, int]):
            pf = attempt(i, rect)
            if pf is None:
                return None
            found[i] = pf
            return summary(pf)

        follow = framing.plan_follow(detected, targets, width, height, max_factor, try_detect)
        for a in follow:
            if a["recovered"]:
                results[a["frame"]] = found[a["frame"]]
        attempts.extend(follow)

    return (
        leading_rec,
        [a["frame"] for a in follow],
        [a["frame"] for a in follow if a["recovered"]],
        attempts,
    )


def reject_partial_detections(
    results: list[PoseFrame], width: int, height: int
) -> tuple[dict[int, str], dict[int, dict[str, float | None]]]:
    """Mark cut-off / implausible detections as not detected (zeroed).

    Pass 1: per-frame checks (edge clipping, too few landmarks). Pass 2: height
    and hip vs the median of nearby accepted frames on both sides, iterated so a
    rejected frame never serves as a reference. Returns ({index: reason},
    {index: pre-rejection {height_px, hip_x, hip_y}})."""
    from . import framing

    rejected: dict[int, str] = {}
    details: dict[int, dict[str, float | None]] = {}
    series: list[tuple[float, tuple[float, float] | None] | None] = []

    def snapshot(pf: PoseFrame) -> dict[str, float | None]:
        hip = framing.hip_center(pf.keypoints, pf.scores)
        h = framing.athlete_height(pf.keypoints, pf.scores)
        return {
            "height_px": round(h, 2) if h is not None else None,
            "hip_x": round(hip[0], 2) if hip else None,
            "hip_y": round(hip[1], 2) if hip else None,
        }

    for i, pf in enumerate(results):
        if not pf.detected:
            series.append(None)
            continue
        reason = framing.validate_frame(pf.keypoints, pf.scores, width, height, None, None)
        if reason is not None:
            rejected[i] = reason
            series.append(None)
            continue
        h = framing.athlete_height(pf.keypoints, pf.scores)
        series.append((h, framing.hip_center(pf.keypoints, pf.scores)) if h else None)

    rejected.update(framing.robust_validate(series))
    for i in rejected:
        details[i] = snapshot(results[i])
        results[i] = PoseFrame(detected=False)
    return rejected, details
