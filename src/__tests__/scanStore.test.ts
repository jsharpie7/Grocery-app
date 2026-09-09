import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { ExtractedReceiptData } from '../lib/gemini'

const extract = vi.hoisted(() => vi.fn())

vi.mock('../lib/gemini', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/gemini')>()),
  extractReceiptFromImage: extract,
  getLastScanDiagnostics: () => null,
}))

const { useScanStore } = await import('../store/scanStore')

function receipt(store: string): ExtractedReceiptData {
  return { store_name: store, receipt_date: '2026-09-05', total_amount: 41.52, tax_amount: 2.1, items: [] }
}

const file = (name: string) => new File(['x'], name, { type: 'image/png' })

/** Lets queued promise callbacks run without advancing wall-clock time. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('scanStore', () => {
  beforeEach(() => {
    extract.mockReset()
    // jsdom has no object URL support.
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    useScanStore.getState().reset()
  })

  afterEach(() => vi.unstubAllGlobals())

  it('returns immediately rather than blocking on the request', () => {
    extract.mockReturnValue(new Promise(() => {}))
    useScanStore.getState().start(file('a.png'), 'key', 'model')
    expect(useScanStore.getState().status).toBe('running')
    expect(useScanStore.getState().startedAt).toBeTypeOf('number')
  })

  it('lands the result in the store with nothing awaiting it', async () => {
    // This is the promise the scanning screen makes: leaving the screen
    // unmounts the component, and the scan still has somewhere to finish.
    extract.mockResolvedValue(receipt('Publix'))
    useScanStore.getState().start(file('a.png'), 'key', 'model')
    await flush()

    expect(useScanStore.getState().status).toBe('done')
    expect(useScanStore.getState().result?.store_name).toBe('Publix')
  })

  it('records a failure as an error rather than throwing into nowhere', async () => {
    extract.mockRejectedValue(new Error('Gemini scan timed out after 45 seconds.'))
    useScanStore.getState().start(file('a.png'), 'key', 'model')
    await flush()

    expect(useScanStore.getState().status).toBe('error')
    expect(useScanStore.getState().error).toMatch(/timed out/)
  })

  it('ignores a superseded scan when a newer one has started', async () => {
    let finishFirst: (r: ExtractedReceiptData) => void = () => {}
    extract.mockReturnValueOnce(new Promise<ExtractedReceiptData>((res) => { finishFirst = res }))
    useScanStore.getState().start(file('first.png'), 'key', 'model')

    extract.mockResolvedValueOnce(receipt('Aldi'))
    useScanStore.getState().start(file('second.png'), 'key', 'model')
    await flush()

    // The stale first scan resolves last and must not overwrite the second.
    finishFirst(receipt('Publix'))
    await flush()

    expect(useScanStore.getState().result?.store_name).toBe('Aldi')
  })

  it('clears the result once the review screen has taken it', async () => {
    extract.mockResolvedValue(receipt('Publix'))
    useScanStore.getState().start(file('a.png'), 'key', 'model')
    await flush()

    useScanStore.getState().consume()
    expect(useScanStore.getState().status).toBe('idle')
    expect(useScanStore.getState().result).toBeNull()
    // The photo survives consumption — the review screen still shows it.
    expect(useScanStore.getState().file).not.toBeNull()
  })
})

describe('scanStore reset', () => {
  beforeEach(() => {
    extract.mockReset()
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    useScanStore.getState().reset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('clears a failed scan so the next capture starts empty', async () => {
    // Cancelling after a failure must not leave the old photo and error
    // sitting on the capture screen the next time it opens.
    extract.mockRejectedValue(new Error('nope'))
    useScanStore.getState().start(file('a.png'), 'key', 'model')
    await flush()
    expect(useScanStore.getState().status).toBe('error')

    useScanStore.getState().reset()
    const s = useScanStore.getState()
    expect(s.status).toBe('idle')
    expect(s.file).toBeNull()
    expect(s.preview).toBeNull()
    expect(s.error).toBeNull()
  })
})
