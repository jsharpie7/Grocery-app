import { describe, it, expect } from 'vitest'
import { computeScale } from '../lib/gemini'

// Receipts are tall and narrow, so horizontal resolution is what decides legibility.
// Scaling by the longest edge (the previous behaviour) crushed portrait photos.
const px = (n: number, scale: number) => Math.round(n * scale)

describe('computeScale', () => {
  it('caps a portrait phone photo on width, not on the longest edge', () => {
    const scale = computeScale(3024, 4032)
    expect(px(3024, scale)).toBe(1600)
    // Old longest-edge behaviour produced 1200px wide; this must be strictly better.
    expect(px(3024, scale)).toBeGreaterThan(1200)
  })

  it('leaves an already-narrow photo untouched', () => {
    expect(computeScale(1284, 2778)).toBe(1)
    expect(computeScale(800, 1400)).toBe(1)
  })

  it('still shrinks a wide landscape photo to the width cap', () => {
    const scale = computeScale(4032, 3024)
    expect(px(4032, scale)).toBe(1600)
  })

  it('falls back to the pixel budget for extreme aspect ratios', () => {
    // A very tall stitched panorama would blow the payload budget on height alone.
    const scale = computeScale(1500, 12000)
    expect(px(1500, scale) * px(12000, scale)).toBeLessThanOrEqual(6_000_000)
    expect(scale).toBeLessThan(1)
  })

  it('never scales up', () => {
    expect(computeScale(100, 100)).toBe(1)
  })

  it('is safe on degenerate dimensions', () => {
    expect(computeScale(0, 0)).toBe(1)
  })
})

describe('computeScale — app-download receipts', () => {
  it('leaves a Walmart app receipt download untouched', () => {
    // 554x806 grayscale PNG, ~12px glyph height: small in pixels but perfectly crisp.
    // It must not be resized, and (see downscaleImage) must not be re-encoded to JPEG either,
    // which previously tripled it to 118 KB and smeared the text.
    expect(computeScale(554, 806)).toBe(1)
  })
})
