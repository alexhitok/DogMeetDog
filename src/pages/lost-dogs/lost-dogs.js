import template from './lost-dogs.html?raw'
import './lost-dogs.css'
import { getLostDogReports } from '../../services/publicContentService.js'

function setStatus(target, message, variant) {
  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
}

function formatDate(value) {
  if (!value) {
    return 'Not provided'
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
    image.alt = `${report.dogName || report.title || 'Dog'} photo`
    image.className = 'w-100 h-100 object-fit-cover'
    media.append(image)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'd-flex align-items-center justify-content-center text-secondary small'
    placeholder.textContent = 'No photo'
    media.append(placeholder)
  }

  const body = document.createElement('div')
  body.className = 'card-body d-flex flex-column gap-2'

  const title = document.createElement('h2')
  title.className = 'h5 card-title mb-0'
  title.textContent = report.dogName ? `${report.dogName} is lost` : 'Lost dog report'

  const status = document.createElement('span')
  status.className = 'badge text-bg-danger align-self-start'
  status.textContent = report.status || 'active'

  const description = document.createElement('p')
  description.className = 'mb-0'
  description.textContent = report.description || 'No description provided.'

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

  addDetail('Dog', report.dogName ? `${report.dogName}${report.dogBreed ? ` · ${report.dogBreed}` : ''}` : 'Dog details not available')
  addDetail('Lost location', report.last_seen_location)
  addDetail('Lost date', formatDate(report.last_seen_date))
  addDetail('Contact', report.contact_phone || '')
  addDetail('Created', formatDate(report.created_at))

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

  setStatus(status, 'Loading lost dog reports...', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getLostDogReports()

  if (error) {
    setStatus(status, error.message, 'danger')
    meta.textContent = 'Unable to load lost dog reports.'
    return
  }

  const reports = Array.isArray(data) ? data : []

  if (!reports.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    empty.textContent = 'No active lost dog reports available yet.'
    status.append(empty)

    meta.textContent = '0 reports'
    return
  }

  status.innerHTML = ''
  meta.textContent = `${reports.length} active report${reports.length === 1 ? '' : 's'}`

  const fragment = document.createDocumentFragment()
  reports.forEach((report) => {
    fragment.append(createReportCard(report))
  })

  list.append(fragment)
}

export function renderPage() {
  queueMicrotask(bindLostDogsPage)
  return template
}