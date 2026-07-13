import template from './dog-detail.html?raw'
import './dog-detail.css'
import { t } from '../../i18n/i18n.js'
import { getDogById } from '../../services/dogService.js'

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('dogDetail.pageTitle')}`
}

function setStatus(target, message, variant, translationKey = '', replacements = {}) {
  target.innerHTML = ''

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

function setText(selector, value, fallback = 'Not provided') {
  const element = document.querySelector(selector)

  if (!element) {
    return
  }

  element.textContent = value || value === 0 ? value : fallback
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

function formatAge(ageYears) {
  if (ageYears === null || ageYears === undefined || ageYears === '') {
    return t('common.notProvided')
  }

  return `${ageYears} ${Number(ageYears) === 1 ? t('common.yearSingular') : t('common.yearPlural')}`
}

function showDogPhoto(dog) {
  const image = document.querySelector('[data-dog-photo]')
  const placeholder = document.querySelector('[data-dog-photo-placeholder]')
  const downloadButton = document.querySelector('[data-dog-photo-download]')

  if (!image || !placeholder || !downloadButton) {
    return
  }

  if (dog.photoUrl) {
    image.src = dog.photoUrl
    image.alt = t('dogDetail.photoAlt', { name: dog.name || t('common.unnamedDog') })
    image.classList.remove('d-none')
    placeholder.classList.add('d-none')
    downloadButton.classList.remove('d-none')
    return
  }

  image.classList.add('d-none')
  placeholder.classList.remove('d-none')
  downloadButton.classList.add('d-none')
}

function buildSafeDownloadFileName(dogName, contentType = '') {
  const slug = String(dogName || 'dogmeetdog')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'dogmeetdog'

  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
  }

  const extension = extensionMap[contentType.toLowerCase()] || 'jpg'

  return `dogmeetdog-${slug}-photo.${extension}`
}

async function downloadDogPhoto(dog) {
  if (!dog.photoUrl) {
    return
  }

  try {
    const response = await fetch(dog.photoUrl)

    if (!response.ok) {
      throw new Error('Photo download failed.')
    }

    const blob = await response.blob()
    const objectUrl = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = buildSafeDownloadFileName(dog.name, blob.type)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()

    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000)
  } catch {
    window.open(dog.photoUrl, '_blank', 'noopener')
  }
}

async function bindDogDetailPage(dogId) {
  const status = document.querySelector('[data-dog-detail-status]')
  const content = document.querySelector('[data-dog-detail-content]')
  const downloadButton = document.querySelector('[data-dog-photo-download]')

  if (!status || !content || !downloadButton) {
    return
  }

  setTranslatedStatus(status, 'dogDetail.loading', 'secondary')
  content.classList.add('d-none')

  const { data: dog, error } = await getDogById(dogId)

  if (error) {
    setStatus(status, error.message, 'danger')
    return
  }

  if (!dog) {
    setTranslatedStatus(status, 'dogDetail.notFound', 'warning')
    return
  }

  status.innerHTML = ''
  content.classList.remove('d-none')

  showDogPhoto(dog)

  downloadButton.onclick = async () => {
    await downloadDogPhoto(dog)
  }

  setText('[data-dog-name]', dog.name, t('common.unnamedDog'))

  const mainInfo = [dog.breed, dog.district].filter(Boolean).join(' · ')
  setText('[data-dog-main-info]', mainInfo, t('dogDetail.noBreedOrDistrict'))

  setText('[data-dog-age]', formatAge(dog.age_years))
  setText('[data-dog-size]', dog.size)
  setText('[data-dog-gender]', dog.gender)
  setText('[data-dog-temperament]', dog.temperament)
  setText('[data-dog-district]', dog.district)
  setText('[data-dog-description]', dog.description, t('dogDetail.noDescriptionYet'))
}

export function renderPage(params = {}) {
  bindTitleSync()
  queueMicrotask(() => bindDogDetailPage(params.id))
  return template
}