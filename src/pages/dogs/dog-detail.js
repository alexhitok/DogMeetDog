import template from './dog-detail.html?raw'
import './dog-detail.css'
import Carousel from 'bootstrap/js/dist/carousel'
import { getDogById } from '../../services/dogService.js'

function setStatus(target, message, variant) {
  target.innerHTML = ''

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
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

function formatAge(ageYears) {
  if (ageYears === null || ageYears === undefined || ageYears === '') {
    return 'Not provided'
  }

  return `${ageYears} year${Number(ageYears) === 1 ? '' : 's'}`
}

function sortDogPhotos(photos) {
  return [...photos].sort((left, right) => {
    if (left.is_main !== right.is_main) {
      return Number(right.is_main) - Number(left.is_main)
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
  })
}

function showDogPhotos(dog) {
  const carouselInner = document.querySelector('[data-dog-photos-carousel]')
  const placeholder = document.querySelector('[data-dog-photo-placeholder]')
  const downloadButton = document.querySelector('[data-dog-photo-download]')
  const prevButton = document.querySelector('[data-dog-carousel-prev]')
  const nextButton = document.querySelector('[data-dog-carousel-next]')
  const indicators = document.querySelector('[data-dog-carousel-indicators]')

  if (!carouselInner || !placeholder || !downloadButton || !prevButton || !nextButton || !indicators) {
    return
  }

  const photos = Array.isArray(dog.dog_photos) ? sortDogPhotos(dog.dog_photos) : []

  if (!photos.length) {
    carouselInner.parentElement.classList.add('d-none')
    placeholder.classList.remove('d-none')
    downloadButton.classList.add('d-none')
    return
  }

  carouselInner.parentElement.classList.remove('d-none')
  placeholder.classList.add('d-none')
  downloadButton.classList.remove('d-none')

  carouselInner.replaceChildren()

  photos.forEach((photo, index) => {
    const item = document.createElement('div')
    item.className = `carousel-item ${index === 0 ? 'active' : ''}`

    const img = document.createElement('img')
    img.src = photo.image_url
    img.alt = `${dog.name || 'Dog'} photo ${index + 1}`
    img.className = 'd-block w-100'

    item.append(img)
    carouselInner.append(item)
  })

  if (photos.length > 1) {
    prevButton.classList.remove('d-none')
    nextButton.classList.remove('d-none')
    indicators.classList.remove('d-none')
    indicators.replaceChildren()

    photos.forEach((photo, index) => {
      const indicator = document.createElement('button')
      indicator.type = 'button'
      indicator.setAttribute('data-bs-target', '#dmdDogCarousel')
      indicator.setAttribute('data-bs-slide-to', String(index))
      if (index === 0) {
        indicator.classList.add('active')
        indicator.setAttribute('aria-current', 'true')
      }
      indicator.setAttribute('aria-label', `Photo ${index + 1}`)
      indicators.append(indicator)
    })
  } else {
    prevButton.classList.add('d-none')
    nextButton.classList.add('d-none')
    indicators.classList.add('d-none')
  }
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
  const photos = Array.isArray(dog.dog_photos) ? sortDogPhotos(dog.dog_photos) : []
  const photoUrl = photos[0]?.image_url ?? dog.photoUrl

  if (!photoUrl) {
    return
  }

  try {
    const response = await fetch(photoUrl)

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
    window.open(photoUrl, '_blank', 'noopener')
  }
}

async function bindDogDetailPage(dogId) {
  const status = document.querySelector('[data-dog-detail-status]')
  const content = document.querySelector('[data-dog-detail-content]')
  const downloadButton = document.querySelector('[data-dog-photo-download]')

  if (!status || !content || !downloadButton) {
    return
  }

  setStatus(status, 'Loading dog profile...', 'secondary')
  content.classList.add('d-none')

  const { data: dog, error } = await getDogById(dogId)

  if (error) {
    setStatus(status, error.message, 'danger')
    return
  }

  if (!dog) {
    setStatus(status, 'Dog profile was not found.', 'warning')
    return
  }

  status.innerHTML = ''
  content.classList.remove('d-none')

  showDogPhotos(dog)

  const carouselElement = document.querySelector('#dmdDogCarousel')

  if (carouselElement) {
    new Carousel(carouselElement, { ride: false })
  }

  downloadButton.onclick = async () => {
    await downloadDogPhoto(dog)
  }

  setText('[data-dog-name]', dog.name, 'Unnamed dog')

  const mainInfo = [dog.breed, dog.district].filter(Boolean).join(' · ')
  setText('[data-dog-main-info]', mainInfo, 'No breed or district provided')

  setText('[data-dog-age]', formatAge(dog.age_years))
  setText('[data-dog-size]', dog.size)
  setText('[data-dog-gender]', dog.gender)
  setText('[data-dog-temperament]', dog.temperament)
  setText('[data-dog-district]', dog.district)
  setText('[data-dog-description]', dog.description, 'No description yet.')

  if (window.lucide?.createIcons) {
    window.lucide.createIcons()
  }
}

export function renderPage(params = {}) {
  queueMicrotask(() => bindDogDetailPage(params.id))
  return template
}
