import template from './admin.html?raw'
import './admin.css'
import { deleteDogAsAdmin, getAdminDogs, getAdminRoles, getCurrentUserRole } from '../../services/adminService.js'

function setStatus(target, message, variant) {
  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
}

function formatDateTime(value) {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleString()
}

function createSummaryCard(title, value, helperText) {
  const column = document.createElement('div')
  column.className = 'col-12 col-md-4'

  const card = document.createElement('article')
  card.className = 'card shadow-sm admin-summary-card'

  const body = document.createElement('div')
  body.className = 'card-body'

  const cardTitle = document.createElement('div')
  cardTitle.className = 'text-secondary small text-uppercase mb-2'
  cardTitle.textContent = title

  const cardValue = document.createElement('div')
  cardValue.className = 'display-6 fw-semibold mb-1'
  cardValue.textContent = value

  const cardHelper = document.createElement('div')
  cardHelper.className = 'text-secondary small'
  cardHelper.textContent = helperText

  body.append(cardTitle, cardValue, cardHelper)
  card.append(body)
  column.append(card)

  return column
}

function createDogPhotoCell(dog) {
  const wrapper = document.createElement('div')
  wrapper.className = 'd-flex align-items-center gap-2'

  if (dog.photoUrl) {
    const image = document.createElement('img')
    image.className = 'rounded border admin-dog-thumb'
    image.src = dog.photoUrl
    image.alt = `${dog.name || 'Dog'} photo`
    wrapper.append(image)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'rounded border bg-body-tertiary d-flex align-items-center justify-content-center text-secondary small admin-thumb-placeholder'
    placeholder.textContent = 'No photo'
    wrapper.append(placeholder)
  }

  return wrapper
}

function createTableBadge(value, variant = 'secondary') {
  const badge = document.createElement('span')
  badge.className = `badge text-bg-${variant}`
  badge.textContent = value
  return badge
}

function createDogRow(dog, onDelete) {
  const row = document.createElement('tr')

  const photoCell = document.createElement('td')
  photoCell.append(createDogPhotoCell(dog))

  const nameCell = document.createElement('td')
  const name = document.createElement('div')
  name.className = 'fw-semibold'
  name.textContent = dog.name || 'Unnamed dog'
  const meta = document.createElement('div')
  meta.className = 'small text-secondary'
  meta.textContent = `ID: ${dog.id}`
  nameCell.append(name, meta)

  const breedCell = document.createElement('td')
  breedCell.textContent = dog.breed || '—'

  const districtCell = document.createElement('td')
  districtCell.textContent = dog.district || '—'

  const statusCell = document.createElement('td')
  statusCell.append(createTableBadge(dog.status || 'unknown', dog.status === 'active' ? 'success' : 'secondary'))

  const ownerCell = document.createElement('td')
  ownerCell.textContent = dog.ownerFullName || dog.owner_id || '—'

  const actionsCell = document.createElement('td')
  const actions = document.createElement('div')
  actions.className = 'd-flex flex-wrap gap-2'

  const viewLink = document.createElement('a')
  viewLink.className = 'btn btn-outline-primary btn-sm'
  viewLink.href = `/dogs/${dog.id}`
  viewLink.textContent = 'View profile'
  viewLink.setAttribute('data-link', '')

  const deleteButton = document.createElement('button')
  deleteButton.type = 'button'
  deleteButton.className = 'btn btn-outline-danger btn-sm'
  deleteButton.textContent = 'Delete'
  deleteButton.addEventListener('click', () => {
    const confirmed = window.confirm(`Delete ${dog.name || 'this dog'}? This action cannot be undone.`)

    if (!confirmed) {
      return
    }

    onDelete(dog.id)
  })

  actions.append(viewLink, deleteButton)
  actionsCell.append(actions)

  row.append(photoCell, nameCell, breedCell, districtCell, statusCell, ownerCell, actionsCell)

  return row
}

