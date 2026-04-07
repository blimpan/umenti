'use client'

import { Popover } from 'radix-ui'
import { ImageIcon, PlusIcon, SigmaIcon } from 'lucide-react'
import { useRef } from 'react'

interface PlusMenuProps {
  allowImages: boolean
  uploading: boolean
  onInsertMath: () => void
  onFileSelected: (file: File) => void
}

export function PlusMenu({ allowImages, uploading, onInsertMath, onFileSelected }: PlusMenuProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleImageClick() {
    fileInputRef.current?.click()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelected(file)
    e.target.value = ''  // reset so the same file can be re-selected
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden
      />
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={uploading}
            aria-label="Insert math or attach image"
            suppressHydrationWarning
            className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-teal-500 rounded-full animate-spin" />
            ) : (
              <PlusIcon size={14} />
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={6}
            className="z-50 bg-white border border-gray-200 rounded-lg shadow-md py-1 min-w-[190px]"
          >
            <Popover.Close asChild>
              <button
                type="button"
                onClick={onInsertMath}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <SigmaIcon size={14} className="text-teal-600" />
                Insert math expression
              </button>
            </Popover.Close>

            {allowImages && (
              <Popover.Close asChild>
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <ImageIcon size={14} className="text-teal-600" />
                  Attach image
                </button>
              </Popover.Close>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  )
}
