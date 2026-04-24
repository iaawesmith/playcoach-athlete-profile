"""Pydantic models matching the Edge Function CloudRunResponse contract exactly."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    video_url: str
    start_seconds: float = 0.0
    end_seconds: float
    # Accepted-but-ignored in v1 (kept for request-shape parity with the Edge Function).
    solution_class: str | None = None
    performance_mode: str | None = "balanced"
    det_frequency: int = Field(default=2, ge=1, le=10)
    tracking_enabled: bool = True


class CropRect(BaseModel):
    x: int
    y: int
    w: int
    h: int


class Padding(BaseModel):
    top: int
    bottom: int
    left: int
    right: int


class ProgressUpdate(BaseModel):
    message: str
    frame: int
    total_frames: int
    detection_every_n: int


class AnalyzeResponse(BaseModel):
    # Pose payload — outer person array length is 1 for single-athlete clips.
    keypoints: list[list[list[list[float]]]]
    scores: list[list[list[float]]]
    frame_count: int
    fps: float

    # Calibration
    pixels_per_yard: float | None = None
    calibration_source: Literal["body_based", "none"] = "body_based"
    calibration_confidence: Literal["high", "medium", "low", "none"] = "low"
    calibration_details: dict[str, Any] = Field(default_factory=dict)

    # Auto-zoom
    auto_zoom_applied: bool = False
    auto_zoom_reason: str | None = None
    auto_zoom_factor: float = 1.0
    auto_zoom_final_fill_ratio: float = 0.0
    auto_zoom_crop_rect: CropRect | None = None
    auto_zoom_padding: Padding | None = None

    # Motion
    movement_direction: Literal["left_to_right", "right_to_left", "stationary"] = "stationary"
    movement_confidence: float = 0.0

    # Quality / safety
    person_detection_confidence: float = 0.0
    safety_backoff_applied: bool = False
    athlete_framing_message: str | None = None
    mean_keypoint_confidence_before_auto_zoom: float = 0.0
    mean_keypoint_confidence_after_auto_zoom: float = 0.0

    progress_updates: list[ProgressUpdate] = Field(default_factory=list)
