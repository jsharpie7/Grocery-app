import { describe, it, expect } from 'vitest'
import { matchItem } from '../lib/itemMatcher'
import type { Item } from '../lib/supabase'

function makeItem(name: string): Item {
  return { id: name, household_id: 'hh', name, category: 'Other', created_at: '' }
}

describe('matchItem', () => {
  const items = [
    makeItem('Whole Milk'),
    makeItem('Buttermilk'),
    makeItem('Eggs'),
    makeItem('Organic Baby Spinach'),
  ]

  it('returns null for empty candidates', () => {
    expect(matchItem('Milk', [])).toBeNull()
  })

  it('exact match (case-insensitive)', () => {
    const result = matchItem('whole milk', items)
    expect(result?.name).toBe('Whole Milk')
  })

  it('exact match with different casing', () => {
    const result = matchItem('EGGS', items)
    expect(result?.name).toBe('Eggs')
  })

  it('substring match >= 5 chars', () => {
    const result = matchItem('Baby Spinach', items)
    expect(result?.name).toBe('Organic Baby Spinach')
  })

  it('does NOT match "milk" to "Buttermilk" (4 chars < 5 minimum)', () => {
    const result = matchItem('milk', items)
    // "milk" is 4 chars — should NOT match "Buttermilk" via substring
    // It WILL match "Whole Milk" via exact normalized check: "milk" != "whole milk"
    // So it falls to substring: 4 chars < 5 → no substring match → null
    expect(result).toBeNull()
  })

  it('does NOT match short 4-char candidate to longer item', () => {
    const result = matchItem('eggs', items)
    // "eggs" exact matches "Eggs" — this is the exact match path
    expect(result?.name).toBe('Eggs')
  })

  it('returns null for no match', () => {
    expect(matchItem('Frozen Pizza', items)).toBeNull()
  })

  it('does NOT match "milk" to "Buttermilk" when "Whole Milk" not present', () => {
    const limited = [makeItem('Buttermilk')]
    const result = matchItem('milk', limited)
    expect(result).toBeNull()
  })
})
