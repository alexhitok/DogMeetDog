import template from './adoption.html?raw'
import './adoption.css'
import { getAdoptionPosts } from '../../services/publicContentService.js'

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
    image.alt = `${post.dogName || post.title || 'Dog'} photo`
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
  title.textContent = post.title || 'Untitled adoption post'

  const status = document.createElement('span')
  status.className = 'badge text-bg-success align-self-start'
  status.textContent = post.status || 'published'

  const description = document.createElement('p')
  description.className = 'mb-0'
  description.textContent = post.description || 'No description provided.'

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

  addDetail('Dog', post.dogName ? `${post.dogName}${post.dogBreed ? ` · ${post.dogBreed}` : ''}` : 'Dog details not available')
  addDetail('Contact', post.contact_phone || '')
  addDetail('Created', formatDate(post.created_at))

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

  setStatus(status, 'Loading adoption posts...', 'secondary')
  meta.textContent = ''
  list.innerHTML = ''

  const { data, error } = await getAdoptionPosts()

  if (error) {
    setStatus(status, error.message, 'danger')
    meta.textContent = 'Unable to load adoption posts.'
    return
  }

  const posts = Array.isArray(data) ? data : []

  if (!posts.length) {
    status.innerHTML = ''

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0'
    empty.setAttribute('role', 'alert')
    empty.textContent = 'No adoption posts available yet.'
    status.append(empty)

    meta.textContent = '0 adoption posts'
    return
  }

  status.innerHTML = ''
  meta.textContent = `${posts.length} adoption post${posts.length === 1 ? '' : 's'}`

  const fragment = document.createDocumentFragment()
  posts.forEach((post) => {
    fragment.append(createAdoptionCard(post))
  })

  list.append(fragment)
}

export function renderPage() {
  queueMicrotask(bindAdoptionPage)
  return template
}