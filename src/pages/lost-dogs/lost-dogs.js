import template from './lost-dogs.html?raw'
import './lost-dogs.css'
import { t } from '../../i18n/i18n.js'
import { getLostDogReports } from '../../services/publicContentService.js'

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('lostDogs.pageTitle')}`
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

function createReportCard(report) {
  const column = document.createElement('div')
  column.className = 'col-12 col-lg-6'

  const card = document.createElement('article')
  card.className = 'card h-100 shadow-sm'

  const media = document.createElement('div')
  media.className = 'ratio ratio-4x3 bg-body-tertiary'

  if (report.dogPhotoUrl) {
    const image = document.createElement('img')
    image.src = report.dogPhotoUrl
    image.alt = t('lostDogs.photoAlt', { name: report.dogName || report.title || t('common.unnamedDog') })
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
  title.textContent = report.dogName ? `${report.dogName} ${t('lostDogs.lostSuffix')}` : t('lostDogs.lostReportTitle')

  const status = document.createElement('span')
  status.className = 'badge text-bg-danger align-self-start'
  setI18nText(status, 'lostDogs.active')

  const description = document.createElement('p')
  description.className = 'mb-0'
  description.textContent = report.description || t('lostDogs.noDescription')

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

  addDetail(t('lostDogs.dog'), report.dogName ? `${report.dogName}${report.dogBreed ? ` · ${report.dogBreed}` : ''}` : t('lostDogs.dogDetailsUnavailable'))
  addDetail(t('lostDogs.lostLocation'), report.last_seen_location)
  addDetail(t('lostDogs.lostDate'), formatDate(report.last_seen_date))
  addDetail(t('lostDogs.contact'), report.contact_phone || '')
  addDetail(t('lostDogs.created'), formatDate(report.created_at))

  body.append(title, status, description, details)
  card.append(media, body)
  column.append(card)

  return column
}

async function bindLostDogsPage() {
  const status = document.querySelector('[data-lost-dogs-status]')
  const list = document.querySelector('[data-lost-dogs-list]')
  const meta = document.querySelector('[data-lost-dogs-meta]')

  if (!status || !list || !meta) {
    return
  }

  setTranslatedStatus(status, 'lostDogs.loading', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getLostDogReports()

  if (error) {
    setStatus(status, error.message, 'danger')
    setI18nText(meta, 'lostDogs.unableToLoad')
    return
  }

  const reports = Array.isArray(data) ? data : []

  if (!reports.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    setI18nText(empty, 'lostDogs.empty')
    status.append(empty)

    setI18nText(meta, 'lostDogs.metaZero')
    return
  }

  status.innerHTML = ''
  setI18nText(meta, 'lostDogs.metaCount', {
    count: reports.length,
    suffix: reports.length === 1 ? '' : 's',
  })

  const fragment = document.createDocumentFragment()
  reports.forEach((report) => {
    fragment.append(createReportCard(report))
  })

  list.append(fragment)
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindLostDogsPage)
  return template
}