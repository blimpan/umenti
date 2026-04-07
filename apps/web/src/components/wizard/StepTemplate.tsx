'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apiFetch } from '@/lib/api'
import type {
  GetTemplatesMetaResponse,
  CurriculumTemplateFull,
  TemplateMetaSubject,
} from '@metis/types'

const API = process.env.NEXT_PUBLIC_API_URL

type Props = {
  onConfirm: (template: CurriculumTemplateFull) => void
  onBack: () => void
}

export default function StepTemplate({ onConfirm, onBack }: Props) {
  const [meta, setMeta] = useState<GetTemplatesMetaResponse | null>(null)
  const [metaLoading, setMetaLoading] = useState(true)
  const [country, setCountry] = useState('')
  const [subject, setSubject] = useState('')
  const [templateId, setTemplateId] = useState<number | null>(null)
  const [fullTemplate, setFullTemplate] = useState<CurriculumTemplateFull | null>(null)
  const [fetchingFull, setFetchingFull] = useState(false)

  useEffect(() => {
    apiFetch(`${API}/api/templates/meta`)
      .then((r) => r.json())
      .then((data: GetTemplatesMetaResponse) => {
        setMeta(data)
        setMetaLoading(false)
      })
      .catch(() => setMetaLoading(false))
  }, [])

  const countries = meta?.map((c) => c.country) ?? []
  const subjects: TemplateMetaSubject[] =
    meta?.find((c) => c.country === country)?.subjects ?? []
  const templates = subjects.find((s) => s.subject === subject)?.templates ?? []

  function handleCountryChange(val: string) {
    setCountry(val)
    setSubject('')
    setTemplateId(null)
    setFullTemplate(null)
  }

  function handleSubjectChange(val: string) {
    setSubject(val)
    setTemplateId(null)
    setFullTemplate(null)
  }

  function handleTemplateChange(val: string) {
    const id = parseInt(val)
    setTemplateId(id)
    setFullTemplate(null)
    setFetchingFull(true)
    apiFetch(`${API}/api/templates/${id}`)
      .then((r) => r.json())
      .then((data: CurriculumTemplateFull) => {
        setFullTemplate(data)
        setFetchingFull(false)
      })
      .catch(() => setFetchingFull(false))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Choose a template</h2>
        <p className="text-sm text-gray-500 mt-1">
          Select your country, subject and course.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select
            onValueChange={handleCountryChange}
            value={country}
            disabled={metaLoading}
          >
            <SelectTrigger>
              <SelectValue placeholder={metaLoading ? 'Loading...' : 'Select a country'} />
            </SelectTrigger>
            <SelectContent>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Select
            onValueChange={handleSubjectChange}
            value={subject}
            disabled={!country}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((s) => (
                <SelectItem key={s.subject} value={s.subject}>{s.subject}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Course</Label>
          <Select
            onValueChange={handleTemplateChange}
            value={templateId?.toString() ?? ''}
            disabled={!subject}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a course" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id.toString()}>
                  {t.name} — {t.grade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fullTemplate && (
        <div className="rounded-lg border border-gray-200 p-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">
            {fullTemplate.modules.length} modules
          </p>
          <div className="flex flex-wrap gap-2">
            {fullTemplate.modules.map((m) => (
              <span
                key={m.name}
                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button
          onClick={() => fullTemplate && onConfirm(fullTemplate)}
          disabled={!fullTemplate || fetchingFull}
        >
          {fetchingFull ? 'Loading...' : 'Use this template →'}
        </Button>
      </div>
    </div>
  )
}
