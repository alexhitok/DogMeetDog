import template from './messages.html?raw'
import './messages.css'
import { t } from '../../i18n/i18n.js'
import { getCurrentUser } from '../../services/authService.js'
import { getConversationMessages, getMyConversations, sendConversationMessage } from '../../services/messagingService.js'

const state = {
  user: null,
  conversations: [],
  selectedConversationId: null,
  loadVersion: 0,
  isSending: false,
}

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('messages.pageTitle')}`
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

function clearStatus(target) {
  if (target) {
    target.replaceChildren()
  }
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

function formatDate(value) {
  if (!value) {
    return t('messages.unknownDate')
  }

  return new Date(value).toLocaleDateString()
}

function formatDateTime(value) {
  if (!value) {
    return t('messages.unknownTime')
  }

  return new Date(value).toLocaleString()
}

function getConversationTitle(conversation) {
  const dogNames = [conversation?.senderDog?.name, conversation?.recipientDog?.name].filter(Boolean)

  if (!dogNames.length) {
    return t('messages.conversationTitle')
  }

  if (dogNames.length === 1) {
    return dogNames[0]
  }

  return `${dogNames[0]} ↔ ${dogNames[1]}`
}

function getConversationSubtitle(conversation) {
  if (!conversation) {
    return t('messages.selectAcceptedMatch')
  }

  return t('messages.acceptedMatchCreated', { date: formatDate(conversation.created_at) })
}

function getConversationFromUrl() {
  return new URLSearchParams(window.location.search).get('conversation') || ''
}

function updateConversationUrl(conversationId, replace = false) {
  const currentUrl = new URL(window.location.href)

  if (conversationId) {
    currentUrl.searchParams.set('conversation', conversationId)
  } else {
    currentUrl.searchParams.delete('conversation')
  }

  if (replace) {
    window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}`)
    return
  }

  window.history.pushState({}, '', `${currentUrl.pathname}${currentUrl.search}`)
}

function getSelectedConversation() {
  return state.conversations.find((conversation) => String(conversation.id) === String(state.selectedConversationId)) ?? null
}

function renderConversationList(target) {
  if (!target) {
    return
  }

  target.replaceChildren()

  if (!state.conversations.length) {
    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0 small'
    empty.setAttribute('role', 'alert')
    setI18nText(empty, 'messages.noAcceptedMatches')
    target.append(empty)
    return
  }

  const fragment = document.createDocumentFragment()

  state.conversations.forEach((conversation) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `list-group-item list-group-item-action conversation-item ${String(conversation.id) === String(state.selectedConversationId) ? 'is-active active' : ''}`
    button.dataset.conversationId = conversation.id

    const title = document.createElement('div')
    title.className = 'fw-semibold'
    title.textContent = getConversationTitle(conversation)

    const meta = document.createElement('div')
    meta.className = 'small text-secondary'
    meta.textContent = getConversationSubtitle(conversation)

    button.append(title, meta)
    fragment.append(button)
  })

  target.append(fragment)
}

function renderMessages(target, messages) {
  if (!target) {
    return
  }

  target.replaceChildren()

  if (!messages.length) {
    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    setI18nText(empty, 'messages.noMessagesYet')
    target.append(empty)
    return
  }

  const fragment = document.createDocumentFragment()

  messages.forEach((message) => {
    const isOwnMessage = String(message.sender_id) === String(state.user?.id)

    const row = document.createElement('div')
    row.className = `d-flex ${isOwnMessage ? 'justify-content-end' : 'justify-content-start'} message-row`

    const bubble = document.createElement('div')
    bubble.className = `message-bubble rounded-4 px-3 py-2 shadow-sm ${isOwnMessage ? 'bg-primary text-white is-own' : 'bg-body-tertiary'}`

    const meta = document.createElement('div')
    meta.className = `small mb-1 ${isOwnMessage ? 'text-white-50' : 'text-secondary'}`
    meta.textContent = `${isOwnMessage ? t('messages.you') : t('messages.otherOwner')} · ${formatDateTime(message.created_at)}`

    const body = document.createElement('p')
    body.className = 'mb-0'
    body.textContent = message.body

    bubble.append(meta, body)
    row.append(bubble)
    fragment.append(row)
  })

  target.append(fragment)
}

