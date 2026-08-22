import { describe, it, expect } from 'vitest'
import { findDuplicateStore } from '../hooks/useStores'
import type { Store } from '../lib/supabase'

function makeStore(id: string, name: string): Store {
  return { id, household_id: 'hh', name, color: '#6366f1', created_at: '' }
}

const stores = [
  makeStore('s1', 'Costco'),
  makeStore('s2', 'Whole Foods'),
]

describe('findDuplicateStore', () => {
  it('finds an exact name match', () => {
    expect(findDuplicateStore('Costco', stores)?.id).toBe('s1')
  })

  it('finds a match differing only by case', () => {
    // The original UNIQUE(household_id, name) was case-sensitive, so "costco"
    // and "Costco" could both exist. This check mirrors the new CI index.
    expect(findDuplicateStore('costco', stores)?.id).toBe('s1')
    expect(findDuplicateStore('COSTCO', stores)?.id).toBe('s1')
  })

  it('finds a match differing only by surrounding whitespace', () => {
    expect(findDuplicateStore('  Costco  ', stores)?.id).toBe('s1')
  })

  it('returns null when there is no collision', () => {
    expect(findDuplicateStore('Publix', stores)).toBeNull()
  })

  // REGRESSION: without excludeId, re-saving a store you are editing collides
  // with itself, so changing only its colour would be rejected.
  it('excludes the store being edited', () => {
    expect(findDuplicateStore('Costco', stores, 's1')).toBeNull()
  })

  it('still catches a collision with a different store while editing', () => {
    // Renaming Whole Foods (s2) to Costco must still be blocked.
    expect(findDuplicateStore('Costco', stores, 's2')?.id).toBe('s1')
  })

  it('treats an empty or whitespace-only name as no collision', () => {
    // The caller disables save on empty input; this just avoids matching
    // every store when the field is blank.
    expect(findDuplicateStore('', stores)).toBeNull()
    expect(findDuplicateStore('   ', stores)).toBeNull()
  })

  it('returns null against an empty store list', () => {
    expect(findDuplicateStore('Costco', [])).toBeNull()
  })
})
