from __future__ import annotations

from dataclasses import asdict, dataclass
from statistics import median
from typing import Sequence
import numpy as np


@dataclass(frozen=True)
class BoundingBox:
    x: float
    y: float
    width: float
    height: float
    confidence: float
    frame_index: int | None = None

    @property
    def x2(self) -> float:
        return self.x + self.width

    @property
    def y2(self) -> float:
        return self.y + self.height

    @property
    def center_x(self) -> float:
        return self.x + (self.width / 2.0)

    @property
    def center_y(self) -> float:
        return self.y + (self.height / 2.0)


@dataclass(frozen=True)
class DirectionEstimate:
    horizontal: str
    vertical: str
    confidence: float
    dx: float
    dy: float


@dataclass(frozen=True)
class CoordinateTransform:
    scale_x: float
    scale_y: float
    offset_x: float
    offset_y: float
    applied: bool


@dataclass(frozen=True)
class AutoZoomDecision:
    enabled: bool
    reason: str
    target_person_confidence: float | None
    original_person_fill_ratio: float | None
    target_fill_ratio: float
    final_fill_ratio: float | None
    zoom_factor: float | None
    crop_rect_original: dict[str, int] | None
    padding_applied: dict[str, int] | None
    movement_direction: str | None
    movement_confidence: float | None
    safety_backoff_applied: bool
    transform: dict[str, float]
    athlete_message: str

    def to_metadata(self) -> dict[str, object]:
        return asdict(self)


def clip_bbox_to_frame(box: BoundingBox, frame_width: int, frame_height: int) -> BoundingBox:
    x = max(0.0, min(box.x, float(frame_width - 1)))
    y = max(0.0, min(box.y, float(frame_height - 1)))
    x2 = max(x + 1.0, min(box.x2, float(frame_width)))
    y2 = max(y + 1.0, min(box.y2, float(frame_height)))
    return BoundingBox(x=x, y=y, width=x2 - x, height=y2 - y, confidence=box.confidence, frame_index=box.frame_index)


def bbox_union(boxes: Sequence[BoundingBox]) -> BoundingBox | None:
    if not boxes:
        return None
    min_x = min(box.x for box in boxes)
    min_y = min(box.y for box in boxes)
    max_x = max(box.x2 for box in boxes)
    max_y = max(box.y2 for box in boxes)
    confidence = sum(box.confidence for box in boxes) / len(boxes)
    return BoundingBox(min_x, min_y, max_x - min_x, max_y - min_y, confidence)


def build_union_motion_bbox(boxes: Sequence[BoundingBox], frame_width: int, frame_height: int) -> tuple[BoundingBox | None, bool]:
    union_box = bbox_union(boxes)
    if union_box is None:
        return None, False

    clipped = clip_bbox_to_frame(union_box, frame_width, frame_height)
    area_samples = [max(box.width * box.height, 1.0) for box in boxes]
    median_area = median(area_samples)
    union_area = clipped.width * clipped.height
    stable_area_samples = [area for area in area_samples if area <= (median_area * 2.4)]
    minimum_consistent_frames = 2 if len(area_samples) <= 4 else 3
    unstable = union_area > (median_area * 7.8) and len(stable_area_samples) >= minimum_consistent_frames
    return clipped, unstable


def estimate_motion_direction(boxes: Sequence[BoundingBox], frame_width: int, frame_height: int) -> DirectionEstimate:
    if len(boxes) < 2:
        return DirectionEstimate(horizontal='static', vertical='static', confidence=0.0, dx=0.0, dy=0.0)

    ordered = sorted(boxes, key=lambda box: box.frame_index if box.frame_index is not None else 0)
    dx = ordered[-1].center_x - ordered[0].center_x
    dy = ordered[-1].center_y - ordered[0].center_y
    normalized_dx = dx / max(frame_width, 1)
    normalized_dy = dy / max(frame_height, 1)
    short_clip_boost = 1.18 if len(ordered) <= 4 else 1.0
    magnitude = min(1.0, ((abs(normalized_dx) * 1.9) + (abs(normalized_dy) * 1.35)) * short_clip_boost)
    horizontal = 'right' if dx > 0 else 'left' if dx < 0 else 'static'
    vertical = 'down' if dy > 0 else 'up' if dy < 0 else 'static'
    horizontal_static_threshold = 0.015 if len(ordered) <= 4 else 0.02
    vertical_static_threshold = 0.015 if len(ordered) <= 4 else 0.02
    if abs(normalized_dx) < horizontal_static_threshold:
        horizontal = 'static'
    if abs(normalized_dy) < vertical_static_threshold:
        vertical = 'static'
    return DirectionEstimate(horizontal=horizontal, vertical=vertical, confidence=magnitude, dx=dx, dy=dy)


