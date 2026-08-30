import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import ItemCard from '../components/receipts/ItemCard'
import ItemEditSheet from '../components/receipts/ItemEditSheet'
import type { PendingLineItem } from '../hooks/useReceipts'

function item(overrides: Partial<PendingLineItem> = {}): PendingLineItem {
  return {
    item_number: null, ocr_name: null, item_name: 'Bananas', quantity: 2, unit: 'ea',
    unit_price: 1.24, total_price: 2.48, category: 'Produce',
    matchedItemId: null, prevAvgPrice: null, ...overrides,
  }
}

function renderSheet(overrides: Partial<PendingLineItem> = {}, props: Partial<{ index: number; order: number[] }> = {}) {
  const onChange = vi.fn()
  const onRemove = vi.fn()
  const onNavigate = vi.fn()
  const onClose = vi.fn()
  render(
    <ItemEditSheet
      item={item(overrides)}
      index={props.index ?? 1}
      order={props.order ?? [0, 1, 2]}
      onChange={onChange}
      onRemove={onRemove}
      onNavigate={onNavigate}
      onClose={onClose}
    />,
  )
  return { onChange, onRemove, onNavigate, onClose }
}

afterEach(cleanup)

describe('ItemEditSheet', () => {
  it('shows where you are in the list so a long receipt stays navigable', () => {
    renderSheet()
    expect(screen.getByText('Item 2 of 3')).toBeInTheDocument()
  })

  it('highlights the whole item name on focus, so one tap lets you retype it', async () => {
    renderSheet()
    const name = screen.getByLabelText('Item name') as HTMLInputElement
    name.focus()
    await waitFor(() => {
      expect(name.selectionStart).toBe(0)
      expect(name.selectionEnd).toBe('Bananas'.length)
    })
  })

  it('highlights the quantity on focus too', async () => {
    renderSheet()
    const qty = screen.getByLabelText('Quantity') as HTMLInputElement
    qty.focus()
    await waitFor(() => {
      expect(qty.selectionStart).toBe(0)
      expect(qty.selectionEnd).toBe('2'.length)
    })
  })

  it('keeps a half-typed price on screen instead of parsing it out from under the caret', () => {
    renderSheet()
    const unit = screen.getByLabelText('Unit price ($)') as HTMLInputElement
    fireEvent.change(unit, { target: { value: '1.' } })
    expect(unit.value).toBe('1.')
  })

  it('settles a price back to two decimals once the field is left', () => {
    renderSheet({ unit_price: 8.4, total_price: 84.7 })
    expect((screen.getByLabelText('Unit price ($)') as HTMLInputElement).value).toBe('8.40')
    expect((screen.getByLabelText('Line total ($)') as HTMLInputElement).value).toBe('84.70')
  })

  it('ignores keystrokes that could never be part of a number', () => {
    const { onChange } = renderSheet()
    const unit = screen.getByLabelText('Unit price ($)') as HTMLInputElement
    fireEvent.change(unit, { target: { value: '1.2x' } })
    expect(unit.value).toBe('1.24')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('recomputes the line total when quantity changes', () => {
    const { onChange } = renderSheet()
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } })
    expect(onChange).toHaveBeenCalledWith(1, { quantity: 3, total_price: 3.72 })
  })

  it('leaves the model alone while the quantity field is empty mid-edit', () => {
    const { onChange } = renderSheet()
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('offers a one-tap fix when unit x qty disagrees with the total', () => {
    const { onChange } = renderSheet({ unit_price: 1.24, quantity: 2, total_price: 12.4 })
    fireEvent.click(screen.getByRole('button', { name: 'Use $2.48' }))
    expect(onChange).toHaveBeenCalledWith(1, { total_price: 2.48 })
  })

  it('walks to the next item in display order', () => {
    const { onNavigate } = renderSheet({}, { index: 1, order: [1, 4, 7] })
    fireEvent.click(screen.getByLabelText('Next item'))
    expect(onNavigate).toHaveBeenCalledWith(4)
  })

  it('disables navigation past the ends of the list', () => {
    renderSheet({}, { index: 1, order: [1, 4] })
    expect(screen.getByLabelText('Previous item')).toBeDisabled()
    expect(screen.getByLabelText('Next item')).not.toBeDisabled()
  })

  it('shows the original scanned name when the display name was cleaned up', () => {
    renderSheet({ item_name: 'Bananas', ocr_name: 'GV BANANA BUNCH' })
    expect(screen.getByText(/GV BANANA BUNCH/)).toBeInTheDocument()
  })
})

describe('ItemCard', () => {
  const handlers = () => ({ onEdit: vi.fn(), onRemove: vi.fn() })

  beforeEach(cleanup)

  it('summarises the line so the whole list fits the phone width', () => {
    const h = handlers()
    render(<ItemCard item={item()} index={0} {...h} />)
    expect(screen.getByText('Bananas')).toBeInTheDocument()
    expect(screen.getByText('$2.48')).toBeInTheDocument()
    expect(screen.getByText('2 ea × $1.24')).toBeInTheDocument()
  })

  it('opens the editor when the row is tapped', () => {
    const h = handlers()
    render(<ItemCard item={item()} index={3} {...h} />)
    fireEvent.click(screen.getByText('Bananas'))
    expect(h.onEdit).toHaveBeenCalledWith(3)
  })

  it('calls out a line whose arithmetic does not work', () => {
    const h = handlers()
    render(<ItemCard item={item({ total_price: 12.4 })} index={0} {...h} />)
    expect(screen.getByText(/2 × \$1\.24 = \$2\.48/)).toBeInTheDocument()
  })

  it('warns that an unnamed line will be dropped on save', () => {
    const h = handlers()
    render(<ItemCard item={item({ item_name: '  ' })} index={0} {...h} />)
    expect(screen.getByText('Untitled item')).toBeInTheDocument()
    expect(screen.getByText(/won't be saved/)).toBeInTheDocument()
  })

  it('removes without opening the editor', () => {
    const h = handlers()
    render(<ItemCard item={item()} index={2} {...h} />)
    fireEvent.click(screen.getByLabelText('Remove Bananas'))
    expect(h.onRemove).toHaveBeenCalledWith(2)
    expect(h.onEdit).not.toHaveBeenCalled()
  })
})