function createRoleRow(roleRow) {
  const row = document.createElement('tr')

  const fullNameCell = document.createElement('td')
  fullNameCell.textContent = roleRow.fullName || '—'

  const userIdCell = document.createElement('td')
  userIdCell.textContent = roleRow.user_id

  const roleCell = document.createElement('td')
  roleCell.append(createTableBadge(roleRow.role, roleRow.role === 'admin' ? 'danger' : 'secondary'))

  const createdCell = document.createElement('td')
  createdCell.textContent = formatDateTime(roleRow.created_at)

  row.append(fullNameCell, userIdCell, roleCell, createdCell)

  return row
}

async function renderAdminDashboard() {
  const status = document.querySelector('[data-admin-status]')
  const view = document.querySelector('[data-admin-view]')
  const summary = document.querySelector('[data-admin-summary]')
  const userEmail = document.querySelector('[data-admin-user-email]')
  const userRole = document.querySelector('[data-admin-user-role]')
  const dogsBody = document.querySelector('[data-admin-dogs-body]')
  const rolesBody = document.querySelector('[data-admin-roles-body]')
  const dogsMeta = document.querySelector('[data-admin-dogs-meta]')
  const rolesMeta = document.querySelector('[data-admin-roles-meta]')

  if (!status || !view || !summary || !userEmail || !userRole || !dogsBody || !rolesBody || !dogsMeta || !rolesMeta) {
    return
  }

  setStatus(status, 'Loading admin panel...', 'secondary')
  view.classList.add('d-none')

  const { user, role, isAdmin, error } = await getCurrentUserRole()

  if (error) {
    setStatus(status, error.message, 'danger')
    return
  }

  if (!user) {
    setStatus(status, 'Please sign in to access the admin panel.', 'warning')
    return
  }

  if (!isAdmin) {
    setStatus(status, 'Access denied.', 'danger')
    return
  }

  const [{ data: dogs = [], error: dogsError }, { data: roles = [], error: rolesError }] = await Promise.all([
    getAdminDogs(),
    getAdminRoles(),
  ])

  if (dogsError) {
    setStatus(status, dogsError.message, 'danger')
    return
  }

  if (rolesError) {
    setStatus(status, rolesError.message, 'danger')
    return
  }

  const handleDeleteDog = async (dogId) => {
    const { error: deleteError } = await deleteDogAsAdmin(dogId)

    if (deleteError) {
      setStatus(status, deleteError.message, 'danger')
      return
    }

    setStatus(status, 'Dog deleted successfully.', 'success')
    await refreshDogs()
  }

  async function refreshDogs() {
    const { data: refreshedDogs = [], error: refreshError } = await getAdminDogs()

    if (refreshError) {
      setStatus(status, refreshError.message, 'danger')
      return
    }

    dogsBody.replaceChildren(...refreshedDogs.map((dog) => createDogRow(dog, handleDeleteDog)))
    dogsMeta.textContent = `${refreshedDogs.length} total dog${refreshedDogs.length === 1 ? '' : 's'}`
    summary.replaceChildren(
      createSummaryCard('Total dogs', String(refreshedDogs.length), 'All dogs in the database'),
      createSummaryCard('Active dogs', String(refreshedDogs.filter((dog) => dog.status === 'active').length), 'Public active listings'),
      createSummaryCard('Total roles', String(roles.length), 'Rows in public.user_roles')
    )
  }

  status.innerHTML = ''
  view.classList.remove('d-none')
  userEmail.textContent = user.email || 'Not available'
  userRole.textContent = role || '—'

  rolesMeta.textContent = `${roles.length} role row${roles.length === 1 ? '' : 's'}`
  rolesBody.replaceChildren(...roles.map((roleRow) => createRoleRow(roleRow)))

  await refreshDogs()
}

export function renderPage() {
  queueMicrotask(renderAdminDashboard)
  return template
}