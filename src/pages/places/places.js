import template from './places.html?raw'
import './places.css'
import { getPlaces } from '../../services/publicContentService.js'

function setStatus(target, message, variant) {
  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
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
  title.textContent = place.name || 'Unnamed place'

  const badge = document.createElement('span')
  badge.className = 'badge text-bg-primary align-self-start'
  badge.textContent = place.type || 'Place'

  const location = document.createElement('p')
  location.className = 'text-secondary mb-0'
  location.textContent = [place.district, place.address].filter(Boolean).join(' · ') || 'No district or address provided'

  const description = document.createElement('p')
  description.className = 'mb-0'
  description.textContent = place.description || 'No description provided.'

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

  setStatus(status, 'Loading places...', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getPlaces()

  if (error) {
    setStatus(status, error.message, 'danger')
    meta.textContent = 'Unable to load places.'
    return
  }

  const places = Array.isArray(data) ? data : []

  if (!places.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    empty.textContent = 'No places available yet.'
    status.append(empty)

    meta.textContent = '0 places'
    return
  }

  status.innerHTML = ''
  meta.textContent = `${places.length} place${places.length === 1 ? '' : 's'}`

  const fragment = document.createDocumentFragment()
  places.forEach((place) => {
    fragment.append(createPlaceCard(place))
  })

  list.append(fragment)
}

export function renderPage() {
  queueMicrotask(bindPlacesPage)
  return template
}