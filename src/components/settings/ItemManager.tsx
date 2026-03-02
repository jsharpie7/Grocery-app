import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { uploadItemPhoto } from '../../lib/storage'
import { useHouseholdStore } from '../../store/householdStore'
import type { Item } from '../../lib/supabase'

export default function ItemManager() {
  const { householdId, categories } = useHouseholdStore()
  const [items, setItems] = useState<Item[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  // New item state
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit item state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null)
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)
  const editFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchItems()
  }, [householdId])

  async function fetchItems() {
    if (!householdId) return
    setLoading(true)
    const { data } = await supabase
      .from('items')
      .select('*, category:categories(*)')
      .eq('household_id', householdId)
      .order('name')
    setLoading(false)
    if (data) setItems(data as Item[])
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!householdId || !newName.trim()) return
    setSaving(true)
    let photoUrl: string | null = null
    if (photoFile) {
      photoUrl = await uploadItemPhoto(householdId, photoFile)
    }
    const { error } = await supabase.from('items').insert({
      household_id: householdId,
      name: newName.trim(),
      category_id: newCategory || null,
      photo_url: photoUrl,
    })
    if (!error) {
      await fetchItems()
      setNewName('')
      setNewCategory('')
      setPhotoFile(null)
      setPhotoPreview(null)
      setShowAdd(false)
    }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('items').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function startEdit(item: Item) {
    setEditingId(item.id)
    setEditName(item.name)
    setEditCategoryId(item.category_id)
    setEditPhotoFile(null)
    setEditPhotoPreview(item.photo_url)
    setShowAdd(false)
  }

  function handleEditPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditPhotoFile(file)
    setEditPhotoPreview(URL.createObjectURL(file))
  }

  async function handleEditSave() {
    if (!editingId || !editName.trim()) return
    setEditSaving(true)
    let photoUrl = editPhotoPreview
    if (editPhotoFile && householdId) {
      photoUrl = await uploadItemPhoto(householdId, editPhotoFile)
    }
    await supabase
      .from('items')
      .update({ name: editName.trim(), category_id: editCategoryId, photo_url: photoUrl })
      .eq('id', editingId)
    await fetchItems()
    setEditingId(null)
    setEditSaving(false)
  }

  const filtered = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-4 space-y-3">
      {/* Search */}
      <input
        type="text"
        placeholder="Search items..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full py-2.5 px-4 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      {/* Add item form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-2xl p-4 shadow-sm space-y-3 overflow-hidden"
          >
            <div className="flex gap-3">
              <button
                onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">📷</span>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />

              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  placeholder="Item name *"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  autoFocus
                />
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border border-gray-200 text-sm focus:outline-none bg-white"
                >
                  <option value="">No category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !newName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-medium text-sm disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 font-medium flex items-center justify-center gap-2"
        >
          <span className="text-xl">+</span>
          Add Item
        </button>
      )}

      {/* Item list */}
      {loading && <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>}

      <div className="space-y-1.5">
        {filtered.map(item => (
          <motion.div key={item.id} layout>
            {editingId === item.id ? (
              /* ── Inline edit form ── */
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-indigo-50 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex gap-3">
                  {/* Photo picker */}
                  <button
                    onClick={() => editFileRef.current?.click()}
                    className="w-16 h-16 rounded-xl bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-dashed border-indigo-200"
                  >
                    {editPhotoPreview ? (
                      <img src={editPhotoPreview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl">📷</span>
                    )}
                  </button>
                  <input
                    ref={editFileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleEditPhotoSelect}
                    className="hidden"
                  />

                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="w-full py-2 px-3 rounded-xl border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                      autoFocus
                    />
                    <select
                      value={editCategoryId ?? ''}
                      onChange={e => setEditCategoryId(e.target.value || null)}
                      className="w-full py-2 px-3 rounded-xl border border-indigo-200 text-sm focus:outline-none bg-white"
                    >
                      <option value="">No category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white text-gray-600 font-medium text-sm border border-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    disabled={editSaving || !editName.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-500 text-white font-medium text-sm disabled:opacity-60"
                  >
                    {editSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ── Normal item row ── */
              <div className="flex items-center gap-3 bg-white rounded-xl p-2.5 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-lg">{item.category?.icon || '🛒'}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  {item.category && (
                    <p className="text-xs text-gray-400">{item.category.name}</p>
                  )}
                </div>
                <button
                  onClick={() => startEdit(item)}
                  className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400 text-sm flex-shrink-0"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-400 text-sm flex-shrink-0"
                >
                  🗑
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          {search ? `No items matching "${search}"` : 'No items yet'}
        </div>
      )}
    </div>
  )
}
