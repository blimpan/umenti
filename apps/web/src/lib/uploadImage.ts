import { createClient } from '@/lib/supabase/client'
import type { ImageAttachment } from '@metis/types'

const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const BUCKET = 'message-attachments'

export class UploadError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UploadError'
  }
}

export async function uploadImage(
  file: File,
  userId: string,
): Promise<ImageAttachment> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new UploadError('File must be an image (JPEG, PNG, GIF, or WebP)')
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new UploadError('Image must be smaller than 5 MB')
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop()! : 'jpg'
  const uuid = crypto.randomUUID()
  const path = `${userId}/${uuid}.${ext}`

  const supabase = createClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, file)
  if (error) throw new UploadError(`Upload failed: ${error.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, filename: file.name }
}
