import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './authService.js'

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

export async function createDogProfile({
  name,
  breed,
  ageYears,
  size,
  gender,
  temperament,
  district,
  description,
}) {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to add a dog.') }
  }

  const { data, error } = await supabase
    .from('dogs')
    .insert({
      name,
      breed,
      age_years: ageYears === '' || ageYears === null || ageYears === undefined ? null : Number(ageYears),
      size,
      gender,
      temperament,
      district,
      description,
      status: 'active',
      owner_id: user.id,
    })
    .select('*')
    .single()

  return { data, error }
}

export async function getMyDogs() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: [], error: userError }
  }

  if (!user) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return { data: data ?? [], error }
}

export async function getActiveDogs() {
  ensureSupabaseClient()

  const { data, error } = await supabase
    .from('dogs')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return { data: data ?? [], error }
}