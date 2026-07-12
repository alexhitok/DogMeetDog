import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './authService.js'

const DOG_PHOTOS_BUCKET = 'dog-photos'
const MAX_DOG_PHOTO_SIZE_BYTES = 5 * 1024 * 1024
const MAX_DOG_PHOTOS = 5

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

function sanitizeFileName(fileName) {
  return fileName
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'photo'
}

function validatePhotoFiles(files) {
  if (!files.length) {
    return null
  }

  if (files.length > MAX_DOG_PHOTOS) {
    return 'You can upload up to 5 images per dog.'
  }

  for (const file of files) {
    if (!file.type || !file.type.startsWith('image/')) {
      return `File "${file.name}" is not an image.`
    }

    if (file.size > MAX_DOG_PHOTO_SIZE_BYTES) {
      return `File "${file.name}" must be 5 MB or smaller.`
    }
  }

  return null
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

export async function updateDogById(dogId, payload) {
  ensureSupabaseClient()

  if (!dogId) {
    return { data: null, error: new Error('Dog id is required.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to update a dog.') }
  }

  const updatePayload = {
    name: payload.name,
    breed: payload.breed,
    age_years: payload.ageYears === '' || payload.ageYears === null || payload.ageYears === undefined ? null : Number(payload.ageYears),
    size: payload.size,
    gender: payload.gender,
    temperament: payload.temperament,
    district: payload.district,
    description: payload.description,
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    updatePayload.status = payload.status
  }

  const { data, error } = await supabase
    .from('dogs')
    .update(updatePayload)
    .eq('id', dogId)
    .eq('owner_id', user.id)
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
    .select('*, dog_photos(image_url, is_main, created_at)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const dogs = Array.isArray(data)
    ? data.map((dog) => {
        const photos = Array.isArray(dog.dog_photos)
          ? [...dog.dog_photos].sort((left, right) => {
              if (left.is_main !== right.is_main) {
                return Number(right.is_main) - Number(left.is_main)
              }

              return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
            })
          : []

        return {
          ...dog,
          photoUrl: photos[0]?.image_url ?? '',
        }
      })
    : []

  return { data: dogs, error }
}

export async function getActiveDogs() {
  ensureSupabaseClient()

  const { data, error } = await supabase
    .from('dogs')
    .select('*, dog_photos(image_url, is_main, created_at)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const dogs = Array.isArray(data)
    ? data.map((dog) => {
        const photos = Array.isArray(dog.dog_photos)
          ? [...dog.dog_photos].sort((left, right) => {
              if (left.is_main !== right.is_main) {
                return Number(right.is_main) - Number(left.is_main)
              }

              return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
            })
          : []

        return {
          ...dog,
          photoUrl: photos[0]?.image_url ?? '',
        }
      })
    : []

  return { data: dogs, error }
}
export async function getDogById(dogId) {
  ensureSupabaseClient()

  if (!dogId) {
    return { data: null, error: new Error('Dog id is required.') }
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('*, dog_photos(image_url, is_main, created_at)')
    .eq('id', dogId)
    .single()

  if (error) {
    return { data: null, error }
  }

  const photos = Array.isArray(data?.dog_photos)
    ? [...data.dog_photos].sort((left, right) => {
        if (left.is_main !== right.is_main) {
          return Number(right.is_main) - Number(left.is_main)
        }

        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
      })
    : []

  return {
    data: {
      ...data,
      photoUrl: photos[0]?.image_url ?? '',
    },
    error: null,
  }
}
export async function deleteDogById(dogId) {
  ensureSupabaseClient()

  if (!dogId) {
    return { error: new Error('Dog id is required.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { error: userError }
  }

  if (!user) {
    return { error: new Error('You must be logged in to delete a dog.') }
  }

  const { error } = await supabase
    .from('dogs')
    .delete()
    .eq('id', dogId)
    .eq('owner_id', user.id)

  return { error }
}
export async function uploadDogPhotos({ dogId, files }) {
  ensureSupabaseClient()

  const selectedFiles = Array.from(files ?? [])

  if (!selectedFiles.length) {
    return { data: [], error: null }
  }

  const validationError = validatePhotoFiles(selectedFiles)

  if (validationError) {
    return { data: null, error: new Error(validationError) }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to upload dog photos.') }
  }

  const { data: dog, error: dogError } = await supabase
    .from('dogs')
    .select('id, owner_id')
    .eq('id', dogId)
    .single()

  if (dogError) {
    return { data: null, error: dogError }
  }

  if (dog.owner_id !== user.id) {
    return { data: null, error: new Error('You can upload photos only for your own dogs.') }
  }

  const uploadedObjects = []
  const photoRows = []

  try {
    for (const [index, file] of selectedFiles.entries()) {
      const safeFileName = sanitizeFileName(file.name)
      const storagePath = `${user.id}/${dogId}/${Date.now()}-${index + 1}-${safeFileName}`

      const { error: uploadError } = await supabase.storage
        .from(DOG_PHOTOS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) {
        throw uploadError
      }

      uploadedObjects.push(storagePath)

      const { data: publicUrlData } = supabase.storage
        .from(DOG_PHOTOS_BUCKET)
        .getPublicUrl(storagePath)

      photoRows.push({
        dog_id: dogId,
        image_url: publicUrlData.publicUrl,
        is_main: index === 0,
      })
    }

    const { data: insertedRows, error: insertError } = await supabase
      .from('dog_photos')
      .insert(photoRows)
      .select('*')

    if (insertError) {
      throw insertError
    }

    return { data: insertedRows ?? [], error: null }
  } catch (error) {
    if (uploadedObjects.length) {
      await supabase.storage.from(DOG_PHOTOS_BUCKET).remove(uploadedObjects)
    }

    return { data: null, error }
  }
}