import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './authService.js'

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

function sortDogPhotos(photos) {
  return [...photos].sort((left, right) => {
    if (left.is_main !== right.is_main) {
      return Number(right.is_main) - Number(left.is_main)
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  })
}

async function getProfilesMap() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name')

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((profile) => [profile.id, profile.full_name ?? '']))
}

export async function getCurrentUserRole() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { user: null, role: null, isAdmin: false, error: userError }
  }

  if (!user) {
    return { user: null, role: null, isAdmin: false, error: null }
  }

  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return { user, role: null, isAdmin: false, error }
  }

  const role = data?.role ?? null

  return {
    user,
    role,
    isAdmin: role === 'admin',
    error: null,
  }
}

export async function getAdminDogs() {
  ensureSupabaseClient()

  const [{ data: dogs, error: dogsError }, profilesMap] = await Promise.all([
    supabase
      .from('dogs')
      .select('id, owner_id, name, breed, district, status, created_at, dog_photos(image_url, is_main, created_at)')
      .order('created_at', { ascending: false }),
    getProfilesMap(),
  ])

  if (dogsError) {
    return { data: [], error: dogsError }
  }

  const data = (dogs ?? []).map((dog) => {
    const photos = Array.isArray(dog.dog_photos) ? sortDogPhotos(dog.dog_photos) : []

    return {
      ...dog,
      ownerFullName: profilesMap.get(dog.owner_id) ?? '',
      photoUrl: photos[0]?.image_url ?? '',
    }
  })

  return { data, error: null }
}

export async function getAdminRoles() {
  ensureSupabaseClient()

  const [{ data: roles, error: rolesError }, profilesMap] = await Promise.all([
    supabase
      .from('user_roles')
      .select('user_id, role, created_at')
      .order('created_at', { ascending: false }),
    getProfilesMap(),
  ])

  if (rolesError) {
    return { data: [], error: rolesError }
  }

  const data = (roles ?? []).map((roleRow) => ({
    ...roleRow,
    fullName: profilesMap.get(roleRow.user_id) ?? '',
  }))

  return { data, error: null }
}

export async function deleteDogAsAdmin(dogId) {
  ensureSupabaseClient()

  if (!dogId) {
    return { error: new Error('Dog id is required.') }
  }

  const { user, isAdmin, error } = await getCurrentUserRole()

  if (error) {
    return { error }
  }

  if (!user) {
    return { error: new Error('You must be signed in to delete a dog.') }
  }

  if (!isAdmin) {
    return { error: new Error('Access denied.') }
  }

  const { error: deleteError } = await supabase
    .from('dogs')
    .delete()
    .eq('id', dogId)

  return { error: deleteError }
}