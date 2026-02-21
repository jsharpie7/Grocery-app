import { supabase } from './supabase'

export async function uploadItemPhoto(
  householdId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const fileName = `${householdId}/items/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('grocery-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (error) {
    console.error('Error uploading item photo:', error)
    return null
  }

  const { data } = supabase.storage
    .from('grocery-photos')
    .getPublicUrl(fileName)

  return data.publicUrl
}

export async function uploadReceiptPhoto(
  householdId: string,
  tripId: string,
  file: File
): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const fileName = `${householdId}/receipts/${tripId}.${ext}`

  const { error } = await supabase.storage
    .from('grocery-photos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    console.error('Error uploading receipt photo:', error)
    return null
  }

  const { data } = supabase.storage
    .from('grocery-photos')
    .getPublicUrl(fileName)

  return data.publicUrl
}

export async function uploadStoreLogoFromUrl(
  _householdId: string,
  _storeId: string,
  file: File
): Promise<string | null> {
  return uploadItemPhoto(_householdId, file)
}

export function generateJoinCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
