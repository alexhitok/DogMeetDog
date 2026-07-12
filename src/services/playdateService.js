import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './authService.js'

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

async function getDogsByIds(dogIds) {
  const uniqueDogIds = [...new Set((dogIds ?? []).filter(Boolean))]

  if (!uniqueDogIds.length) {
    return new Map()
  }

  const { data, error } = await supabase
    .from('dogs')
    .select('id, owner_id, name, breed, district, location_city, location_latitude, location_longitude, location_visibility, dog_photos(image_url, is_main, created_at)')
    .in('id', uniqueDogIds)

  if (error) {
    throw error
  }

  return new Map((data ?? []).map((dog) => [dog.id, dog]))
}

function sortDogPhotos(photos) {
  return [...photos].sort((left, right) => {
    if (left.is_main !== right.is_main) {
      return Number(right.is_main) - Number(left.is_main)
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  })
}

function decorateDog(dog) {
  if (!dog) {
    return null
  }

  const photos = Array.isArray(dog.dog_photos) ? sortDogPhotos(dog.dog_photos) : []

  return {
    ...dog,
    photoUrl: photos[0]?.image_url ?? '',
  }
}

function splitRequestsByRole(requests, userId) {
  const sent = []
  const received = []
  const matches = []

  for (const request of requests) {
    const senderOwnerId = request.senderDog?.owner_id ?? null
    const recipientOwnerId = request.recipientDog?.owner_id ?? null
    const isSenderOwner = senderOwnerId === userId
    const isRecipientOwner = recipientOwnerId === userId

    if (request.status === 'accepted') {
      if (isSenderOwner || isRecipientOwner) {
        matches.push(request)
      }

      continue
    }

    if (request.status === 'pending' && isSenderOwner) {
      sent.push({ ...request, role: 'sent' })
    }

    if (request.status === 'pending' && isRecipientOwner) {
      received.push({ ...request, role: 'received' })
    }
  }

  return { sent, received, matches }
}

export async function getMyPlaydateRequests() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return {
      data: { requests: [], sent: [], received: [], matches: [], senderDogIds: [], recipientDogIds: [] },
      error: userError,
    }
  }

  if (!user) {
    return {
      data: { requests: [], sent: [], received: [], matches: [], senderDogIds: [], recipientDogIds: [] },
      error: null,
    }
  }

  const { data, error } = await supabase
    .from('playdate_requests')
    .select('id, sender_dog_id, recipient_dog_id, status, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) {
    return {
      data: { requests: [], sent: [], received: [], matches: [], senderDogIds: [], recipientDogIds: [] },
      error,
    }
  }

  const senderDogIds = (data ?? []).map((request) => request.sender_dog_id)
  const recipientDogIds = (data ?? []).map((request) => request.recipient_dog_id)
  const dogsById = await getDogsByIds([...senderDogIds, ...recipientDogIds])

  const requests = (data ?? [])
    .map((request) => {
      const senderDog = decorateDog(dogsById.get(request.sender_dog_id))
      const recipientDog = decorateDog(dogsById.get(request.recipient_dog_id))

      if (!senderDog || !recipientDog) {
        return null
      }

      return {
        ...request,
        senderDog,
        recipientDog,
      }
    })
    .filter(Boolean)

  const grouped = splitRequestsByRole(requests, user.id)

  return {
    data: {
      requests,
      sent: grouped.sent,
      received: grouped.received,
      matches: grouped.matches,
      senderDogIds,
      recipientDogIds,
    },
    error: null,
  }
}

export async function createPlaydateRequest({ senderDogId, recipientDogId }) {
  ensureSupabaseClient()

  if (!senderDogId || !recipientDogId) {
    return { data: null, error: new Error('Both sender and recipient dogs are required.') }
  }

  if (String(senderDogId) === String(recipientDogId)) {
    return { data: null, error: new Error('A dog cannot send a playdate request to itself.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to send a playdate request.') }
  }

  const { data: senderDog, error: senderDogError } = await supabase
    .from('dogs')
    .select('id, owner_id')
    .eq('id', senderDogId)
    .single()

  if (senderDogError) {
    return { data: null, error: senderDogError }
  }

  if (senderDog.owner_id !== user.id) {
    return { data: null, error: new Error('You can send requests only from your own dogs.') }
  }

  const { data, error } = await supabase
    .from('playdate_requests')
    .insert({
      sender_dog_id: senderDogId,
      recipient_dog_id: recipientDogId,
      status: 'pending',
    })
    .select('id, sender_dog_id, recipient_dog_id, status, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return { data: null, error: new Error('A pending playdate request already exists for this dog pair.') }
    }

    return { data: null, error }
  }

  return { data, error: null }
}

export async function updatePlaydateRequestStatus({ requestId, status }) {
  ensureSupabaseClient()

  if (!requestId) {
    return { data: null, error: new Error('Request id is required.') }
  }

  if (!['accepted', 'declined', 'cancelled'].includes(status)) {
    return { data: null, error: new Error('Unsupported request status.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to update a playdate request.') }
  }

  const { data, error } = await supabase
    .from('playdate_requests')
    .update({ status })
    .eq('id', requestId)
    .select('id, sender_dog_id, recipient_dog_id, status, created_at, updated_at')
    .single()

  return { data, error }
}