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

  return new Map((data ?? []).map((dog) => [dog.id, decorateDog(dog)]))
}

function buildConversationRecord(conversation, requestsById, dogsById) {
  const request = requestsById.get(conversation.playdate_request_id)

  if (!request) {
    return null
  }

  const senderDog = dogsById.get(request.sender_dog_id)
  const recipientDog = dogsById.get(request.recipient_dog_id)

  if (!senderDog || !recipientDog) {
    return null
  }

  return {
    ...conversation,
    playdateRequest: request,
    senderDog,
    recipientDog,
  }
}

export async function getMyConversations() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: [], error: userError }
  }

  if (!user) {
    return { data: [], error: null }
  }

  const { data: memberRows, error: memberError } = await supabase
    .from('conversation_members')
    .select('conversation_id, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })

  if (memberError) {
    return { data: [], error: memberError }
  }

  const conversationIds = (memberRows ?? []).map((row) => row.conversation_id)

  if (!conversationIds.length) {
    return { data: [], error: null }
  }

  const { data: conversations, error: conversationsError } = await supabase
    .from('conversations')
    .select('id, playdate_request_id, created_at')
    .in('id', conversationIds)

  if (conversationsError) {
    return { data: [], error: conversationsError }
  }

  const requestIds = (conversations ?? []).map((conversation) => conversation.playdate_request_id)
  const { data: requests, error: requestsError } = await supabase
    .from('playdate_requests')
    .select('id, sender_dog_id, recipient_dog_id, status, created_at, updated_at')
    .in('id', requestIds)

  if (requestsError) {
    return { data: [], error: requestsError }
  }

  let dogsById

  try {
    dogsById = await getDogsByIds((requests ?? []).flatMap((request) => [request.sender_dog_id, request.recipient_dog_id]))
  } catch (error) {
    return { data: [], error }
  }

  const requestsById = new Map((requests ?? []).map((request) => [request.id, request]))
  const data = (conversations ?? [])
    .map((conversation) => buildConversationRecord(conversation, requestsById, dogsById))
    .filter(Boolean)
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())

  return { data, error: null }
}

export async function getConversationMessages(conversationId) {
  ensureSupabaseClient()

  if (!conversationId) {
    return { data: [], error: new Error('Conversation id is required.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: [], error: userError }
  }

  if (!user) {
    return { data: [], error: new Error('You must be logged in to view messages.') }
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id, playdate_request_id, created_at')
    .eq('id', conversationId)
    .maybeSingle()

  if (conversationError || !conversation) {
    return { data: [], error: new Error('Conversation not found or you do not have access to it.') }
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return { data: [], error }
  }

  return { data: data ?? [], error: null }
}

export async function sendConversationMessage({ conversationId, body }) {
  ensureSupabaseClient()

  if (!conversationId) {
    return { data: null, error: new Error('Conversation id is required.') }
  }

  const messageBody = String(body ?? '')

  if (!messageBody.trim()) {
    return { data: null, error: new Error('Message body cannot be empty.') }
  }

  if (messageBody.length > 2000) {
    return { data: null, error: new Error('Message body must be 2000 characters or fewer.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to send messages.') }
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: messageBody,
    })
    .select('id, conversation_id, sender_id, body, created_at')
    .single()

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}

export async function getOrCreateConversation(playdateRequestId) {
  ensureSupabaseClient()

  if (!playdateRequestId) {
    return { data: null, error: new Error('Playdate request id is required.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: null, error: userError }
  }

  if (!user) {
    return { data: null, error: new Error('You must be logged in to open a conversation.') }
  }

  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    p_playdate_request_id: playdateRequestId,
  })

  if (error) {
    return { data: null, error }
  }

  return { data, error: null }
}