def build_coordinate_transform(
    crop_rect: dict[str, int] | None,
    original_size: tuple[int, int],
    output_size: tuple[int, int] | None = None,
) -> CoordinateTransform:
    original_width, original_height = original_size
    if not crop_rect or not output_size:
        return CoordinateTransform(scale_x=1.0, scale_y=1.0, offset_x=0.0, offset_y=0.0, applied=False)

    output_width, output_height = output_size
    crop_width = max(float(crop_rect['width']), 1.0)
    crop_height = max(float(crop_rect['height']), 1.0)
    if output_width <= 0 or output_height <= 0 or original_width <= 0 or original_height <= 0:
        return CoordinateTransform(scale_x=1.0, scale_y=1.0, offset_x=0.0, offset_y=0.0, applied=False)

    return CoordinateTransform(
        scale_x=crop_width / float(output_width),
        scale_y=crop_height / float(output_height),
        offset_x=float(crop_rect['x']),
        offset_y=float(crop_rect['y']),
        applied=True,
    )


def map_points_to_original_space(
    keypoints: Sequence[Sequence[Sequence[float]]],
    transform: CoordinateTransform,
) -> list[list[list[float]]]:
    if not transform.applied:
        return [[list(point) for point in frame] for frame in keypoints]

    remapped: list[list[list[float]]] = []
    for frame in keypoints:
        remapped_frame: list[list[float]] = []
        for point in frame:
            if len(point) < 2:
                remapped_frame.append(list(point))
                continue
            x = (float(point[0]) * transform.scale_x) + transform.offset_x
            y = (float(point[1]) * transform.scale_y) + transform.offset_y
            tail = [float(value) for value in point[2:]]
            remapped_frame.append([x, y, *tail])
        remapped.append(remapped_frame)
    return remapped


def map_bbox_to_original_space(box: BoundingBox, transform: CoordinateTransform) -> BoundingBox:
    if not transform.applied:
        return box
    return BoundingBox(
        x=(box.x * transform.scale_x) + transform.offset_x,
        y=(box.y * transform.scale_y) + transform.offset_y,
        width=box.width * transform.scale_x,
        height=box.height * transform.scale_y,
        confidence=box.confidence,
        frame_index=box.frame_index,
    )


def apply_crop_and_resize(frame: np.ndarray, crop_rect: dict[str, int], output_size: tuple[int, int]) -> np.ndarray:
    import cv2

    x, y, width, height = crop_rect['x'], crop_rect['y'], crop_rect['width'], crop_rect['height']
    cropped = frame[y : y + height, x : x + width]
    output_width, output_height = output_size
    return cv2.resize(cropped, (output_width, output_height), interpolation=cv2.INTER_CUBIC)


def _expand_with_padding(
    union_box: BoundingBox,
    movement: DirectionEstimate,
    frame_width: int,
    frame_height: int,
    minimum_padding_ratio: float,
) -> tuple[float, float, float, float]:
    min_pad_x = max(frame_width * minimum_padding_ratio, union_box.width * minimum_padding_ratio)
    min_pad_y = max(frame_height * minimum_padding_ratio, union_box.height * minimum_padding_ratio)

    left = min_pad_x
    right = min_pad_x
    top = min_pad_y
    bottom = min_pad_y

    directional_x = union_box.width * max(0.12, movement.confidence * 0.22)
    directional_y = union_box.height * max(0.08, movement.confidence * 0.16)

    if movement.horizontal == 'right':
        right += directional_x
    elif movement.horizontal == 'left':
        left += directional_x

    if movement.vertical == 'down':
        bottom += directional_y
    elif movement.vertical == 'up':
        top += directional_y

    return left, right, top, bottom


