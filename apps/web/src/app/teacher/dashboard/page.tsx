import { createClient } from '@/lib/supabase/server'

export default async function TeacherDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-500">{user!.email}</p>
      {/* Activity feed and published course highlights will go here */}
    </div>
  )
}
