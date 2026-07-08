import { supabase } from './supabaseClient.js'

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

export async function registerUser({ email, password, fullName }) {
  ensureSupabaseClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (error) {
    return { data: null, error }
  }

  const userId = data.user?.id

  if (userId) {
    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        full_name: fullName,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      return { data: null, error: profileError }
    }
  }

  return { data, error: null }
}

export async function loginUser({ email, password }) {
  ensureSupabaseClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error }
}

export async function logoutUser() {
  ensureSupabaseClient()

  const { error } = await supabase.auth.signOut()

  return { error }
}

export async function getCurrentUser() {
  ensureSupabaseClient()

  const { data, error } = await supabase.auth.getUser()

  return { user: data.user, error }
}