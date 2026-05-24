/** Pack pose + hands into 225-d vector (matches ml/autoloop/extract_holistic_verz.py). */

export const POSE_COUNT = 33
export const HAND_COUNT = 21
export const HOLISTIC_DIM = (POSE_COUNT + 2 * HAND_COUNT) * 3 // 225

function toPoints(landmarks) {
  if (!landmarks?.length) return null
  const pts = new Float32Array(landmarks.length * 3)
  for (let i = 0; i < landmarks.length; i++) {
    pts[i * 3] = landmarks[i].x
    pts[i * 3 + 1] = landmarks[i].y
    pts[i * 3 + 2] = landmarks[i].z ?? 0
  }
  return pts
}

function normalizePose(flat) {
  if (flat.length < 25 * 3) return flat
  const out = new Float32Array(flat)
  const hipX = (out[23 * 3] + out[24 * 3]) / 2
  const hipY = (out[23 * 3 + 1] + out[24 * 3 + 1]) / 2
  const hipZ = (out[23 * 3 + 2] + out[24 * 3 + 2]) / 2
  for (let i = 0; i < POSE_COUNT; i++) {
    out[i * 3] -= hipX
    out[i * 3 + 1] -= hipY
    out[i * 3 + 2] -= hipZ
  }
  const sx = out[11 * 3] - out[12 * 3]
  const sy = out[11 * 3 + 1] - out[12 * 3 + 1]
  const sz = out[11 * 3 + 2] - out[12 * 3 + 2]
  const shoulder = Math.sqrt(sx * sx + sy * sy + sz * sz)
  if (shoulder > 0.01) {
    for (let i = 0; i < POSE_COUNT * 3; i++) out[i] /= shoulder
  }
  return out
}

function normalizeHand(flat) {
  if (flat.length < 10 * 3) return flat
  const out = new Float32Array(flat)
  const wx = out[0]
  const wy = out[1]
  const wz = out[2]
  for (let i = 0; i < HAND_COUNT; i++) {
    out[i * 3] -= wx
    out[i * 3 + 1] -= wy
    out[i * 3 + 2] -= wz
  }
  const px = out[9 * 3]
  const py = out[9 * 3 + 1]
  const pz = out[9 * 3 + 2]
  const palm = Math.sqrt(px * px + py * py + pz * pz)
  if (palm > 1e-3) {
    for (let i = 0; i < HAND_COUNT * 3; i++) out[i] /= palm
  }
  return out
}

/**
 * @param {object|null} result — HolisticLandmarkerResult
 * @returns {Float32Array} length 225
 */
export function holisticResultToVector(result) {
  const vec = new Float32Array(HOLISTIC_DIM)
  if (!result) return vec

  const pose = toPoints(result.poseLandmarks?.[0])
  if (pose?.length === POSE_COUNT * 3) {
    vec.set(normalizePose(pose), 0)
  }

  const left = toPoints(result.leftHandLandmarks?.[0])
  if (left?.length === HAND_COUNT * 3) {
    vec.set(normalizeHand(left), POSE_COUNT * 3)
  }

  const right = toPoints(result.rightHandLandmarks?.[0])
  if (right?.length === HAND_COUNT * 3) {
    vec.set(normalizeHand(right), (POSE_COUNT + HAND_COUNT) * 3)
  }

  return vec
}

/** Fallback when only MediaPipe Hands are available (pose zeros). */
export function handsToHolisticVector(rawLeft, rawRight) {
  const vec = new Float32Array(HOLISTIC_DIM)
  const left = toPoints(rawLeft)
  const right = toPoints(rawRight)
  if (left?.length === HAND_COUNT * 3) {
    vec.set(normalizeHand(left), POSE_COUNT * 3)
  }
  if (right?.length === HAND_COUNT * 3) {
    vec.set(normalizeHand(right), (POSE_COUNT + HAND_COUNT) * 3)
  }
  return vec
}
