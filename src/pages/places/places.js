import template from './places.html?raw'
import './places.css'
import { t } from '../../i18n/i18n.js'
import { getPlaces } from '../../services/publicContentService.js'

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('places.pageTitle')}`
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

function createPlaceCard(place) {
  const column = document.createElement('div')
  column.className = 'col-12 col-lg-6'

  const card = document.createElement('article')
  card.className = 'card h-100 shadow-sm'

  const body = document.createElement('div')
  body.className = 'card-body d-flex flex-column gap-2'

  const title = document.createElement('h2')
  title.className = 'h5 card-title mb-0'
  title.textContent = place.name || t('places.unnamedPlace')

  const badge = document.createElement('span')
  badge.className = 'badge text-bg-primary align-self-start'
  badge.textContent = place.type || t('places.place')

  const location = document.createElement('p')
  location.className = 'text-secondary mb-0'
  location.textContent = [place.district, place.address].filter(Boolean).join(' · ') || t('places.noDistrictOrAddress')

  const description = document.createElement('p')
  description.className = 'mb-0'
  description.textContent = place.description || t('places.noDescription')

  body.append(title, badge, location, description)
  card.append(body)
  column.append(card)

  return column
}

async function bindPlacesPage() {
  const status = document.querySelector('[data-places-status]')
  const list = document.querySelector('[data-places-list]')
  const meta = document.querySelector('[data-places-meta]')

  if (!status || !list || !meta) {
    return
  }

  setTranslatedStatus(status, 'places.loading', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getPlaces()

  if (error) {
    setStatus(status, error.message, 'danger')
    setI18nText(meta, 'places.unableToLoad')
    return
  }

  const places = Array.isArray(data) ? data : []

  if (!places.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    setI18nText(empty, 'places.empty')
    status.append(empty)

    setI18nText(meta, 'places.metaZero')
    return
  }

  status.innerHTML = ''
  setI18nText(meta, 'places.metaCount', {
    count: places.length,
    suffix: places.length === 1 ? '' : 's',
  })

  const fragment = document.createDocumentFragment()
  places.forEach((place) => {
    fragment.append(createPlaceCard(place))
  })

  list.append(fragment)
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindPlacesPage)
  return template
}