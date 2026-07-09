import template from './dog-detail.html?raw'
import './dog-detail.css'
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

function showDogPhoto(dog) {
  const image = document.querySelector('[data-dog-photo]')
  const placeholder = document.querySelector('[data-dog-photo-placeholder]')

  if (!image || !placeholder) {
    return
  }

  if (dog.photoUrl) {
    image.src = dog.photoUrl
    image.alt = `${dog.name || 'Dog'} photo`
    image.classList.remove('d-none')
    placeholder.classList.add('d-none')
    return
  }

  image.classList.add('d-none')
  placeholder.classList.remove('d-none')
}

async function bindDogDetailPage(dogId) {
  const status = document.querySelector('[data-dog-detail-status]')
  const content = document.querySelector('[data-dog-detail-content]')

  if (!status || !content) {
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

  showDogPhoto(dog)

  setText('[data-dog-name]', dog.name, 'Unnamed dog')

  const mainInfo = [dog.breed, dog.district].filter(Boolean).join(' · ')
  setText('[data-dog-main-info]', mainInfo, 'No breed or district provided')

  setText('[data-dog-age]', formatAge(dog.age_years))
  setText('[data-dog-size]', dog.size)
  setText('[data-dog-gender]', dog.gender)
  setText('[data-dog-temperament]', dog.temperament)
  setText('[data-dog-district]', dog.district)
  setText('[data-dog-description]', dog.description, 'No description yet.')
}

export function renderPage(params = {}) {
  queueMicrotask(() => bindDogDetailPage(params.id))
  return template
}