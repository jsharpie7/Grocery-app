import { supabase } from './supabase'

export async function uploadReceiptImage(
  householdId: string,
  file: File,
): Promise<string | null> {
  const ext = file.name.split('.').pop() || 'jpg'
  const fileName = `${householdId}/receipts/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('receipts')
    .upload(fileName, file, { cacheControl: '3600', upsert: false })

  if (error) return null

  const { data } = supabase.storage.from('receipts').getPublicUrl(fileName)
  return data.publicUrl
}
