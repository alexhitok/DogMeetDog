import template from './adoption.html?raw'
import './adoption.css'
import { t } from '../../i18n/i18n.js'
import { getAdoptionPosts } from '../../services/publicContentService.js'

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('adoption.pageTitle')}`
}

function setStatus(target, message, variant, translationKey = '', replacements = {}) {
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

function formatDate(value) {
  if (!value) {
    return t('common.notProvided')
  }

  return new Date(value).toLocaleDateString()
}

function createAdoptionCard(post) {
  const column = document.createElement('div')
  column.className = 'col-12 col-lg-6'

  const card = document.createElement('article')
  card.className = 'card h-100 shadow-sm'

  const media = document.createElement('div')
  media.className = 'ratio ratio-4x3 bg-body-tertiary'

  if (post.dogPhotoUrl) {
    const image = document.createElement('img')
    image.src = post.dogPhotoUrl
    image.alt = t('adoption.photoAlt', { name: post.dogName || post.title || t('common.unnamedDog') })
    image.className = 'w-100 h-100 object-fit-cover'
    media.append(image)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'd-flex align-items-center justify-content-center text-secondary small'
    setI18nText(placeholder, 'common.noPhoto')
    media.append(placeholder)
  }

  const body = document.createElement('div')
  body.className = 'card-body d-flex flex-column gap-2'

  const title = document.createElement('h2')
  title.className = 'h5 card-title mb-0'
  title.textContent = post.title || t('adoption.untitledPost')

  const status = document.createElement('span')
  status.className = 'badge text-bg-success align-self-start'
  setI18nText(status, 'adoption.published')

  const description = document.createElement('p')
  description.className = 'mb-0'
  description.textContent = post.description || t('adoption.noDescription')

  const details = document.createElement('dl')
  details.className = 'row small mb-0'

  const addDetail = (label, value) => {
    if (!value) {
      return
    }

    const term = document.createElement('dt')
    term.className = 'col-4 col-sm-3'
    term.textContent = label

    const definition = document.createElement('dd')
    definition.className = 'col-8 col-sm-9 mb-1'
    definition.textContent = value

    details.append(term, definition)
  }

  addDetail(t('adoption.dog'), post.dogName ? `${post.dogName}${post.dogBreed ? ` · ${post.dogBreed}` : ''}` : t('adoption.dogDetailsUnavailable'))
  addDetail(t('adoption.contact'), post.contact_phone || '')
  addDetail(t('adoption.created'), formatDate(post.created_at))

  body.append(title, status, description, details)
  card.append(media, body)
  column.append(card)

  return column
}

async function bindAdoptionPage() {
  const status = document.querySelector('[data-adoption-status]')
  const list = document.querySelector('[data-adoption-list]')
  const meta = document.querySelector('[data-adoption-meta]')

  if (!status || !list || !meta) {
    return
  }

  setTranslatedStatus(status, 'adoption.loading', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getAdoptionPosts()

  if (error) {
    setStatus(status, error.message, 'danger')
    setI18nText(meta, 'adoption.unableToLoad')
    return
  }

  const posts = Array.isArray(data) ? data : []

  if (!posts.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    setI18nText(empty, 'adoption.empty')
    status.append(empty)

    setI18nText(meta, 'adoption.metaZero')
    return
  }

  status.innerHTML = ''
  setI18nText(meta, 'adoption.metaCount', {
    count: posts.length,
    suffix: posts.length === 1 ? '' : 's',
  })

  const fragment = document.createDocumentFragment()
  posts.forEach((post) => {
    fragment.append(createAdoptionCard(post))
  })

  list.append(fragment)
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindAdoptionPage)
  return template
}