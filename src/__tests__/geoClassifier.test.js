/**
 * Unit tests for LexiSight geometric classifier utilities
 * Covers: dist2D, isExtended, finger geometry helpers
 */

import { describe, it, expect } from 'vitest'
import { dist2D, isExtended } from '../utils/geoClassifier.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal 21-point landmark array where all points are at origin */
function makeLandmarks(overrides = {}) {
  const lm = Array.from({ length: 21 }, (_, i) => ({ x: 0, y: 0, z: 0, ...overrides[i] }))
  return lm
}

// ── dist2D ───────────────────────────────────────────────────────────────────

describe('dist2D', () => {
  it('returns 0 for identical points', () => {
    expect(dist2D({ x: 3, y: 4 }, { x: 3, y: 4 })).toBe(0)
  })

  it('returns correct Euclidean distance (3-4-5 triangle)', () => {
    expect(dist2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 5)
  })

  it('is symmetric', () => {
    const a = { x: 1, y: 2 }
    const b = { x: 4, y: 6 }
    expect(dist2D(a, b)).toBeCloseTo(dist2D(b, a), 10)
  })

  it('handles negative coordinates', () => {
    expect(dist2D({ x: -3, y: -4 }, { x: 0, y: 0 })).toBeCloseTo(5, 5)
  })
})

// ── isExtended ────────────────────────────────────────────────────────────────

describe('isExtended', () => {
  it('returns false for null landmarks', () => {
    expect(isExtended(null, 8, 6)).toBe(false)
  })

  it('returns false for landmark array shorter than 21', () => {
    expect(isExtended([{ x: 0, y: 0 }], 8, 6)).toBe(false)
  })

  it('returns true when tip is far from base (finger extended)', () => {
    // Build a realistic hand: lm[5] and lm[17] are palm-width apart (0.1),
    // index tip (lm[8]) is far from its base (lm[5])
    const lm = makeLandmarks({
      5:  { x: 0.0, y: 0.5 },   // index MCP  (also palm ref point)
      17: { x: 0.1, y: 0.5 },   // pinky MCP  — palm width ≈ 0.1
      8:  { x: 0.05, y: 0.0 },  // index tip  — extended upward
      5:  { x: 0.05, y: 0.5 },  // same as above (baseIdx for tip 8 is 8-3=5)
    })
    // Manually set to force clear geometry
    lm[5]  = { x: 0.0, y: 0.5 }
    lm[17] = { x: 0.1, y: 0.5 }   // palm width = 0.1
    lm[8]  = { x: 0.05, y: 0.0 }  // tip far up
    lm[5]  = { x: 0.05, y: 0.5 }  // base (tipIdx - 3 = 8 - 3 = 5)
    // dist(tip, base) = dist({0.05,0.0}, {0.05,0.5}) = 0.5
    // palmWidth = 0.1; threshold = 0.1 * 0.95 = 0.095 → 0.5 > 0.095 ✓
    expect(isExtended(lm, 8, 6)).toBe(true)
  })

  it('returns false when tip is close to base (finger curled)', () => {
    const lm = makeLandmarks()
    lm[5]  = { x: 0.0, y: 0.5 }  // index MCP (also base for tip 8)
    lm[17] = { x: 0.1, y: 0.5 }  // pinky MCP — palm width = 0.1
    lm[8]  = { x: 0.01, y: 0.5 } // tip very close to base → curled
    // dist(tip, base) = 0.01; threshold = 0.095 → 0.01 < 0.095 ✗
    expect(isExtended(lm, 8, 6)).toBe(false)
  })
})

// ── Smoke test: module exports ─────────────────────────────────────────────────

describe('geoClassifier exports', () => {
  it('exports dist2D as a function', () => {
    expect(typeof dist2D).toBe('function')
  })

  it('exports isExtended as a function', () => {
    expect(typeof isExtended).toBe('function')
  })
})
