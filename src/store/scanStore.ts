import { create } from 'zustand'
import {
  extractReceiptFromImage,
  getLastScanDiagnostics,
  type ExtractedReceiptData,
  type ScanDiagnostics,
  type ScanError,
} from '../lib/gemini'

type ScanStatus = 'idle' | 'running' | 'done' | 'error'

interface ScanState {
  status: ScanStatus
  file: File | null
  /** Object URL for the captured image. Revoked when the scan is reset. */
  preview: string | null
  /** Epoch ms the request started, for the progress bar. Null when idle. */
  startedAt: number | null
  result: ExtractedReceiptData | null
  error: string | null
  diagnostics: ScanDiagnostics | null
  start: (file: File, apiKey: string, model: string) => void
  /** Called once the result has been folded into the review screen. */
  consume: () => void
  reset: () => void
}

/**
 * The in-flight receipt scan, held outside React.
 *
 * The scanning screen promises "You can leave this screen — it keeps going",
 * and that has to be true. While the request lived in component state, leaving
 * the screen unmounted the component and its result went nowhere: the dispatch
 * landed on a dead reducer and the scan was silently lost.
 *
 * Here the request is owned by the store, so navigating away does not touch it.
 * The result waits in `result` until the review screen picks it up, whether
 * that is immediately or when the user comes back.
 *
 * Nothing aborts the request but its own 45s timeout inside `gemini.ts` — the
 * point is that unmounting is not a cancellation.
 */
export const useScanStore = create<ScanState>((set, get) => ({
  status: 'idle',
  file: null,
  preview: null,
  startedAt: null,
  result: null,
  error: null,
  diagnostics: null,

  start: (file, apiKey, model) => {
    const previous = get().preview
    if (previous) URL.revokeObjectURL(previous)

    set({
      status: 'running',
      file,
      preview: URL.createObjectURL(file),
      startedAt: Date.now(),
      result: null,
      error: null,
      diagnostics: null,
    })

    // Deliberately not awaited: `start` returns immediately and the request
    // outlives whatever called it.
    void extractReceiptFromImage(file, apiKey, model)
      .then((result) => {
        // A newer scan may have started while this one was in flight; the last
        // one to be started is the one the user is waiting on.
        if (get().file !== file) return
        set({ status: 'done', result })
      })
      .catch((e) => {
        if (get().file !== file) return
        set({
          status: 'error',
          error: (e as Error).message,
          diagnostics: (e as ScanError).diagnostics ?? getLastScanDiagnostics(),
        })
      })
  },

  consume: () => set({ status: 'idle', result: null }),

  reset: () => {
    const previous = get().preview
    if (previous) URL.revokeObjectURL(previous)
    set({
      status: 'idle',
      file: null,
      preview: null,
      startedAt: null,
      result: null,
      error: null,
      diagnostics: null,
    })
  },
}))
