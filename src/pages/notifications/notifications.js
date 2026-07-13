import template from './notifications.html?raw'
import './notifications.css'
import { t } from '../../i18n/i18n.js'
import { getCurrentUser, isSignedOutAuthError } from '../../services/authService.js'
import { supabase } from '../../services/supabaseClient.js'
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notificationService.js'

const state = {
  user: null,
  notifications: [],
}

let authStateListenerBound = false
let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('notifications.pageTitle')}`
}

function setStatus(target, message, variant, translationKey = '', replacements = {}) {
  if (!target) {
    return
  }

  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  if (translationKey) {
    alert.dataset.i18n = translationKey
    if (Object.keys(replacements).length) {
      alert.dataset.i18nReplacements = JSON.stringify(replacements)
    }
  }
  alert.textContent = message

  target.append(alert)
}

function setTranslatedStatus(target, translationKey, variant, replacements = {}) {
  setStatus(target, t(translationKey, replacements), variant, translationKey, replacements)
}

function setI18nText(element, translationKey, replacements = {}) {
  if (!element) {
    return
  }

  element.dataset.i18n = translationKey
  if (Object.keys(replacements).length) {
    element.dataset.i18nReplacements = JSON.stringify(replacements)
  }
  element.textContent = t(translationKey, replacements)
}

function clearStatus(target) {
  if (target) {
    target.replaceChildren()
  }
}

function renderSignedOutState() {
  const signedOutState = document.querySelector('[data-notifications-signed-out]')
  const list = document.querySelector('[data-notifications-list]')
  const markAllButton = document.querySelector('[data-mark-all-read]')
  const status = document.querySelector('[data-notifications-status]')

  state.user = null
  state.notifications = []

  if (status) {
    clearStatus(status)
  }

  if (markAllButton) {
    markAllButton.hidden = true
    markAllButton.disabled = true
  }

  if (list) {
    list.hidden = true
    list.replaceChildren()
  }

  if (signedOutState) {
    signedOutState.classList.remove('d-none')
  }
}

function renderSignedInState() {
  const signedOutState = document.querySelector('[data-notifications-signed-out]')
  const list = document.querySelector('[data-notifications-list]')
  const markAllButton = document.querySelector('[data-mark-all-read]')

  if (signedOutState) {
    signedOutState.classList.add('d-none')
  }

  if (list) {
    list.hidden = false
  }

  if (markAllButton) {
    markAllButton.hidden = false
  }
}

function bindAuthStateListener() {
  if (authStateListenerBound || !supabase?.auth?.onAuthStateChange) {
    return
  }

  authStateListenerBound = true

  supabase.auth.onAuthStateChange(() => {
    if (document.querySelector('[data-notifications-page]')) {
      refreshNotifications()
    }
  })
}

function formatDateTime(value) {
  if (!value) {
    return t('notifications.unknownTime')
  }

  return new Date(value).toLocaleString()
}

function getNotificationTarget(notification) {
  if (notification.type === 'new_message' && notification.conversation_id) {
    return `/messages?conversation=${encodeURIComponent(notification.conversation_id)}`
  }

  return '/profile'
}

function getNotificationLabel(notification) {
  if (notification.type === 'playdate_request_received') {
    return t('notifications.playdateRequestReceived')
  }

  if (notification.type === 'playdate_request_accepted') {
    return t('notifications.playdateRequestAccepted')
  }

  if (notification.type === 'playdate_request_declined') {
    return t('notifications.playdateRequestDeclined')
  }

  return t('notifications.newMessage')
}

function renderNotifications(target) {
  if (!target) {
    return
  }

  target.replaceChildren()

  if (!state.notifications.length) {
    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    setI18nText(empty, 'notifications.noNotifications')
    target.append(empty)
    return
  }

  const fragment = document.createDocumentFragment()

  state.notifications.forEach((notification) => {
    const article = document.createElement('article')
    article.className = `card notification-item shadow-sm ${notification.read_at ? '' : 'is-unread'}`

    const body = document.createElement('div')
    body.className = 'card-body d-grid gap-2'

    const topRow = document.createElement('div')
    topRow.className = 'd-flex justify-content-between align-items-start gap-2'

    const title = document.createElement('div')
    title.className = 'notification-title'
    title.textContent = notification.title || getNotificationLabel(notification)

    const time = document.createElement('div')
    time.className = 'small text-secondary text-nowrap'
    time.textContent = formatDateTime(notification.created_at)

    topRow.append(title, time)

    const summary = document.createElement('div')
    summary.className = 'notification-body'
    summary.textContent = notification.body

    const actions = document.createElement('div')
    actions.className = 'd-flex flex-wrap gap-2 align-items-center'

    const link = document.createElement('a')
    link.className = 'btn btn-outline-primary btn-sm'
    link.href = getNotificationTarget(notification)
    link.setAttribute('data-link', '')
    setI18nText(link, notification.type === 'new_message' ? 'notifications.openConversation' : 'notifications.viewProfile')

    actions.append(link)

    if (!notification.read_at) {
      const markButton = document.createElement('button')
      markButton.type = 'button'
      markButton.className = 'btn btn-primary btn-sm'
      markButton.dataset.notificationId = notification.id
      setI18nText(markButton, 'notifications.markAsRead')
      actions.append(markButton)
    }

    body.append(topRow, summary, actions)
    article.append(body)
    fragment.append(article)
  })

  target.append(fragment)
}

async function refreshNotifications() {
  const pageStatus = document.querySelector('[data-notifications-status]')
  const list = document.querySelector('[data-notifications-list]')
  const markAllButton = document.querySelector('[data-mark-all-read]')

  setTranslatedStatus(pageStatus, 'notifications.loading', 'secondary')

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    if (isSignedOutAuthError(userError)) {
      renderSignedOutState()
      return
    }

    state.user = null
    state.notifications = []
    setStatus(pageStatus, userError.message, 'danger')
    renderSignedInState()
    renderNotifications(list)
    if (markAllButton) {
      markAllButton.disabled = true
      markAllButton.hidden = false
    }
    return
  }

  if (!user) {
    renderSignedOutState()
    return
  }

  state.user = user
  renderSignedInState()

  const { data, error } = await getMyNotifications()

  if (error) {
    state.notifications = []
    setStatus(pageStatus, error.message, 'danger')
    renderNotifications(list)
    if (markAllButton) {
      markAllButton.disabled = true
      markAllButton.hidden = false
    }
    return
  }

  state.notifications = data ?? []
  renderNotifications(list)
  clearStatus(pageStatus)

  if (markAllButton) {
    markAllButton.disabled = !state.notifications.some((notification) => !notification.read_at)
    markAllButton.hidden = false
  }
}

async function bindNotificationsPage() {
  const page = document.querySelector('[data-notifications-page]')
  const list = document.querySelector('[data-notifications-list]')
  const markAllButton = document.querySelector('[data-mark-all-read]')

  if (!page || !list || !markAllButton) {
    return
  }

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-notification-id]')

    if (!button) {
      return
    }

    const notificationId = button.dataset.notificationId
    button.disabled = true

    const { error } = await markNotificationRead(notificationId)

    if (error) {
      button.disabled = false
      setStatus(document.querySelector('[data-notifications-status]'), error.message, 'danger')
      return
    }

    window.dispatchEvent(new Event('notifications:changed'))
    await refreshNotifications()
  })

  markAllButton.addEventListener('click', async () => {
    markAllButton.disabled = true
    const { error } = await markAllNotificationsRead()

    if (error) {
      setStatus(document.querySelector('[data-notifications-status]'), error.message, 'danger')
      markAllButton.disabled = false
      return
    }

    window.dispatchEvent(new Event('notifications:changed'))
    await refreshNotifications()
  })

  bindAuthStateListener()
  await refreshNotifications()
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindNotificationsPage)
  return template
}