def _fit_crop_to_aspect(
    base_x1: float,
    base_y1: float,
    base_x2: float,
    base_y2: float,
    frame_width: int,
    frame_height: int,
    aspect_ratio: float,
) -> tuple[float, float, float, float]:
    width = base_x2 - base_x1
    height = base_y2 - base_y1
    current_ratio = width / max(height, 1.0)
    center_x = (base_x1 + base_x2) / 2.0
    center_y = (base_y1 + base_y2) / 2.0

    if current_ratio > aspect_ratio:
        target_height = width / aspect_ratio
        height = target_height
    else:
        target_width = height * aspect_ratio
        width = target_width

    x1 = center_x - (width / 2.0)
    x2 = center_x + (width / 2.0)
    y1 = center_y - (height / 2.0)
    y2 = center_y + (height / 2.0)

    if x1 < 0:
        x2 -= x1
        x1 = 0
    if y1 < 0:
        y2 -= y1
        y1 = 0
    if x2 > frame_width:
        overflow = x2 - frame_width
        x1 -= overflow
        x2 = frame_width
    if y2 > frame_height:
        overflow = y2 - frame_height
        y1 -= overflow
        y2 = frame_height

    return max(0.0, x1), max(0.0, y1), min(float(frame_width), x2), min(float(frame_height), y2)


def _apply_extremity_safety(
    crop_rect: dict[str, int],
    union_box: BoundingBox,
    frame_width: int,
    frame_height: int,
) -> tuple[dict[str, int], bool]:
    safe_crop = dict(crop_rect)
    safety_backoff = False
    limb_margin_x = int(max(union_box.width * 0.14, frame_width * 0.028))
    limb_margin_y = int(max(union_box.height * 0.155, frame_height * 0.032))

    desired_x1 = max(0, int(union_box.x - limb_margin_x))
    desired_y1 = max(0, int(union_box.y - limb_margin_y))
    desired_x2 = min(frame_width, int(union_box.x2 + limb_margin_x))
    desired_y2 = min(frame_height, int(union_box.y2 + limb_margin_y))

    crop_x1 = safe_crop['x']
    crop_y1 = safe_crop['y']
    crop_x2 = safe_crop['x'] + safe_crop['width']
    crop_y2 = safe_crop['y'] + safe_crop['height']

    left_cut_ratio = max(0.0, (crop_x1 - desired_x1) / max(float(limb_margin_x), 1.0))
    top_cut_ratio = max(0.0, (crop_y1 - desired_y1) / max(float(limb_margin_y), 1.0))
    right_cut_ratio = max(0.0, (desired_x2 - crop_x2) / max(float(limb_margin_x), 1.0))
    bottom_cut_ratio = max(0.0, (desired_y2 - crop_y2) / max(float(limb_margin_y), 1.0))

    if left_cut_ratio > 0.15:
        crop_x1 = desired_x1
        safety_backoff = True
    if top_cut_ratio > 0.15:
        crop_y1 = desired_y1
        safety_backoff = True
    if right_cut_ratio > 0.15:
        crop_x2 = desired_x2
        safety_backoff = True
    if bottom_cut_ratio > 0.15:
        crop_y2 = desired_y2
        safety_backoff = True

    safe_crop['x'] = max(0, crop_x1)
    safe_crop['y'] = max(0, crop_y1)
    safe_crop['width'] = min(frame_width, crop_x2) - safe_crop['x']
    safe_crop['height'] = min(frame_height, crop_y2) - safe_crop['y']
    return safe_crop, safety_backoff


