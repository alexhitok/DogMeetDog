import template from './discover.html?raw'
import './discover.css'
import { getActiveDogs } from '../../services/dogService.js'

function setStatus(target, message, variant) {
  target.innerHTML = ''

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
}

function createDogCard(dog) {
  const column = document.createElement('div')
  column.className = 'col-12 col-md-6 col-xl-4'

  const card = document.createElement('article')
  card.className = 'card h-100 shadow-sm'

  const body = document.createElement('div')
  body.className = 'card-body d-flex flex-column'

  const title = document.createElement('h2')
  title.className = 'h5 card-title mb-2'
  title.textContent = dog.name || 'Unnamed dog'

  const details = document.createElement('p')
  details.className = 'text-secondary mb-3'

  const detailParts = [dog.breed, dog.district].filter(Boolean)
  details.textContent = detailParts.length ? detailParts.join(' · ') : 'No breed or district provided'

  const list = document.createElement('ul')
  list.className = 'list-unstyled small mb-0 d-grid gap-1'

  const addItem = (label, value) => {
    if (!value && value !== 0) {
      return
    }

    const item = document.createElement('li')
    item.textContent = `${label}: ${value}`
    list.append(item)
  }

  addItem('Age years', dog.age_years)
  addItem('Size', dog.size)
  addItem('Gender', dog.gender)
  addItem('Temperament', dog.temperament)

  if (dog.description) {
    const description = document.createElement('p')
    description.className = 'mt-3 mb-0'
    description.textContent = dog.description
    body.append(title, details, list, description)
  } else {
    body.append(title, details, list)
  }

  card.append(body)
  column.append(card)

  return column
}

async function bindDiscoverPage() {
  const status = document.querySelector('[data-discover-status]')
  const list = document.querySelector('[data-discover-list]')
  const meta = document.querySelector('[data-discover-meta]')

  if (!status || !list || !meta) {
    return
  }

  setStatus(status, 'Loading active dogs...', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getActiveDogs()

  if (error) {
    setStatus(status, error.message, 'danger')
    meta.textContent = 'Unable to load active dogs.'
    return
  }

  const dogs = Array.isArray(data) ? data : []

  if (!dogs.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    empty.textContent = 'No active dogs available yet.'
    status.append(empty)

    meta.textContent = '0 active dogs'
    return
  }

  status.innerHTML = ''
  meta.textContent = `${dogs.length} active dog${dogs.length === 1 ? '' : 's'}`

  const fragment = document.createDocumentFragment()
  dogs.forEach((dog) => {
    fragment.append(createDogCard(dog))
  })

  list.append(fragment)
}

export function renderPage() {
  queueMicrotask(bindDiscoverPage)
  return template
}