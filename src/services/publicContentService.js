import { supabase } from './supabaseClient.js'

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

async function getDogsByIds(dogIds) {
  const uniqueDogIds = [...new Set((dogIds ?? []).filter(Boolean))]

  if (!uniqueDogIds.length) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('id, name, breed, dog_photos(image_url, is_main, created_at)')
    .in('id', uniqueDogIds)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((dog) => {
    const photos = Array.isArray(dog.dog_photos) ? sortDogPhotos(dog.dog_photos) : []

    return [dog.id, {
      name: dog.name ?? '',
      breed: dog.breed ?? '',
      photoUrl: photos[0]?.image_url ?? '',
    }]
  }))
}

export async function getAdoptionPosts() {
  ensureSupabaseClient()

  const { data, error } = await supabase
    .from('adoption_posts')
    .select('id, dog_id, title, description, status, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error }
  }

  const dogsById = await getDogsByIds((data ?? []).map((post) => post.dog_id))

  return {
    data: (data ?? []).map((post) => {
      const dog = dogsById.get(post.dog_id)

      return {
        ...post,
        dogName: dog?.name ?? '',
        dogBreed: dog?.breed ?? '',
        dogPhotoUrl: dog?.photoUrl ?? '',
      }
    }),
    error: null,
  }
}

export async function getLostDogReports() {
  ensureSupabaseClient()

  const { data, error } = await supabase
    .from('lost_dog_reports')
    .select('id, dog_id, last_seen_location, last_seen_date, contact_phone, status, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error }
  }

  const dogsById = await getDogsByIds((data ?? []).map((report) => report.dog_id))

  return {
    data: (data ?? []).map((report) => {
      const dog = dogsById.get(report.dog_id)

      return {
        ...report,
        dogName: dog?.name ?? '',
        dogBreed: dog?.breed ?? '',
        dogPhotoUrl: dog?.photoUrl ?? '',
      }
    }),
    error: null,
  }
}

export async function getPlaces() {
  ensureSupabaseClient()

  const { data, error } = await supabase
    .from('places')
    .select('id, name, type, district, address, description, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return { data: [], error }
  }

  return { data: data ?? [], error: null }
}