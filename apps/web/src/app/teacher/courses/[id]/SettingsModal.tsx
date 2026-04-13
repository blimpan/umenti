'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CourseDetail } from '@metis/types'
import { apiFetch } from '@/lib/api'

interface Props {
  course: CourseDetail
  onClose: () => void
}

export default function SettingsModal({ course, onClose }: Props) {
  const router = useRouter()
  const [name, setName] = useState(course.name)
  const [subject, setSubject] = useState(course.subject)
  const [language, setLanguage] = useState(course.language)
  const [targetAudience, setTargetAudience] = useState(course.targetAudience)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await apiFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses/${course.id}`, {
      method: 'DELETE',
    })
    router.push('/teacher/courses')
  }

  const fields = [
    { label: 'Course name', value: name, set: setName },
    { label: 'Subject', value: subject, set: setSubject },
    { label: 'Language', value: language, set: setLanguage },
    { label: 'Target audience', value: targetAudience, set: setTargetAudience },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">Course settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <form
          className="p-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            // TODO: call PATCH /api/courses/:id with { name, subject, language, targetAudience }
            onClose()
          }}
        >
          {fields.map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                value={value}
                onChange={(e) => set(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Save changes
            </button>
          </div>
        </form>

        <div className="px-6 pb-6">
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
              Danger zone
            </p>
            {confirmingDelete ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-sm text-red-600 font-medium hover:underline disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Confirm delete'}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Delete course
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
