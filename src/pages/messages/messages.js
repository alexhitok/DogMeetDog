import template from './messages.html?raw'
import './messages.css'
import { getCurrentUser } from '../../services/authService.js'
import { getConversationMessages, getMyConversations, sendConversationMessage } from '../../services/messagingService.js'

const state = {
  user: null,
  conversations: [],
  selectedConversationId: null,
  loadVersion: 0,
  isSending: false,
}

function setStatus(target, message, variant) {
  if (!target) {
    return
  }

  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
}

function clearStatus(target) {
  if (target) {
    target.replaceChildren()
  }
}

function formatDate(value) {
  if (!value) {
    return 'Unknown date'
  }

  return new Date(value).toLocaleDateString()
}

function formatDateTime(value) {
  if (!value) {
    return 'Unknown time'
  }

  return new Date(value).toLocaleString()
}

function getConversationTitle(conversation) {
  const dogNames = [conversation?.senderDog?.name, conversation?.recipientDog?.name].filter(Boolean)

  if (!dogNames.length) {
    return 'Conversation'
  }

  if (dogNames.length === 1) {
    return dogNames[0]
  }

  return `${dogNames[0]} ↔ ${dogNames[1]}`
}

function getConversationSubtitle(conversation) {
  if (!conversation) {
    return 'Choose an accepted match from the list.'
  }

  return `Accepted match · Created ${formatDate(conversation.created_at)}`
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
    empty.textContent = 'No accepted matches yet.'
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
    empty.textContent = 'No messages yet. Send the first one below.'
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
    meta.textContent = `${isOwnMessage ? 'You' : 'Other owner'} · ${formatDateTime(message.created_at)}`

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
      title.textContent = 'Select a conversation'
    }

    if (subtitle) {
      subtitle.textContent = 'Choose an accepted match from the list.'
    }

    if (form) {
      form.classList.add('d-none')
    }

    if (emptyState) {
      emptyState.classList.remove('d-none')
      emptyState.textContent = state.conversations.length ? 'Select a conversation to start messaging.' : 'No accepted matches yet.'
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
      emptyState.textContent = state.conversations.length ? 'Select a conversation to start messaging.' : 'No accepted matches yet.'
    }

    clearStatus(status)
    return
  }

  if (!quiet) {
    setStatus(status, 'Loading messages...', 'secondary')
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

  setStatus(pageStatus, 'Loading conversations...', 'secondary')

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
      emptyState.textContent = 'Sign in to view your conversations.'
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
      emptyState.textContent = 'Sign in to view your conversations.'
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
      emptyState.textContent = 'Unable to load conversations.'
    }

    if (refreshConversationButton) {
      refreshConversationButton.disabled = true
    }

    return
  }

  state.conversations = data ?? []

  if (conversationsMeta) {
    conversationsMeta.textContent = `${state.conversations.length} conversation${state.conversations.length === 1 ? '' : 's'}`
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
      emptyState.textContent = 'No accepted matches yet.'
    }

    setConversationSelection(null, { updateUrl: false })
    clearStatus(pageStatus)
    return
  }

  if (queryConversationId && !queryConversationExists) {
    setStatus(pageStatus, 'The selected conversation is not available. Showing your latest match instead.', 'warning')
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
      setStatus(status, 'Message body cannot be empty.', 'warning')
      input.focus()
      return
    }

    if (body.length > 2000) {
      setStatus(status, 'Message body must be 2000 characters or fewer.', 'warning')
      input.focus()
      return
    }

    state.isSending = true
    sendButton.disabled = true
    input.disabled = true
    setStatus(status, 'Sending message...', 'secondary')

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
    emptyState.textContent = 'Unable to check your sign-in status.'
    return
  }

  if (!user) {
    setStatus(status, 'Sign in to view your conversations.', 'warning')
    conversationsMeta.textContent = ''
    emptyState.textContent = 'Sign in to view your conversations.'
    document.querySelector('[data-conversations-list]')?.replaceChildren()
    document.querySelector('[data-messages-list]')?.replaceChildren()
    document.querySelector('[data-message-form]')?.classList.add('d-none')
    document.querySelector('[data-refresh-conversation]')?.setAttribute('disabled', 'disabled')
    return
  }

  await refreshMessagesScreen({ preserveSelection: false })
}

export function renderPage() {
  queueMicrotask(bindMessagesPage)
  return template
}