import { describe, it, expect } from 'vitest'
import { matchItem } from '../lib/itemMatcher'
import type { Item } from '../lib/supabase'

function makeItem(name: string, item_number: string | null = null): Item {
  return { id: name, household_id: 'hh', name, item_number, category: 'Other', created_at: '' }
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
    expect(matchItem('whole milk', items)?.name).toBe('Whole Milk')
  })

  it('exact match with different casing', () => {
    expect(matchItem('EGGS', items)?.name).toBe('Eggs')
  })

  it('returns null for no match', () => {
    expect(matchItem('Frozen Pizza', items)).toBeNull()
  })

  it('matches on item number ahead of any name', () => {
    const byNumber = [makeItem('Turkey Bacon', '399571'), makeItem('Bacon')]
    expect(matchItem('Anything At All', byNumber, '399571')?.name).toBe('Turkey Bacon')
  })
})

describe('matchItem truncation', () => {
  // Registers cut names off at the end, so a shortened receipt name is a
  // prefix of the full one.
  const items = [makeItem('Purely Elizabeth Granola'), makeItem('Manchego Cheese')]

  it('matches a receipt name that is a truncation of the catalog name', () => {
    expect(matchItem('Purely Elizabeth', items)?.name).toBe('Purely Elizabeth Granola')
  })

  it('matches in the other direction too', () => {
    const catalog = [makeItem('Manchego')]
    expect(matchItem('Manchego Cheese', catalog)?.name).toBe('Manchego')
  })

  it('requires the prefix to end on a word boundary', () => {
    // "Chip" must not reach "Chipotle Sauce" — that is a different word.
    expect(matchItem('Chipo', [makeItem('Chipotle Sauce')])).toBeNull()
  })

  it('refuses to choose when several catalog items share the prefix', () => {
    const chickens = [
      makeItem('Chicken Breast'),
      makeItem('Chicken Sticks'),
      makeItem('Chicken Sausage'),
    ]
    // "Chicken" could be any of them. A guess here attributes real money to
    // the wrong product, so it stays unmatched and the review screen marks it.
    expect(matchItem('Chicken', chickens)).toBeNull()
  })

  it('still matches when only one of several shares the prefix', () => {
    const items2 = [makeItem('Chicken Breast'), makeItem('Turkey Bacon')]
    expect(matchItem('Chicken', items2)?.name).toBe('Chicken Breast')
  })
})

describe('matchItem rejects modifier collisions', () => {
  // Every case here is a real mis-match taken from live data. Catalog names
  // carry their modifier at the FRONT, so a containment test reads a generic
  // word as whichever specific product happens to contain it.
  const catalog = [
    makeItem('Turkey Bacon'),
    makeItem('Almond Butter'),
    makeItem('Frozen Strawberries'),
    makeItem('Green Apples'),
    makeItem('Yellow Onions'),
    makeItem('Dixie Plates'),
    makeItem('Eli’s Pizza'),
    makeItem('Turkey Pepperoni'),
    makeItem('Org Baby Carrots'),
    makeItem('Yellow Corn Chips'),
    makeItem('Organic Baby Spinach'),
  ]

  const collisions: [string, string][] = [
    ['Bacon', 'Turkey Bacon'],
    ['Butter', 'Almond Butter'],
    ['Strawberries', 'Frozen Strawberries'],
    ['Apples', 'Green Apples'],
    ['Onions', 'Yellow Onions'],
    ['Plates', 'Dixie Plates'],
    ['Pizza', 'Eli’s Pizza'],
    ['Pepper', 'Turkey Pepperoni'],
    ['Carrots', 'Org Baby Carrots'],
    ['Corn Chips', 'Yellow Corn Chips'],
    ['Baby Spinach', 'Organic Baby Spinach'],
  ]

  for (const [receiptName, wouldHaveMatched] of collisions) {
    it(`does not match "${receiptName}" to "${wouldHaveMatched}"`, () => {
      expect(matchItem(receiptName, catalog)).toBeNull()
    })
  }

  it('does not match a specific receipt name into a generic catalog entry', () => {
    // "Frozen Blueberries" is not the same product as plain "Blueberries".
    expect(matchItem('Frozen Blueberries', [makeItem('Blueberries')])).toBeNull()
  })

  it('does not match "milk" to "Buttermilk"', () => {
    expect(matchItem('milk', [makeItem('Buttermilk')])).toBeNull()
  })
})
