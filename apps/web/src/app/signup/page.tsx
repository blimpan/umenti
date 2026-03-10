'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Role } from '@metis/types'


export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role | ''>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [emailConfirmationMsg, setEmailConfirmationMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const supabaseClient = createClient()

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault() // default behavior of form submit is to reload the page, we want to prevent that
    setErrorMsg(null)

    if (!role) {
      setErrorMsg('Please choose a role before creating your account.')
      return
    }

    setLoading(true)

    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { role }
      }
    })
    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setEmailConfirmationMsg('Please check your email for a confirmation link.')
      setLoading(false)
      return
    }

    // Do a POST request to /api/users to create the user record in our database.
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`
      },
      body: JSON.stringify({ role })
    })

    if (!res.ok) {
      const errorData = await res.json()
      setErrorMsg(errorData.error || 'Failed to create user')
      setLoading(false)
      return
    }

    router.push(role === Role.TEACHER ? '/teacher/dashboard' : '/student/dashboard')
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold text-center">Create your account</h1>

        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">I am a...</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRole(Role.STUDENT)}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium border transition-colors ${
                  role === Role.STUDENT
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => setRole(Role.TEACHER)}
                className={`flex-1 py-2 px-4 rounded text-sm font-medium border transition-colors ${
                  role === Role.TEACHER
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                Teacher
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>

          {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

          {emailConfirmationMsg && <p className="text-green-600 text-sm">{emailConfirmationMsg}</p>}

          <button
            type="submit"
            disabled={loading || !role}
            className="w-full bg-black text-white py-2 rounded text-sm font-medium disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="underline">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
