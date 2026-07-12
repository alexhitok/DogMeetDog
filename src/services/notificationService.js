import { supabase } from './supabaseClient.js'
import { getCurrentUser } from './authService.js'

function ensureSupabaseClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured.')
  }
}

export async function getUnreadNotificationCount() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: 0, error: userError }
  }

  if (!user) {
    return { data: 0, error: null }
  }

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null)

  return { data: count ?? 0, error }
}

export async function getMyNotifications() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: [], error: userError }
  }

  if (!user) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, actor_user_id, playdate_request_id, conversation_id, message_id, title, body, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return { data: data ?? [], error }
}

export async function markNotificationRead(notificationId) {
  ensureSupabaseClient()

  if (!notificationId) {
    return { data: 0, error: new Error('Notification id is required.') }
  }

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: 0, error: userError }
  }

  if (!user) {
    return { data: 0, error: new Error('You must be logged in to update notifications.') }
  }

  const { data, error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })

  if (error) {
    return { data: 0, error }
  }

  return { data: Number(data ?? 0), error: null }
}

export async function markAllNotificationsRead() {
  ensureSupabaseClient()

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    return { data: 0, error: userError }
  }

  if (!user) {
    return { data: 0, error: new Error('You must be logged in to update notifications.') }
  }

  const { data, error } = await supabase.rpc('mark_all_notifications_read')

  if (error) {
    return { data: 0, error }
  }

  return { data: Number(data ?? 0), error: null }
}
