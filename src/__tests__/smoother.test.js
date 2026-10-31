/**
 * Unit tests for PredictionSmoother (smoothing.js)
 * Covers: windowed vote, lock mechanism, confidence threshold, reset on gap
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PredictionSmoother } from '../utils/smoothing.js'

// Helper: make a prediction object
const pred = (label, confidence = 0.9, isPreview = false) =>
  ({ label, confidence, isPreview })

describe('PredictionSmoother', () => {
  let smoother

  beforeEach(() => {
    smoother = new PredictionSmoother(5, 0.6, { lockFrames: 3 })
  })

  it('returns null when no predictions added yet', () => {
    expect(smoother.add(null)).toBeNull()
  })

  it('ignores preview predictions and returns null until a real one arrives', () => {
    smoother.add(pred('HELLO', 0.9, true))
    smoother.add(pred('HELLO', 0.9, true))
    expect(smoother.add(pred('HELLO', 0.9, true))).toBeNull()
  })

  it('confirms a label after enough high-confidence votes', () => {
    smoother.add(pred('HELLO', 0.9))
    smoother.add(pred('HELLO', 0.9))
    const result = smoother.add(pred('HELLO', 0.9))
    // enough votes above threshold (0.6) — should confirm HELLO
    expect(result).not.toBeNull()
    expect(result.label).toBe('HELLO')
  })

  it('does not confirm low-confidence predictions', () => {
    // All below threshold 0.6
    smoother.add(pred('HELLO', 0.3))
    smoother.add(pred('HELLO', 0.4))
    const result = smoother.add(pred('HELLO', 0.5))
    expect(result).toBeNull()
  })

  it('holds the confirmed label during the lock period', () => {
    // Confirm HELLO
    smoother.add(pred('HELLO', 0.95))
    smoother.add(pred('HELLO', 0.95))
    smoother.add(pred('HELLO', 0.95))
    // Now try to change — lock should hold HELLO for lockFrames=3 more frames
    const r1 = smoother.add(pred('WORLD', 0.95))
    const r2 = smoother.add(pred('WORLD', 0.95))
    expect(r1?.label).toBe('HELLO')
    expect(r2?.label).toBe('HELLO')
  })

  it('resets history and lastConfirmed after 15+ null frames', () => {
    smoother.add(pred('HELLO', 0.95))
    smoother.add(pred('HELLO', 0.95))
    smoother.add(pred('HELLO', 0.95))
    // 16 null frames = gap
    for (let i = 0; i < 16; i++) smoother.add(null)
    expect(smoother.lastConfirmed).toBeNull()
    expect(smoother.history.length).toBe(0)
  })

  it('window slides — oldest predictions drop out', () => {
    // windowSize=5, fill with HELLO
    for (let i = 0; i < 5; i++) smoother.add(pred('HELLO', 0.9))
    // Now add 5 WORLD predictions to push all HELLOs out
    for (let i = 0; i < 4; i++) smoother.add(pred('WORLD', 0.9))
    const result = smoother.add(pred('WORLD', 0.9))
    expect(result?.label).toBe('WORLD')
  })

  it('respects custom windowSize in constructor', () => {
    const s = new PredictionSmoother(2, 0.5)
    expect(s.windowSize).toBe(2)
    expect(s.threshold).toBe(0.5)
  })
})

