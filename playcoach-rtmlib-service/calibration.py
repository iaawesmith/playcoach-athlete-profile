from __future__ import annotations

from dataclasses import asdict, dataclass
from statistics import median
from typing import Iterable, Sequence

import math


LEFT_SHOULDER_INDEX = 5
RIGHT_SHOULDER_INDEX = 6
LEFT_HIP_INDEX = 11
RIGHT_HIP_INDEX = 12

EXPECTED_SHOULDER_WIDTH_YARDS = 0.58
EXPECTED_HIP_WIDTH_YARDS = 0.41


@dataclass(frozen=True)
class BodyMeasurementSample:
    frame_index: int
    hip_width_pixels: float | None
    shoulder_width_pixels: float | None
    hip_pixels_per_yard: float | None
    shoulder_pixels_per_yard: float | None
    average_confidence: float


@dataclass(frozen=True)
class ConfidenceWeightedCalibrationResult:
    pixels_per_yard: float | None
    confidence: float
    source: str
    method: str
    details: dict[str, object]

    def to_metadata(self) -> dict[str, object]:
        return asdict(self)


def _distance(a: Sequence[float] | None, b: Sequence[float] | None) -> float | None:
    if not a or not b or len(a) < 2 or len(b) < 2:
        return None
    return math.hypot(float(a[0]) - float(b[0]), float(a[1]) - float(b[1]))


def _score_pair(scores: Sequence[float], left_idx: int, right_idx: int) -> float:
    left = float(scores[left_idx]) if left_idx < len(scores) else 0.0
    right = float(scores[right_idx]) if right_idx < len(scores) else 0.0
    return (left + right) / 2.0


def multi_frame_body_proportions_hips_shoulders(
    keypoints_by_frame: Sequence[Sequence[Sequence[float]]],
    scores_by_frame: Sequence[Sequence[float]],
    minimum_confidence: float = 0.3,
) -> list[BodyMeasurementSample]:
    samples: list[BodyMeasurementSample] = []
    for frame_index, frame_points in enumerate(keypoints_by_frame):
        frame_scores = scores_by_frame[frame_index] if frame_index < len(scores_by_frame) else []
        shoulder_confidence = _score_pair(frame_scores, LEFT_SHOULDER_INDEX, RIGHT_SHOULDER_INDEX)
        hip_confidence = _score_pair(frame_scores, LEFT_HIP_INDEX, RIGHT_HIP_INDEX)
        average_confidence = max(shoulder_confidence, hip_confidence)
        if average_confidence < minimum_confidence:
            continue

        shoulder_width_pixels = _distance(
            frame_points[LEFT_SHOULDER_INDEX] if LEFT_SHOULDER_INDEX < len(frame_points) else None,
            frame_points[RIGHT_SHOULDER_INDEX] if RIGHT_SHOULDER_INDEX < len(frame_points) else None,
        )
        hip_width_pixels = _distance(
            frame_points[LEFT_HIP_INDEX] if LEFT_HIP_INDEX < len(frame_points) else None,
            frame_points[RIGHT_HIP_INDEX] if RIGHT_HIP_INDEX < len(frame_points) else None,
        )

        samples.append(
            BodyMeasurementSample(
                frame_index=frame_index,
                hip_width_pixels=hip_width_pixels,
                shoulder_width_pixels=shoulder_width_pixels,
                hip_pixels_per_yard=None if hip_width_pixels is None else hip_width_pixels / EXPECTED_HIP_WIDTH_YARDS,
                shoulder_pixels_per_yard=None if shoulder_width_pixels is None else shoulder_width_pixels / EXPECTED_SHOULDER_WIDTH_YARDS,
                average_confidence=average_confidence,
            )
        )
    return samples


def compute_confidence_weighted_body_calibration(
    keypoints_by_frame: Sequence[Sequence[Sequence[float]]],
    scores_by_frame: Sequence[Sequence[float]],
    minimum_confidence: float = 0.3,
) -> ConfidenceWeightedCalibrationResult:
    samples = multi_frame_body_proportions_hips_shoulders(
        keypoints_by_frame=keypoints_by_frame,
        scores_by_frame=scores_by_frame,
        minimum_confidence=minimum_confidence,
    )
    if not samples:
        return ConfidenceWeightedCalibrationResult(
            pixels_per_yard=None,
            confidence=0.0,
            source='none',
            method='multi_frame_body_proportions_hips_shoulders',
            details={
                'frames_used': 0,
                'weighted_confidence': 0.0,
                'rejection_reason': 'no_confident_body_measurements',
            },
        )

    weighted_values: list[tuple[float, float]] = []
    shoulder_values: list[float] = []
    hip_values: list[float] = []
    confidences: list[float] = []
    for sample in samples:
        confidences.append(sample.average_confidence)
        if sample.shoulder_pixels_per_yard:
            shoulder_values.append(sample.shoulder_pixels_per_yard)
            weighted_values.append((sample.shoulder_pixels_per_yard, sample.average_confidence))
        if sample.hip_pixels_per_yard:
            hip_values.append(sample.hip_pixels_per_yard)
            weighted_values.append((sample.hip_pixels_per_yard, sample.average_confidence))

    if not weighted_values:
        return ConfidenceWeightedCalibrationResult(
            pixels_per_yard=None,
            confidence=0.0,
            source='none',
            method='multi_frame_body_proportions_hips_shoulders',
            details={
                'frames_used': len(samples),
                'weighted_confidence': 0.0,
                'rejection_reason': 'no_valid_body_widths',
            },
        )

    candidate_values = [value for value, _ in weighted_values]
    median_value = median(candidate_values)
    filtered_pairs = [
        (value, weight)
        for value, weight in weighted_values
        if abs(value - median_value) / max(median_value, 1.0) <= 0.25
    ]
    if not filtered_pairs:
        filtered_pairs = weighted_values

    total_weight = sum(weight for _, weight in filtered_pairs)
    pixels_per_yard = sum(value * weight for value, weight in filtered_pairs) / max(total_weight, 1e-6)
    weighted_confidence = sum(confidences) / len(confidences)

    return ConfidenceWeightedCalibrationResult(
        pixels_per_yard=round(pixels_per_yard, 4),
        confidence=round(weighted_confidence, 4),
        source='body_based',
        method='multi_frame_body_proportions_hips_shoulders',
        details={
            'frames_used': len(samples),
            'weighted_confidence': round(weighted_confidence, 4),
            'shoulder_samples': len(shoulder_values),
            'hip_samples': len(hip_values),
            'median_pixels_per_yard': round(median_value, 4),
            'expected_shoulder_width_yards': EXPECTED_SHOULDER_WIDTH_YARDS,
            'expected_hip_width_yards': EXPECTED_HIP_WIDTH_YARDS,
            'filtered_sample_count': len(filtered_pairs),
        },
    )