function setConversationSelection(conversationId, { updateUrl = true } = {}) {
  state.selectedConversationId = conversationId || null

  const selectedConversation = getSelectedConversation()
  const title = document.querySelector('[data-selected-conversation-title]')
  const subtitle = document.querySelector('[data-selected-conversation-subtitle]')
  const messagesList = document.querySelector('[data-messages-list]')
  const form = document.querySelector('[data-message-form]')
  const emptyState = document.querySelector('[data-message-empty-state]')
  const refreshConversationButton = document.querySelector('[data-refresh-conversation]')

  if (selectedConversation) {
    if (title) {
      title.textContent = getConversationTitle(selectedConversation)
    }

    if (subtitle) {
      subtitle.textContent = getConversationSubtitle(selectedConversation)
    }

    if (form) {
      form.classList.remove('d-none')
    }

    if (emptyState) {
      emptyState.classList.add('d-none')
    }

    if (refreshConversationButton) {
      refreshConversationButton.disabled = false
    }
  } else {
    if (title) {
      title.textContent = t('messages.selectConversation')
    }

    if (subtitle) {
      subtitle.textContent = t('messages.selectAcceptedMatch')
    }

    if (form) {
      form.classList.add('d-none')
    }

    if (emptyState) {
      emptyState.classList.remove('d-none')
      setI18nText(emptyState, state.conversations.length ? 'messages.selectConversationToMessage' : 'messages.noAcceptedMatches')
    }

    if (refreshConversationButton) {
      refreshConversationButton.disabled = true
    }

    renderMessages(messagesList, [])
  }

  renderConversationList(document.querySelector('[data-conversations-list]'))

  if (updateUrl) {
    updateConversationUrl(state.selectedConversationId, false)
  }
}

async function loadMessagesForSelectedConversation({ quiet = false } = {}) {
  const status = document.querySelector('[data-conversation-status]')
  const messagesList = document.querySelector('[data-messages-list]')
  const form = document.querySelector('[data-message-form]')
  const emptyState = document.querySelector('[data-message-empty-state]')

  const selectedConversationId = state.selectedConversationId

  if (!selectedConversationId) {
    renderMessages(messagesList, [])

    if (form) {
      form.classList.add('d-none')
    }

    if (emptyState) {
      emptyState.classList.remove('d-none')
      setI18nText(emptyState, state.conversations.length ? 'messages.selectConversationToMessage' : 'messages.noAcceptedMatches')
    }

    clearStatus(status)
    return
  }

  if (!quiet) {
    setTranslatedStatus(status, 'messages.loadingMessages', 'secondary')
  }

  const loadVersion = ++state.loadVersion
  const { data, error } = await getConversationMessages(selectedConversationId)

  if (loadVersion !== state.loadVersion) {
    return
  }

  if (error) {
    setStatus(status, error.message, 'danger')
    renderMessages(messagesList, [])
    return
  }

  clearStatus(status)
  renderMessages(messagesList, data ?? [])

  if (form) {
    form.classList.remove('d-none')
  }

  if (emptyState) {
    emptyState.classList.add('d-none')
  }
}

async function refreshMessagesScreen({ preserveSelection = true } = {}) {
  const pageStatus = document.querySelector('[data-messages-status]')
  const conversationsList = document.querySelector('[data-conversations-list]')
  const conversationsMeta = document.querySelector('[data-conversations-meta]')
  const emptyState = document.querySelector('[data-message-empty-state]')
  const refreshConversationButton = document.querySelector('[data-refresh-conversation]')

  setTranslatedStatus(pageStatus, 'messages.loadingConversations', 'secondary')

  const { user, error: userError } = await getCurrentUser()

  if (userError) {
    setStatus(pageStatus, userError.message, 'danger')
    state.user = null
    state.conversations = []
    state.selectedConversationId = null
    renderConversationList(conversationsList)
    renderMessages(document.querySelector('[data-messages-list]'), [])

    if (conversationsMeta) {
      conversationsMeta.textContent = ''
    }

    if (emptyState) {
      emptyState.classList.remove('d-none')
      setI18nText(emptyState, 'messages.signedOut')
    }

    if (refreshConversationButton) {
      refreshConversationButton.disabled = true
    }

    return
  }

  if (!user) {
    state.user = null
    state.conversations = []
    state.selectedConversationId = null
    clearStatus(pageStatus)
    renderConversationList(conversationsList)
    renderMessages(document.querySelector('[data-messages-list]'), [])

    if (conversationsMeta) {
      conversationsMeta.textContent = ''
    }

    if (emptyState) {
      emptyState.classList.remove('d-none')
      setI18nText(emptyState, 'messages.signedOut')
    }

    if (refreshConversationButton) {
      refreshConversationButton.disabled = true
    }

    return
  }

  state.user = user

  const { data, error } = await getMyConversations()

  if (error) {
    setStatus(pageStatus, error.message, 'danger')
    state.conversations = []
    state.selectedConversationId = null
    renderConversationList(conversationsList)
    renderMessages(document.querySelector('[data-messages-list]'), [])

    if (conversationsMeta) {
      conversationsMeta.textContent = ''
    }

    if (emptyState) {
      emptyState.classList.remove('d-none')
      setI18nText(emptyState, 'messages.unableToLoadConversations')
    }

    if (refreshConversationButton) {
      refreshConversationButton.disabled = true
    }

    return
  }

  state.conversations = data ?? []

  if (conversationsMeta) {
    setI18nText(conversationsMeta, 'messages.conversationCount', {
      count: state.conversations.length,
      suffix: state.conversations.length === 1 ? '' : 's',
    })
  }

  const queryConversationId = getConversationFromUrl()
  const queryConversationExists = queryConversationId && state.conversations.some((conversation) => String(conversation.id) === String(queryConversationId))
  const nextSelectedConversationId = preserveSelection && state.selectedConversationId && state.conversations.some((conversation) => String(conversation.id) === String(state.selectedConversationId))
    ? state.selectedConversationId
    : queryConversationExists
      ? queryConversationId
      : state.conversations[0]?.id ?? null

  state.selectedConversationId = nextSelectedConversationId
  renderConversationList(conversationsList)

  if (!state.conversations.length) {
    if (emptyState) {
      emptyState.classList.remove('d-none')
      setI18nText(emptyState, 'messages.noAcceptedMatches')
    }

    setConversationSelection(null, { updateUrl: false })
    clearStatus(pageStatus)
    return
  }

  if (queryConversationId && !queryConversationExists) {
    setTranslatedStatus(pageStatus, 'messages.selectedConversationUnavailable', 'warning')
    updateConversationUrl(nextSelectedConversationId, true)
  } else {
    clearStatus(pageStatus)

    if (!queryConversationId && nextSelectedConversationId) {
      updateConversationUrl(nextSelectedConversationId, true)
    }
  }

  setConversationSelection(nextSelectedConversationId, { updateUrl: false })
  await loadMessagesForSelectedConversation({ quiet: true })
}

