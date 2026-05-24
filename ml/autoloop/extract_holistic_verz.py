#!/usr/bin/env python3
"""
Manifest-driven holistic landmark extractor for verZ-Plus.

Reads manifest_verz_plus_missing.csv and extracts 30-frame, 225-d
(pose 33 + left hand 21 + right hand 21) landmark sequences using
the MediaPipe Tasks HolisticLandmarker (model: holistic_landmarker.task).

Idempotent: skips rows whose target .npy already exists.
Multi-process: spawns N workers, each with its own HolisticLandmarker.

Usage:
    python ml/autoloop/extract_holistic_verz.py
    python ml/autoloop/extract_holistic_verz.py --workers 4
    python ml/autoloop/extract_holistic_verz.py --limit 5 --source emergency
    python ml/autoloop/extract_holistic_verz.py --include-oracle
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import cv2
import numpy as np

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

PROCESSED = BASE / "ml" / "data_processed"
MISSING_MANIFEST = PROCESSED / "manifest_verz_plus_missing.csv"
ORACLE_MANIFEST = PROCESSED / "manifest_verz_plus_oracle.csv"
MODEL_PATH = BASE / "ml" / "mediapipe_models" / "holistic_landmarker.task"

SEQ_LEN = 30
POSE_COUNT = 33
HAND_COUNT = 21
FEATURE_DIM = (POSE_COUNT + 2 * HAND_COUNT) * 3  # 225

SOURCE_TO_DIR = {
    "include": "holistic",
    "cislr": "cislr_holistic",
    "daily": "daily_holistic",
    "emergency": "emergency_holistic",
}

# IMAGE mode = stateless detect; resize to fixed frame height so the
# segmentation smoothing calculator never sees mismatched shapes.
_TARGET_HEIGHT = 480
_landmarker = None


def _make_landmarker():
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import (
        HolisticLandmarker,
        HolisticLandmarkerOptions,
        RunningMode,
    )

    options = HolisticLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL_PATH)),
        running_mode=RunningMode.IMAGE,
        min_pose_detection_confidence=0.4,
        min_pose_landmarks_confidence=0.4,
        min_hand_landmarks_confidence=0.4,
    )
    return HolisticLandmarker.create_from_options(options)


def _init_worker():
    """Each worker keeps a single landmarker for its lifetime."""
    os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
    os.environ.setdefault("GLOG_minloglevel", "3")
    global _landmarker
    _landmarker = _make_landmarker()


def _landmarks_to_array(landmarks) -> np.ndarray | None:
    if landmarks is None:
        return None
    try:
        return np.array([[lm.x, lm.y, lm.z] for lm in landmarks], dtype=np.float32)
    except Exception:
        return None


def _normalize_pose(pts: np.ndarray) -> np.ndarray:
    if pts.shape[0] < 25:
        return pts
    hip_center = (pts[23] + pts[24]) / 2.0
    pts = pts - hip_center
    shoulder = np.linalg.norm(pts[11] - pts[12])
    if shoulder > 0.01:
        pts = pts / shoulder
    return pts


def _normalize_hand(pts: np.ndarray) -> np.ndarray:
    if pts.shape[0] < 10:
        return pts
    pts = pts - pts[0]
    palm = np.linalg.norm(pts[9])
    if palm > 1e-3:
        pts = pts / palm
    return pts


def _extract_one(job):
    video_path, out_path = job
    try:
        if Path(out_path).exists():
            return ("skip", video_path)

        import mediapipe as mp

        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            return ("fail_open", video_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        if total < 5:
            cap.release()
            return ("fail_short", video_path)

        sample_indices = np.linspace(0, total - 1, SEQ_LEN, dtype=int)
        wanted = {int(i): k for k, i in enumerate(sample_indices)}

        seq = np.zeros((SEQ_LEN, FEATURE_DIM), dtype=np.float32)
        landmarker = _landmarker  # worker-global, loaded once in _init_worker

        frame_idx = 0
        ret, frame = cap.read()
        while ret:
            if frame_idx in wanted:
                # Resize to fixed height so worker state never sees mismatched frames
                h, w = frame.shape[:2]
                if h != _TARGET_HEIGHT:
                    new_w = max(1, int(round(w * _TARGET_HEIGHT / max(h, 1))))
                    frame = cv2.resize(
                        frame, (new_w, _TARGET_HEIGHT), interpolation=cv2.INTER_AREA
                    )
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                try:
                    res = landmarker.detect(mp_image)
                except Exception:
                    res = None

                vec = np.zeros(FEATURE_DIM, dtype=np.float32)
                if res is not None:
                    pose_pts = _landmarks_to_array(getattr(res, "pose_landmarks", None))
                    if pose_pts is not None and pose_pts.shape[0] == POSE_COUNT:
                        pose_pts = _normalize_pose(pose_pts)
                        vec[: POSE_COUNT * 3] = pose_pts.flatten()
                    lh_pts = _landmarks_to_array(getattr(res, "left_hand_landmarks", None))
                    if lh_pts is not None and lh_pts.shape[0] == HAND_COUNT:
                        lh_pts = _normalize_hand(lh_pts)
                        vec[POSE_COUNT * 3 : (POSE_COUNT + HAND_COUNT) * 3] = lh_pts.flatten()
                    rh_pts = _landmarks_to_array(getattr(res, "right_hand_landmarks", None))
                    if rh_pts is not None and rh_pts.shape[0] == HAND_COUNT:
                        rh_pts = _normalize_hand(rh_pts)
                        vec[(POSE_COUNT + HAND_COUNT) * 3 :] = rh_pts.flatten()

                seq[wanted[frame_idx]] = vec
            frame_idx += 1
            ret, frame = cap.read()
        cap.release()

        # Forward-fill all-zero frames
        last = None
        for i in range(SEQ_LEN):
            if np.abs(seq[i]).sum() > 0:
                last = seq[i]
            elif last is not None:
                seq[i] = last

        out_p = Path(out_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        np.save(out_p, seq)
        return ("ok", video_path)
    except Exception as exc:
        return ("error", f"{Path(video_path).name}: {type(exc).__name__}: {exc}")


def _build_jobs(manifest_path: Path, source_filter: str | None, limit: int) -> list:
    jobs = []
    with open(manifest_path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            src = row.get("source", "")
            if source_filter and src != source_filter:
                continue
            sub = SOURCE_TO_DIR.get(src)
            if sub is None:
                continue
            stem = Path(row["video_path"]).stem
            out = PROCESSED / sub / row["class"] / f"{stem}.npy"
            if out.exists():
                continue
            video = BASE / row["video_path"]
            if not video.exists():
                continue
            jobs.append((str(video), str(out)))
            if limit and len(jobs) >= limit:
                break
    return jobs


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", default=str(MISSING_MANIFEST))
    p.add_argument("--workers", type=int, default=4)
    p.add_argument("--limit", type=int, default=0)
    p.add_argument(
        "--source",
        default=None,
        choices=[None, "include", "daily", "emergency", "cislr"],
    )
    p.add_argument("--include-oracle", action="store_true")
    args = p.parse_args()

    if not MODEL_PATH.exists():
        print(f"!! Missing MediaPipe model at {MODEL_PATH}")
        return 1

    manifests = [Path(args.manifest)]
    if args.include_oracle and ORACLE_MANIFEST.exists():
        manifests.append(ORACLE_MANIFEST)

    jobs = []
    for m in manifests:
        if not m.exists():
            print(f"!! Missing manifest {m}")
            continue
        remaining = (args.limit - len(jobs)) if args.limit else 0
        jobs.extend(_build_jobs(m, args.source, remaining))
        if args.limit and len(jobs) >= args.limit:
            break

    if not jobs:
        print("Nothing to extract.")
        return 0

    print(f"Workers: {args.workers}   Jobs: {len(jobs)}")
    t0 = time.time()
    counts: dict[str, int] = {}
    last_log = t0

    with Pool(args.workers, initializer=_init_worker) as pool:
        for i, (status, info) in enumerate(pool.imap_unordered(_extract_one, jobs), 1):
            counts[status] = counts.get(status, 0) + 1
            now = time.time()
            if now - last_log >= 30 or i == len(jobs):
                rate = i / max(now - t0, 1e-3)
                eta = (len(jobs) - i) / max(rate, 1e-3)
                ok = counts.get("ok", 0)
                skip = counts.get("skip", 0)
                err = sum(v for k, v in counts.items() if k not in {"ok", "skip"})
                print(
                    f"  {i:5d}/{len(jobs)}  "
                    f"ok={ok} skip={skip} err={err}  "
                    f"{rate:.2f}/s  eta={eta/60:.1f} min"
                )
                last_log = now
    dt = time.time() - t0
    print()
    print(f"Done in {dt/60:.1f} min   {counts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
