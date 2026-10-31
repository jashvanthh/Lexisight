/**
 * Unit tests for holisticFeatures.js
 * Covers: HOLISTIC_DIM constant, handsToHolisticVector shape contract
 *
 * API: handsToHolisticVector(rawLeft, rawRight)
 *   - rawLeft/rawRight: array of {x,y,z} landmarks (21 points) or null
 *   - returns Float32Array of length HOLISTIC_DIM (225)
 *   - pose section (first 99 values) is always zeros (no pose input)
 *   - left hand fills positions 99–161, right hand fills 162–224
 */

import { describe, it, expect } from 'vitest'
import {
  HOLISTIC_DIM,
  POSE_COUNT,
  HAND_COUNT,
  handsToHolisticVector,
} from '../utils/holisticFeatures.js'

// Helper: create N fake landmarks with varied values (not all identical)
const variedLandmarks = (n, scale = 1) =>
  Array.from({ length: n }, (_, i) => ({
    x: (i % 5) * scale * 0.05,
    y: Math.floor(i / 5) * scale * 0.05,
    z: i * scale * 0.01,
  }))

describe('holisticFeatures constants', () => {
  it('POSE_COUNT is 33', () => expect(POSE_COUNT).toBe(33))
  it('HAND_COUNT is 21', () => expect(HAND_COUNT).toBe(21))
  it('HOLISTIC_DIM equals (33 + 2*21) * 3 = 225', () => {
    expect(HOLISTIC_DIM).toBe((33 + 2 * 21) * 3)
    expect(HOLISTIC_DIM).toBe(225)
  })
})

describe('handsToHolisticVector', () => {
  it('returns a Float32Array of length HOLISTIC_DIM', () => {
    const vec = handsToHolisticVector(variedLandmarks(21), variedLandmarks(21, 2))
    expect(vec).toBeInstanceOf(Float32Array)
    expect(vec.length).toBe(HOLISTIC_DIM)
  })

  it('returns all zeros when both inputs are null', () => {
    const vec = handsToHolisticVector(null, null)
    expect(vec.length).toBe(HOLISTIC_DIM)
    expect(vec.every(v => v === 0)).toBe(true)
  })

  it('returns all zeros when called with no arguments', () => {
    const vec = handsToHolisticVector()
    expect(vec.length).toBe(HOLISTIC_DIM)
  })

  it('contains only finite values', () => {
    const vec = handsToHolisticVector(variedLandmarks(21), variedLandmarks(21, 2))
    expect(vec.every(v => isFinite(v))).toBe(true)
  })

  it('hand section is non-zero when a valid hand is provided', () => {
    const left = variedLandmarks(21, 1)
    const vec = handsToHolisticVector(left, null)
    // Left hand occupies POSE_COUNT*3 .. (POSE_COUNT+HAND_COUNT)*3
    const leftSlice = Array.from(vec.slice(POSE_COUNT * 3, (POSE_COUNT + HAND_COUNT) * 3))
    expect(leftSlice.some(v => v !== 0)).toBe(true)
  })

  it('right hand section is non-zero when right hand is provided', () => {
    const right = variedLandmarks(21, 2)
    const vec = handsToHolisticVector(null, right)
    const rightSlice = Array.from(vec.slice((POSE_COUNT + HAND_COUNT) * 3))
    expect(rightSlice.some(v => v !== 0)).toBe(true)
  })

  it('left-only and right-only outputs occupy different positions in the vector', () => {
    const hand = variedLandmarks(21, 1)
    const leftOnly  = handsToHolisticVector(hand, null)
    const rightOnly = handsToHolisticVector(null, hand)
    // Left hand → positions POSE_COUNT*3 to (POSE_COUNT+HAND_COUNT)*3 - 1
    // Right hand → positions (POSE_COUNT+HAND_COUNT)*3 to end
    const leftSection  = Array.from(leftOnly.slice(POSE_COUNT * 3, (POSE_COUNT + HAND_COUNT) * 3))
    const rightSection = Array.from(rightOnly.slice((POSE_COUNT + HAND_COUNT) * 3))
    // Left-only: left section nonzero, right section zero
    expect(leftSection.some(v => v !== 0)).toBe(true)
    expect(Array.from(leftOnly.slice((POSE_COUNT + HAND_COUNT) * 3)).every(v => v === 0)).toBe(true)
    // Right-only: right section nonzero, left section zero
    expect(rightSection.some(v => v !== 0)).toBe(true)
    expect(Array.from(rightOnly.slice(POSE_COUNT * 3, (POSE_COUNT + HAND_COUNT) * 3)).every(v => v === 0)).toBe(true)
  })
})