def compute_auto_zoom_crop(
    tracked_boxes: Sequence[BoundingBox],
    frame_width: int,
    frame_height: int,
    target_fill_ratio_range: tuple[float, float] = (0.62, 0.72),
    minimum_padding_ratio: float = 0.15,
) -> AutoZoomDecision:
    base_message = (
        'I analyzed the original video without reframing because the athlete could not be isolated confidently enough for a safe crop.'
    )
    if not tracked_boxes:
        identity = build_coordinate_transform(None, (frame_width, frame_height), None)
        return AutoZoomDecision(
            enabled=False,
            reason='auto_zoom_skipped_no_reliable_person',
            target_person_confidence=None,
            original_person_fill_ratio=None,
            target_fill_ratio=target_fill_ratio_range[0],
            final_fill_ratio=None,
            zoom_factor=None,
            crop_rect_original=None,
            padding_applied=None,
            movement_direction=None,
            movement_confidence=None,
            safety_backoff_applied=False,
            transform=asdict(identity),
            athlete_message=base_message,
        )

    tracked_boxes = [clip_bbox_to_frame(box, frame_width, frame_height) for box in tracked_boxes]
    person_confidence = sum(box.confidence for box in tracked_boxes) / len(tracked_boxes)
    union_box, unstable = build_union_motion_bbox(tracked_boxes, frame_width, frame_height)
    identity = build_coordinate_transform(None, (frame_width, frame_height), None)
    if union_box is None or person_confidence < 0.28 or unstable:
        reason = 'auto_zoom_skipped_unstable_motion_envelope' if unstable else 'auto_zoom_skipped_low_person_confidence'
        return AutoZoomDecision(
            enabled=False,
            reason=reason,
            target_person_confidence=round(person_confidence, 4),
            original_person_fill_ratio=None if union_box is None else round(union_box.height / frame_height, 4),
            target_fill_ratio=target_fill_ratio_range[0],
            final_fill_ratio=None if union_box is None else round(union_box.height / frame_height, 4),
            zoom_factor=None,
            crop_rect_original=None,
            padding_applied=None,
            movement_direction=None,
            movement_confidence=None,
            safety_backoff_applied=False,
            transform=asdict(identity),
            athlete_message=base_message,
        )

    original_fill_ratio = union_box.height / max(frame_height, 1)
    if original_fill_ratio >= 0.55:
        return AutoZoomDecision(
            enabled=False,
            reason='auto_zoom_skipped_already_well_framed',
            target_person_confidence=round(person_confidence, 4),
            original_person_fill_ratio=round(original_fill_ratio, 4),
            target_fill_ratio=target_fill_ratio_range[0],
            final_fill_ratio=round(original_fill_ratio, 4),
            zoom_factor=1.0,
            crop_rect_original=None,
            padding_applied=None,
            movement_direction='static',
            movement_confidence=0.0,
            safety_backoff_applied=False,
            transform=asdict(identity),
            athlete_message='Your framing looked strong, so analysis used the original video as-is.',
        )

    target_fill_ratio = sum(target_fill_ratio_range) / 2.0
    desired_crop_height = max(union_box.height / target_fill_ratio, union_box.height)
    desired_crop_width = desired_crop_height * (frame_width / max(frame_height, 1))
    movement = estimate_motion_direction(tracked_boxes, frame_width, frame_height)
    left_pad, right_pad, top_pad, bottom_pad = _expand_with_padding(
        union_box,
        movement,
        frame_width,
        frame_height,
        minimum_padding_ratio,
    )

    base_x1 = union_box.x - left_pad
    base_y1 = union_box.y - top_pad
    base_x2 = union_box.x2 + right_pad
    base_y2 = union_box.y2 + bottom_pad

    center_x = (base_x1 + base_x2) / 2.0
    center_y = (base_y1 + base_y2) / 2.0
    base_width = max(base_x2 - base_x1, desired_crop_width)
    base_height = max(base_y2 - base_y1, desired_crop_height)
    base_x1 = center_x - (base_width / 2.0)
    base_x2 = center_x + (base_width / 2.0)
    base_y1 = center_y - (base_height / 2.0)
    base_y2 = center_y + (base_height / 2.0)

    crop_x1, crop_y1, crop_x2, crop_y2 = _fit_crop_to_aspect(
        base_x1,
        base_y1,
        base_x2,
        base_y2,
        frame_width,
        frame_height,
        aspect_ratio=frame_width / max(frame_height, 1),
    )

    crop_rect = {
        'x': int(round(crop_x1)),
        'y': int(round(crop_y1)),
        'width': int(round(crop_x2 - crop_x1)),
        'height': int(round(crop_y2 - crop_y1)),
    }
    crop_rect, safety_backoff = _apply_extremity_safety(crop_rect, union_box, frame_width, frame_height)
    transform = build_coordinate_transform(crop_rect, (frame_width, frame_height), (frame_width, frame_height))
    final_fill_ratio = union_box.height / max(crop_rect['height'], 1)
    zoom_factor = frame_height / max(crop_rect['height'], 1)

    padding_applied = {
        'top': max(0, int(round(union_box.y - crop_rect['y']))),
        'bottom': max(0, int(round((crop_rect['y'] + crop_rect['height']) - union_box.y2))),
        'left': max(0, int(round(union_box.x - crop_rect['x']))),
        'right': max(0, int(round((crop_rect['x'] + crop_rect['width']) - union_box.x2))),
    }
    movement_label = movement.horizontal if movement.horizontal != 'static' else movement.vertical
    return AutoZoomDecision(
        enabled=True,
        reason='auto_zoom_applied',
        target_person_confidence=round(person_confidence, 4),
        original_person_fill_ratio=round(original_fill_ratio, 4),
        target_fill_ratio=round(target_fill_ratio, 4),
        final_fill_ratio=round(final_fill_ratio, 4),
        zoom_factor=round(zoom_factor, 4),
        crop_rect_original=crop_rect,
        padding_applied=padding_applied,
        movement_direction=movement_label,
        movement_confidence=round(movement.confidence, 4),
        safety_backoff_applied=safety_backoff,
        transform=asdict(transform),
        athlete_message='Your video was a little far away, so I zoomed in and adjusted the framing to get a clearer read on your movement. For even better results next time, try filming from about 10–15 yards away with your full body in frame.',
    )


