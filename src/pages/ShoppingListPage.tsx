import { useCallback, useEffect, useState } from 'react'
import { Check, Minus, Plus, Trash2, ImagePlus } from 'lucide-react'
import PageShell from '../components/layout/PageShell'
import ErrorBanner from '../components/ui/ErrorBanner'
import Spinner from '../components/ui/Spinner'
import { supabase } from '../lib/supabase'
import { useHouseholdStore } from '../store/householdStore'

type ListItem = {
  id: string; household_id: string; store_name: string; name: string
  quantity: number; checked: boolean; photo_path: string | null; position: number
}
const STORES = ['Aldi', 'Walmart', 'Publix', 'Costco']
const BUCKET = 'shopping-product-photos'

export default function ShoppingListPage() {
  const householdId = useHouseholdStore((s) => s.householdId)
  const [items, setItems] = useState<ListItem[]>([])
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newStore, setNewStore] = useState('Aldi')
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!householdId) return
    const { data, error: err } = await supabase.from('shopping_list_items').select('*')
      .eq('household_id', householdId).order('position').order('created_at')
    if (err) { setError(err.message); setLoading(false); return }
    setItems(data ?? [])
    const paths = [...new Set((data ?? []).map((x: ListItem) => x.photo_path).filter(Boolean))] as string[]
    const links = await Promise.all(paths.map(async (path) => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
      return [path, data?.signedUrl] as const
    }))
    setPhotos(Object.fromEntries(links.filter((entry): entry is [string, string] => !!entry[1])))
    setLoading(false)
  }, [householdId])

  useEffect(() => {
    void refresh()
    if (!householdId) return
    const channel = supabase.channel(`shopping-list-${householdId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list_items', filter: `household_id=eq.${householdId}` }, () => { void refresh() })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [householdId, refresh])

  async function update(item: ListItem, patch: Partial<ListItem>) {
    if (!householdId) return
    setError(null)
    const { error: err } = await supabase.from('shopping_list_items').update(patch).eq('id', item.id).eq('household_id', householdId)
    if (err) setError(err.message)
    await refresh()
  }
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || !householdId) return
    setError(null)
    const { error: err } = await supabase.from('shopping_list_items').insert({
      household_id: householdId, store_name: newStore, name, quantity: 1, position: items.length,
    })
    if (err) setError(err.message)
    else { setNewName(''); await refresh() }
  }
  async function remove(item: ListItem) {
    if (!householdId || !window.confirm(`Remove ${item.name} from ${item.store_name}?`)) return
    const { error: err } = await supabase.from('shopping_list_items').delete()
      .eq('id', item.id).eq('household_id', householdId)
    if (err) setError(err.message)
    else await refresh()
  }
  async function attachPhoto(item: ListItem, file: File) {
    if (!householdId || !file.type.startsWith('image/')) return
    if (file.size > 5 * 1024 * 1024) { setError('Use an image smaller than 5 MB.'); return }
    setBusy(item.id); setError(null)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${householdId}/custom/${item.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (uploadError) { setError(uploadError.message); setBusy(null); return }
    const { error: updateError } = await supabase.from('shopping_list_items').update({ photo_path: path })
      .eq('id', item.id).eq('household_id', householdId)
    if (updateError) { await supabase.storage.from(BUCKET).remove([path]); setError(updateError.message) }
    await refresh(); setBusy(null)
  }
  return <PageShell title="Lists">
    <div className="px-4"><ErrorBanner message={error} />
      <p className="mb-5 text-meta text-ink-2">Your household's list, by store. Tap an item as you shop.</p>
      {loading ? <div className="flex justify-center py-12"><Spinner /></div> : <>
        {STORES.map((store) => {
          const section = items.filter((x) => x.store_name === store)
          const remaining = section.filter((x) => !x.checked).length
          return <section key={store} className="mb-6">
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-section">{store}</h2><span className="text-meta text-ink-2">{remaining} left</span>
            </div>
            <div className="overflow-hidden rounded-card bg-surface">
              {section.length === 0 && <p className="p-4 text-meta text-ink-2">Nothing on this list yet.</p>}
              {section.map((item) => <div key={item.id} className="flex min-h-[74px] items-center gap-2.5 border-b border-hairline px-3 py-2 last:border-b-0">
                <button type="button" aria-label={`${item.checked ? 'Uncheck' : 'Check'} ${item.name}`} onClick={() => void update(item, { checked: !item.checked })}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${item.checked ? 'border-accent bg-accent text-white' : 'border-border text-transparent'}`}>
                  <Check size={20} aria-hidden /></button>
                <label className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] bg-canvas" title={`Change photo of ${item.name}`}>
                  {item.photo_path && photos[item.photo_path] ? <img src={photos[item.photo_path]} alt="" className="h-full w-full object-contain" /> : <ImagePlus size={19} className="text-ink-2" />}
                  <input type="file" accept="image/*" className="sr-only" aria-label={`Change photo of ${item.name}`} disabled={busy === item.id} onChange={(e) => { const f = e.target.files?.[0]; if (f) void attachPhoto(item, f); e.target.value = '' }} />
                </label>
                <div className="min-w-0 flex-1">
                  <input aria-label={`Name of ${item.name}`} defaultValue={item.name} key={`${item.id}-${item.name}`}
                    onBlur={(e) => { const name = e.target.value.trim(); if (name && name !== item.name) void update(item, { name }); else e.target.value = item.name }}
                    className={`w-full bg-transparent text-row outline-none focus:text-accent ${item.checked ? 'text-ink-2 line-through' : ''}`} />
                  <div className="mt-1 flex items-center gap-2">
                    <button type="button" aria-label={`Decrease ${item.name}`} onClick={() => void update(item, { quantity: Math.max(0, Number(item.quantity) - 1) })} className="rounded-full bg-canvas p-1 text-ink-2"><Minus size={14} /></button>
                    <span className="min-w-4 text-center text-meta tabular-nums">{item.quantity}</span>
                    <button type="button" aria-label={`Increase ${item.name}`} onClick={() => void update(item, { quantity: Number(item.quantity) + 1 })} className="rounded-full bg-canvas p-1 text-ink-2"><Plus size={14} /></button>
                  </div>
                </div>
                <button type="button" aria-label={`Remove ${item.name}`} onClick={() => void remove(item)} className="p-2 text-ink-3"><Trash2 size={17} /></button>
              </div>)}
            </div>
          </section>
        })}
        <form onSubmit={add} className="mb-8 rounded-card bg-surface p-4">
          <h2 className="mb-3 text-section">Add an item</h2>
          <div className="flex gap-2">
            <select aria-label="Store" value={newStore} onChange={(e) => setNewStore(e.target.value)} className="max-w-[115px] rounded-input border border-border bg-white px-2 py-2">
              {STORES.map((store) => <option key={store}>{store}</option>)}
            </select>
            <input aria-label="Item name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Item name" maxLength={200} className="min-w-0 flex-1 rounded-input border border-border px-3 py-2" />
            <button type="submit" disabled={!newName.trim()} className="rounded-input bg-accent px-3 text-white disabled:opacity-40">Add</button>
          </div>
        </form>
      </>}
    </div>
  </PageShell>
  }
