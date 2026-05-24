#!/usr/bin/env python3
"""Extract 30-frame hand landmarks for manifest_verz videos (non-oracle train + oracle eval)."""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

import cv2
import numpy as np

BASE = Path(__file__).parent.parent.parent
sys.path.insert(0, str(BASE))

SEQ_LEN = 30
FEAT = 126


def extract_clip(video_path: Path) -> np.ndarray | None:
    """Sample SEQ_LEN frames, MediaPipe-style placeholder using opencv only if mediapipe missing."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
    if total < 5:
        cap.release()
        return None
    indices = np.linspace(0, max(total - 1, 0), SEQ_LEN, dtype=int)
    frames = []
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
        ret, frame = cap.read()
        if not ret:
            continue
        frames.append(frame)
    cap.release()
    if len(frames) < 5:
        return None
    try:
        from mediapipe.tasks import python
        from mediapipe.tasks.python import vision
        model = BASE / "ml/assets/hand_landmarker.task"
        if not model.exists():
            model = BASE / "scripts/hand_landmarker.task"
        opts = vision.HandLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(model)),
            num_hands=2,
        )
        detector = vision.HandLandmarker.create_from_options(opts)
        seq = np.zeros((SEQ_LEN, FEAT), dtype=np.float32)
        for i, frame in enumerate(frames[:SEQ_LEN]):
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_img = __import__("mediapipe").Image(
                image_format=__import__("mediapipe").ImageFormat.SRGB, data=rgb
            )
            res = detector.detect(mp_img)
            vec = np.zeros(FEAT, dtype=np.float32)
            if res.hand_landmarks:
                for hi, hand in enumerate(res.hand_landmarks[:2]):
                    off = hi * 63
                    for j, lm in enumerate(hand):
                        vec[off + j * 3] = lm.x
                        vec[off + j * 3 + 1] = lm.y
                        vec[off + j * 3 + 2] = lm.z
            seq[i] = vec
        while len(frames) < SEQ_LEN:
            seq[len(frames)] = seq[len(frames) - 1]
            frames.append(frames[-1])
        return seq.reshape(SEQ_LEN, 2, 21, 3)
    except Exception as e:
        print(f"  mediapipe skip {video_path.name}: {e}")
        return None


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", default="ml/data_processed/manifest_verz.csv")
    p.add_argument("--limit", type=int, default=0)
    p.add_argument("--oracle-only", action="store_true")
    args = p.parse_args()

    manifest = BASE / args.manifest
    if not manifest.exists():
        print("Run build_manifest_verz.py first")
        return 1

    done = skip = 0
    with open(manifest, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if args.oracle_only:
        rows = [r for r in rows if r.get("is_oracle") == "1"]
    if args.limit:
        rows = rows[: args.limit]

    for row in rows:
        vp = BASE / row["video_path"]
        out = BASE / "ml/data_processed" / row["source"] / row["class"] / f"{vp.stem}.npy"
        out.parent.mkdir(parents=True, exist_ok=True)
        row["clip_path"] = str(out.relative_to(BASE / "ml/data_processed"))
        if out.exists():
            skip += 1
            continue
        clip = extract_clip(vp)
        if clip is None:
            continue
        np.save(out, clip)
        done += 1
        if done % 50 == 0:
            print(f"  extracted {done}...")

    print(f"Done: {done} new, {skip} skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