def select_main_athlete_track(detections_by_frame: Sequence[Sequence[BoundingBox]]) -> list[BoundingBox]:
    if not detections_by_frame:
        return []

    selected: list[BoundingBox] = []
    previous_center_x: float | None = None
    previous_center_y: float | None = None
    for frame_index, detections in enumerate(detections_by_frame):
        if not detections:
            continue

        def sort_key(box: BoundingBox) -> tuple[float, float, float]:
            area = box.width * box.height
            tracking_bonus = 0.0
            if previous_center_x is not None and previous_center_y is not None:
                distance = abs(box.center_x - previous_center_x) + abs(box.center_y - previous_center_y)
                tracking_bonus = -distance
            return (box.confidence, area, tracking_bonus)

        chosen = max(detections, key=sort_key)
        selected.append(BoundingBox(
            x=chosen.x,
            y=chosen.y,
            width=chosen.width,
            height=chosen.height,
            confidence=chosen.confidence,
            frame_index=chosen.frame_index if chosen.frame_index is not None else frame_index,
        ))
        previous_center_x = chosen.center_x
        previous_center_y = chosen.center_y
    return selected


def as_bbox_detection(raw_box: Sequence[float], confidence: float, frame_index: int) -> BoundingBox:
    x1, y1, x2, y2 = [float(value) for value in raw_box[:4]]
    return BoundingBox(
        x=x1,
        y=y1,
        width=max(1.0, x2 - x1),
        height=max(1.0, y2 - y1),
        confidence=float(confidence),
        frame_index=frame_index,
    )


def summarize_log_lines(decision: AutoZoomDecision) -> list[str]:
    lines = []
    if decision.target_person_confidence is not None:
        lines.append(f'Person detection confidence: {decision.target_person_confidence:.2f}')
    if decision.enabled and decision.zoom_factor is not None:
        lines.append(
            f'Auto-Zoom applied: {decision.zoom_factor:.2f}x '
            f'(athlete filled {(decision.original_person_fill_ratio or 0) * 100:.0f}% → {(decision.final_fill_ratio or 0) * 100:.0f}% of frame)'
        )
        if decision.padding_applied:
            padding = decision.padding_applied
            lines.append(
                f"Padding applied: top={padding['top']}px, bottom={padding['bottom']}px, left={padding['left']}px, right={padding['right']}px"
            )
        if decision.movement_direction and decision.movement_confidence is not None:
            lines.append(f'Movement direction: {decision.movement_direction} (confidence {decision.movement_confidence:.2f})')
        lines.append(
            'Safety backoff applied: '
            + ('true — reduced crop to preserve extremities' if decision.safety_backoff_applied else 'false')
        )
    else:
        lines.append(decision.reason)
    lines.append(
        'Coordinate transform: '
        + ', '.join(f'{key}={value}' for key, value in decision.transform.items() if key != 'applied')
    )
    return lines