function bindConversationSelection() {
  const conversationsList = document.querySelector('[data-conversations-list]')

  if (!conversationsList) {
    return
  }

  conversationsList.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-conversation-id]')

    if (!button) {
      return
    }

    const conversationId = button.dataset.conversationId

    if (!conversationId || conversationId === state.selectedConversationId) {
      return
    }

    state.selectedConversationId = conversationId
    updateConversationUrl(conversationId, false)
    renderConversationList(conversationsList)
    await loadMessagesForSelectedConversation()
  })
}

function bindRefreshActions() {
  const refreshAllButton = document.querySelector('[data-refresh-messages]')
  const refreshConversationButton = document.querySelector('[data-refresh-conversation]')

  refreshAllButton?.addEventListener('click', async () => {
    refreshAllButton.disabled = true
    await refreshMessagesScreen({ preserveSelection: true })
    refreshAllButton.disabled = false
  })

  refreshConversationButton?.addEventListener('click', async () => {
    if (!state.selectedConversationId) {
      return
    }

    refreshConversationButton.disabled = true
    await loadMessagesForSelectedConversation()
    refreshConversationButton.disabled = false
  })
}

function bindMessageForm() {
  const form = document.querySelector('[data-message-form]')
  const input = document.querySelector('[data-message-input]')
  const sendButton = document.querySelector('[data-send-message]')
  const status = document.querySelector('[data-conversation-status]')

  if (!form || !input || !sendButton) {
    return
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (state.isSending || !state.selectedConversationId) {
      return
    }

    const body = String(input.value ?? '')

    if (!body.trim()) {
      setTranslatedStatus(status, 'messages.messageBodyEmpty', 'warning')
      input.focus()
      return
    }

    if (body.length > 2000) {
      setTranslatedStatus(status, 'messages.messageBodyTooLong', 'warning')
      input.focus()
      return
    }

    state.isSending = true
    sendButton.disabled = true
    input.disabled = true
    setTranslatedStatus(status, 'messages.sendingMessage', 'secondary')

    const { error } = await sendConversationMessage({
      conversationId: state.selectedConversationId,
      body,
    })

    state.isSending = false
    sendButton.disabled = false
    input.disabled = false

    if (error) {
      setStatus(status, error.message, 'danger')
      return
    }

    input.value = ''
    await loadMessagesForSelectedConversation()
    clearStatus(status)
  })
}

async function bindMessagesPage() {
  const page = document.querySelector('[data-messages-page]')
  const status = document.querySelector('[data-messages-status]')
  const conversationsMeta = document.querySelector('[data-conversations-meta]')
  const emptyState = document.querySelector('[data-message-empty-state]')

  if (!page || !status || !conversationsMeta || !emptyState) {
    return
  }

  bindConversationSelection()
  bindRefreshActions()
  bindMessageForm()

  const { user, error } = await getCurrentUser()

  if (error) {
    setStatus(status, error.message, 'danger')
    setI18nText(emptyState, 'messages.unableToCheckSignIn')
    return
  }

  if (!user) {
    setTranslatedStatus(status, 'messages.signedOut', 'warning')
    conversationsMeta.textContent = ''
    setI18nText(emptyState, 'messages.signedOut')
    document.querySelector('[data-conversations-list]')?.replaceChildren()
    document.querySelector('[data-messages-list]')?.replaceChildren()
    document.querySelector('[data-message-form]')?.classList.add('d-none')
    document.querySelector('[data-refresh-conversation]')?.setAttribute('disabled', 'disabled')
    return
  }

  await refreshMessagesScreen({ preserveSelection: false })
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindMessagesPage)
  return template
}