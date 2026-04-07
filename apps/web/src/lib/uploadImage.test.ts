import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadImage, UploadError } from './uploadImage'

const mockUpload = vi.fn()
const mockGetPublicUrl = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  }),
}))

function makeFile(name: string, type: string, sizeBytes: number): File {
  const content = new Uint8Array(sizeBytes)
  return new File([content], name, { type })
}

describe('uploadImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects a non-image file type', async () => {
    const file = makeFile('document.pdf', 'application/pdf', 1024)
    await expect(uploadImage(file, 'user-123')).rejects.toThrow(UploadError)
    await expect(uploadImage(file, 'user-123')).rejects.toThrow(
      'File must be an image (JPEG, PNG, GIF, or WebP)',
    )
  })

  it('rejects a file over 5 MB', async () => {
    const oversized = makeFile('photo.jpg', 'image/jpeg', 5 * 1024 * 1024 + 1)
    await expect(uploadImage(oversized, 'user-123')).rejects.toThrow(UploadError)
    await expect(uploadImage(oversized, 'user-123')).rejects.toThrow(
      'Image must be smaller than 5 MB',
    )
  })

  it('throws UploadError when the storage upload fails', async () => {
    mockUpload.mockResolvedValue({ error: { message: 'Bucket not found' } })
    const file = makeFile('photo.png', 'image/png', 1024)
    await expect(uploadImage(file, 'user-123')).rejects.toThrow('Upload failed: Bucket not found')
  })

  it('returns { url, filename } on successful upload', async () => {
    mockUpload.mockResolvedValue({ error: null })
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://example.com/storage/user-123/abc.png' },
    })

    const file = makeFile('photo.png', 'image/png', 1024)
    const result = await uploadImage(file, 'user-123')

    expect(result).toEqual({
      url: 'https://example.com/storage/user-123/abc.png',
      filename: 'photo.png',
    })
    expect(mockUpload).toHaveBeenCalledOnce()
    expect(mockGetPublicUrl).toHaveBeenCalledOnce()
  })
})
