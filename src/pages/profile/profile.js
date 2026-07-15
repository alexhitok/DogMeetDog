import template from './profile.html?raw'
import './profile.css'
import { getCurrentLanguage, t } from '../../i18n/i18n.js'
import { getCurrentUser, logoutUser } from '../../services/authService.js'
import { createDogProfile, deleteDogById, getMyDogs, updateDogById, uploadDogPhotos } from '../../services/dogService.js'
import { getMyPlaydateRequests, updatePlaydateRequestStatus } from '../../services/playdateService.js'
import { getOrCreateConversation } from '../../services/messagingService.js'
import {
  formatApproximateDogLocation,
  getLocalizedDistrictName,
  resolveApproximateDogLocation,
} from '../../utils/approximateLocation.js'

let profileFormController = null
let titleSyncBound = false

function getLocalizedDogStatus(status) {
  const normalizedStatus = String(status ?? '').trim().toLowerCase()

  if (!normalizedStatus) {
    return t('profile.unknown')
  }

  if (normalizedStatus === 'active') {
    return t('lostDogs.active')
  }

  return String(status)
}

function handleLanguageChanged() {
  updatePageTitle()
  queueMicrotask(() => {
    void refreshMyDogs()
    void refreshPlaydateDashboard()
  })
}

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', handleLanguageChanged)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('profile.pageTitle')}`
}

function setMessage(target, message, variant) {
  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderDogCards(dogs) {
  const language = getCurrentLanguage()

  if (!dogs.length) {
    return `
      <div class="col-12">
        <div class="alert alert-light border mb-0" role="alert">
          ${escapeHtml(t('profile.noDogsYet'))}
        </div>
      </div>
    `
  }

  return dogs
    .map((dog) => {
      const dogId = encodeURIComponent(dog.id)
      const dogName = escapeHtml(dog.name ?? t('common.unnamedDog'))
      const dogBreed = escapeHtml(dog.breed ?? t('common.notProvided'))
      const dogDistrict = escapeHtml(getLocalizedDistrictName(dog.district, language) || t('common.notProvided'))
      const dogStatus = escapeHtml(getLocalizedDogStatus(dog.status))
      const dogLocation = escapeHtml(formatApproximateDogLocation(dog, language))
      const photoUrl = dog.photoUrl ? escapeHtml(dog.photoUrl) : ''
      const shortDescription = dog.description ? escapeHtml(dog.description.slice(0, 140)) : ''

      const photoMarkup = photoUrl
        ? `
          <img
            src="${photoUrl}"
            class="w-100 h-100 object-fit-cover"
            alt="${escapeHtml(t('common.photoAlt', { name: dog.name ?? t('common.unnamedDog') }))}"
          />
        `
        : `
          <div class="d-flex align-items-center justify-content-center text-secondary small h-100">
            ${escapeHtml(t('profile.noPhoto'))}
          </div>
        `

      return `
        <div class="col-12 col-lg-6">
          <article class="card h-100 shadow-sm profile-dog-card">
            <div class="ratio ratio-4x3 bg-body-tertiary profile-dog-card__media">
                ${photoMarkup}
            </div>

            <div class="card-body profile-dog-card__body">
                <h3 class="h6 card-title mb-2">${dogName}</h3>
              <p class="text-secondary mb-2">${dogBreed} · ${dogDistrict}</p>
              <p class="mb-2"><span class="fw-semibold">${escapeHtml(t('profile.status'))}:</span> ${dogStatus}</p>
              <p class="mb-2"><span class="fw-semibold">${escapeHtml(t('profile.location'))}:</span> ${dogLocation}</p>
              ${shortDescription ? `<p class="mb-0">${shortDescription}</p>` : `<p class="mb-0 text-secondary">${escapeHtml(t('profile.noDescription'))}</p>`}

                <div class="profile-dog-card__actions mt-3">
                  <a href="/dogs/${dogId}" class="btn btn-outline-primary btn-sm" data-link>
                    ${escapeHtml(t('profile.viewProfile'))}
                </a>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  data-edit-dog-id="${dogId}"
                  data-dog-name="${dogName}"
                >
                  ${escapeHtml(t('profile.edit'))}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-success btn-sm"
                  data-add-photos-dog-id="${dogId}"
                  data-dog-name="${dogName}"
                >
                  ${escapeHtml(t('profile.addPhotos'))}
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-delete-dog-id="${dogId}"
                  data-dog-name="${dogName}"
                >
                  ${escapeHtml(t('profile.delete'))}
                </button>
              </div>
            </div>
          </article>
        </div>
      `
    })
    .join('')
}

function buildApproximateLocationPayload({ locationCity, district }) {
  const location = resolveApproximateDogLocation({ location_city: locationCity, district })
  const hasLocationText = Boolean(location.city || location.district)

  return {
    locationCity: location.city || null,
    locationLatitude: location.latitude,
    locationLongitude: location.longitude,
    locationVisibility: hasLocationText ? 'approximate' : 'hidden',
  }
}

async function refreshMyDogs() {
  const list = document.querySelector('[data-my-dogs-list]')
  const status = document.querySelector('[data-my-dogs-status]')

  if (!list || !status) {
    return
  }

  const { data, error } = await getMyDogs()

  if (error) {
    setMessage(status, error.message, 'danger')
    list.innerHTML = ''
    return
  }

  status.innerHTML = ''
  list.innerHTML = renderDogCards(data ?? [])
}

function bindMyDogsActions() {
  const list = document.querySelector('[data-my-dogs-list]')
  const status = document.querySelector('[data-my-dogs-status]')

  if (!list || !status || list.dataset.profileDogActionsBound === 'true') {
    return
  }

  list.dataset.profileDogActionsBound = 'true'

  list.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit-dog-id]')
    const addPhotosButton = event.target.closest('[data-add-photos-dog-id]')
    const deleteButton = event.target.closest('[data-delete-dog-id]')

    if (editButton) {
      event.preventDefault()
      await profileFormController?.openEditForm(editButton.dataset.editDogId)
      return
    }

    if (addPhotosButton) {
      event.preventDefault()
      await profileFormController?.openEditForm(addPhotosButton.dataset.addPhotosDogId, true)
      return
    }

    if (!deleteButton) {
      return
    }

    event.preventDefault()

    const dogId = deleteButton.dataset.deleteDogId
    const dogName = deleteButton.dataset.dogName || t('common.unnamedDog')
    const confirmed = window.confirm(t('common.deleteConfirmation', { name: dogName }))

    if (!confirmed) {
      return
    }

    deleteButton.disabled = true
    deleteButton.textContent = t('profile.deleting')

    const { error } = await deleteDogById(dogId)

    if (error) {
      setMessage(status, error.message, 'danger')
      deleteButton.disabled = false
      deleteButton.textContent = t('profile.delete')
      return
    }

    setMessage(status, t('profile.dogDeleted'), 'success')
    await refreshMyDogs()
  })
}
async function bindDogForm() {
  const form = document.querySelector('[data-dog-form]')
  const status = document.querySelector('[data-dog-form-status]')
  const toggleButton = document.querySelector('[data-toggle-dog-form]')
  const submitButton = document.querySelector('[data-dog-form-submit]')
  const cancelButton = document.querySelector('[data-dog-form-cancel]')
  const formTitle = document.querySelector('[data-dog-form-title]')
  const formSubtitle = document.querySelector('[data-dog-form-subtitle]')
  const photoInput = document.querySelector('[name="photos"]')
  const dogIdInput = document.querySelector('[name="dogId"]')
  const nameInput = document.querySelector('[name="name"]')
  const breedInput = document.querySelector('[name="breed"]')
  const ageInput = document.querySelector('[name="ageYears"]')
  const sizeInput = document.querySelector('[name="size"]')
  const genderInput = document.querySelector('[name="gender"]')
  const temperamentInput = document.querySelector('[name="temperament"]')
  const districtInput = document.querySelector('[name="district"]')
  const locationCityInput = document.querySelector('[name="locationCity"]')
  const descriptionInput = document.querySelector('[name="description"]')

  if (!form || !status || !toggleButton || !submitButton || !cancelButton || !formTitle || !formSubtitle || !photoInput || !dogIdInput || !nameInput || !breedInput || !ageInput || !sizeInput || !genderInput || !temperamentInput || !districtInput || !locationCityInput || !descriptionInput) {
    return
  }

  const showCreateForm = () => {
    form.dataset.mode = 'create'
    dogIdInput.value = ''
    form.reset()
    photoInput.value = ''
    formTitle.textContent = t('profile.addYourDog')
    formSubtitle.textContent = t('profile.addDogSubtitle')
    submitButton.textContent = t('profile.addDog')
    cancelButton.classList.add('d-none')
    form.classList.remove('d-none')
    toggleButton.textContent = t('profile.hideForm')
    toggleButton.classList.remove('btn-primary')
    toggleButton.classList.add('btn-outline-secondary')
  }

  const hideDogForm = () => {
    form.classList.add('d-none')
    toggleButton.textContent = t('profile.addNewDog')
    toggleButton.classList.remove('btn-outline-secondary')
    toggleButton.classList.add('btn-primary')
    form.dataset.mode = 'create'
    dogIdInput.value = ''
    form.reset()
    photoInput.value = ''
    formTitle.textContent = t('profile.addYourDog')
    formSubtitle.textContent = t('profile.addDogSubtitle')
    submitButton.textContent = t('profile.addDog')
    cancelButton.classList.add('d-none')
  }

  const fillEditForm = (dog) => {
    form.dataset.mode = 'edit'
    dogIdInput.value = dog.id
    nameInput.value = dog.name ?? ''
    breedInput.value = dog.breed ?? ''
    ageInput.value = dog.age_years ?? ''
    sizeInput.value = dog.size ?? ''
    genderInput.value = dog.gender ?? ''
    temperamentInput.value = dog.temperament ?? ''
    districtInput.value = dog.district ?? ''
    locationCityInput.value = resolveApproximateDogLocation(dog).city ?? ''
    descriptionInput.value = dog.description ?? ''
    photoInput.value = ''
    form.classList.remove('d-none')
    toggleButton.textContent = t('profile.hideForm')
    toggleButton.classList.remove('btn-primary')
    toggleButton.classList.add('btn-outline-secondary')
    formTitle.textContent = t('profile.editDog')
    formSubtitle.textContent = t('profile.updateDogSubtitle')
    submitButton.textContent = t('profile.saveChanges')
    cancelButton.classList.remove('d-none')
  }

  const openEditForm = async (dogId, focusPhotos = false) => {
    const { data, error } = await getMyDogs()

    if (error) {
      setMessage(status, error.message, 'danger')
      return
    }

    const dog = (data ?? []).find((item) => String(item.id) === String(dogId))

    if (!dog) {
      setMessage(status, t('profile.dogNotFound'), 'warning')
      return
    }

    fillEditForm(dog)

    if (focusPhotos) {
      photoInput.focus()
    }
  }

  profileFormController = {
    openEditForm,
    hideDogForm,
    showCreateForm,
  }

  hideDogForm()

  const showDogForm = () => {
    showCreateForm()
  }

  toggleButton.addEventListener('click', () => {
    if (form.classList.contains('d-none')) {
      showDogForm()
      return
    }

    hideDogForm()
  })

  cancelButton.addEventListener('click', () => {
    hideDogForm()
  })

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    status.innerHTML = ''
    submitButton.disabled = true
    cancelButton.disabled = true
    toggleButton.disabled = true

    const formData = new FormData(form)
    const selectedPhotos = Array.from(form.querySelector('[name="photos"]')?.files ?? [])
    const dogId = String(formData.get('dogId') ?? '').trim()

    const payload = {
      name: String(formData.get('name') ?? '').trim(),
      breed: String(formData.get('breed') ?? '').trim(),
      ageYears: formData.get('ageYears'),
      size: String(formData.get('size') ?? '').trim(),
      gender: String(formData.get('gender') ?? '').trim(),
      temperament: String(formData.get('temperament') ?? '').trim(),
      district: String(formData.get('district') ?? '').trim(),
      ...buildApproximateLocationPayload({
        locationCity: String(formData.get('locationCity') ?? '').trim(),
        district: String(formData.get('district') ?? '').trim(),
      }),
      description: String(formData.get('description') ?? '').trim(),
    }

    const isEditMode = Boolean(dogId)
    const dogActionLabel = isEditMode ? t('profile.updateDogSuccess') : t('profile.addDogSuccess')
    const { data: savedDog, error: saveError } = isEditMode
      ? await updateDogById(dogId, payload)
      : await createDogProfile(payload)

    if (saveError) {
      setMessage(status, saveError.message, 'danger')
      submitButton.disabled = false
      cancelButton.disabled = false
      toggleButton.disabled = false
      return
    }

    if (selectedPhotos.length) {
      const { error: uploadError, data: uploadedPhotos } = await uploadDogPhotos({
        dogId: savedDog.id,
        files: selectedPhotos,
      })

      if (uploadError) {
        setMessage(status, isEditMode
          ? t('profile.uploadWarning', { error: uploadError.message })
          : t('profile.uploadWarningCreate', { error: uploadError.message }), 'warning')
        hideDogForm()
        submitButton.disabled = false
        cancelButton.disabled = false
        toggleButton.disabled = false
        await refreshMyDogs()
        return
      }

      setMessage(status, t('profile.photosUploaded', {
        base: dogActionLabel,
        count: uploadedPhotos.length,
      }), 'success')
      hideDogForm()
      submitButton.disabled = false
      cancelButton.disabled = false
      toggleButton.disabled = false
      await refreshMyDogs()
      return
    }

    setMessage(status, dogActionLabel, 'success')
    hideDogForm()
    submitButton.disabled = false
    cancelButton.disabled = false
    toggleButton.disabled = false
    await refreshMyDogs()
  })
}

function createPlaydateRequestCard(request, mode) {
  const language = getCurrentLanguage()
  const card = document.createElement('div')
    card.className = 'border rounded-3 p-3 bg-body-tertiary profile-playdate-card'
  card.dataset.playdateRequestId = request.id

  const title = document.createElement('div')
  title.className = 'd-flex justify-content-between align-items-start gap-2 mb-2'

  const titleBody = document.createElement('div')
  const heading = document.createElement('div')
  heading.className = 'fw-semibold small mb-1'

  if (mode === 'received') {
    heading.textContent = t('profile.receivedRequestTitle', {
      sender: request.senderDog?.name || t('common.unnamedDog'),
      recipient: request.recipientDog?.name || t('profile.yourDog'),
    })
  } else if (mode === 'sent') {
    heading.textContent = t('profile.sentRequestTitle', {
      sender: request.senderDog?.name || t('profile.oneOfYourDogs'),
      recipient: request.recipientDog?.name || t('profile.aDog'),
    })
  } else {
    heading.textContent = t('profile.matchedRequestTitle', {
      sender: request.senderDog?.name || t('common.unnamedDog'),
      recipient: request.recipientDog?.name || t('common.unnamedDog'),
    })
  }

  const badge = document.createElement('span')
  badge.className = mode === 'match' ? 'badge text-bg-success' : 'badge text-bg-secondary'
  badge.textContent = getLocalizedDogStatus(request.status)

  titleBody.append(heading)
  title.append(titleBody, badge)

  const details = document.createElement('div')
  details.className = 'small text-secondary mb-3'
  details.textContent = t('profile.playdateCreated', { date: new Date(request.created_at).toLocaleDateString() })

  const locationLine = document.createElement('div')
  locationLine.className = 'small mb-2'
  locationLine.textContent = `${request.senderDog?.name || t('profile.sender')} · ${formatApproximateDogLocation(request.senderDog, language)}`

  const recipientLine = document.createElement('div')
  recipientLine.className = 'small mb-3'
  recipientLine.textContent = `${request.recipientDog?.name || t('profile.recipient')} · ${formatApproximateDogLocation(request.recipientDog, language)}`

  card.append(title, details, locationLine, recipientLine)

  if (mode === 'match') {
    const messageButton = document.createElement('button')
    messageButton.type = 'button'
    messageButton.className = 'btn btn-primary btn-sm'
    messageButton.dataset.playdateAction = 'message-owner'
    messageButton.dataset.playdateRequestId = request.id
    messageButton.textContent = t('profile.messageOwner')

    card.append(messageButton)
  }

  if (mode === 'received') {
    const actions = document.createElement('div')
    actions.className = 'd-flex flex-wrap gap-2'

    const acceptButton = document.createElement('button')
    acceptButton.type = 'button'
    acceptButton.className = 'btn btn-success btn-sm'
    acceptButton.dataset.playdateAction = 'accepted'
    acceptButton.dataset.playdateRequestId = request.id
    acceptButton.textContent = t('profile.accept')

    const declineButton = document.createElement('button')
    declineButton.type = 'button'
    declineButton.className = 'btn btn-outline-danger btn-sm'
    declineButton.dataset.playdateAction = 'declined'
    declineButton.dataset.playdateRequestId = request.id
    declineButton.textContent = t('profile.decline')

    actions.append(acceptButton, declineButton)
    card.append(actions)
  }

  if (mode === 'sent') {
    const actions = document.createElement('div')
    actions.className = 'd-flex flex-wrap gap-2'

    const cancelButton = document.createElement('button')
    cancelButton.type = 'button'
    cancelButton.className = 'btn btn-outline-secondary btn-sm'
    cancelButton.dataset.playdateAction = 'cancelled'
    cancelButton.dataset.playdateRequestId = request.id
    cancelButton.textContent = t('profile.cancelRequest')

    actions.append(cancelButton)
    card.append(actions)
  }

  return card
}

async function refreshPlaydateDashboard() {
  const profilePage = document.querySelector('[data-profile-page]')
  const status = document.querySelector('[data-playdate-status]')
  const meta = document.querySelector('[data-playdate-meta]')
  const receivedList = document.querySelector('[data-playdate-received-list]')
  const sentList = document.querySelector('[data-playdate-sent-list]')
  const matchesList = document.querySelector('[data-playdate-matches-list]')

  if (!profilePage || !status || !meta || !receivedList || !sentList || !matchesList) {
    return
  }

  setMessage(status, t('profile.playdateLoading'), 'secondary')

  const { data, error } = await getMyPlaydateRequests()

  if (error) {
    setMessage(status, error.message, 'danger')
    receivedList.replaceChildren()
    sentList.replaceChildren()
    matchesList.replaceChildren()
    meta.textContent = t('profile.playdateUnableToLoad')
    return
  }

  const requestsData = data ?? { sent: [], received: [], matches: [] }

  const renderEmpty = (container, message) => {
    container.replaceChildren()

    const empty = document.createElement('div')
    empty.className = 'alert alert-light border mb-0 small'
    empty.setAttribute('role', 'alert')
    empty.textContent = message

    container.append(empty)
  }

  if (requestsData.received.length) {
    receivedList.replaceChildren(...requestsData.received.map((request) => createPlaydateRequestCard(request, 'received')))
  } else {
    renderEmpty(receivedList, t('profile.receivedEmpty'))
  }

  if (requestsData.sent.length) {
    sentList.replaceChildren(...requestsData.sent.map((request) => createPlaydateRequestCard(request, 'sent')))
  } else {
    renderEmpty(sentList, t('profile.sentEmpty'))
  }

  if (requestsData.matches.length) {
    matchesList.replaceChildren(...requestsData.matches.map((request) => createPlaydateRequestCard(request, 'match')))
  } else {
    renderEmpty(matchesList, t('profile.matchesEmpty'))
  }

  meta.textContent = t('profile.playdateSummary', {
    received: requestsData.received.length,
    sent: requestsData.sent.length,
    matches: requestsData.matches.length,
  })
  setMessage(status, t('profile.playdateLoaded'), 'success')
}

function bindPlaydateDashboard() {
  const profilePage = document.querySelector('[data-profile-page]')
  const section = document.querySelector('[data-playdate-section]')
  const status = document.querySelector('[data-playdate-status]')

  if (!profilePage || !section || !status || section.dataset.profilePlaydateActionsBound === 'true') {
    return
  }

  section.dataset.profilePlaydateActionsBound = 'true'

  section.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-playdate-action]')

    if (!button) {
      return
    }

    const requestId = button.dataset.playdateRequestId
    const action = button.dataset.playdateAction

    if (!requestId || !action) {
      return
    }

    const originalLabel = button.textContent
    button.disabled = true
    button.textContent = action === 'message-owner' ? t('profile.opening') : t('profile.saving')

    if (action === 'message-owner') {
      const { data: conversationId, error: conversationError } = await getOrCreateConversation(requestId)

      if (conversationError) {
        setMessage(status, conversationError.message, 'danger')
        button.disabled = false
        button.textContent = originalLabel
        return
      }

      window.history.pushState({}, '', `/messages?conversation=${conversationId}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
      return
    }

    const { error } = await updatePlaydateRequestStatus({ requestId, status: action })

    if (error) {
      setMessage(status, error.message, 'danger')
      button.disabled = false
      button.textContent = originalLabel
      return
    }

    setMessage(status, t('profile.playdateUpdated'), 'success')
    await refreshPlaydateDashboard()
  })
}

async function bindProfileView() {
  const profilePage = document.querySelector('[data-profile-page]')
  const userInfo = document.querySelector('[data-profile-user]')
  const actionArea = document.querySelector('[data-profile-actions]')
  const dogFormSection = document.querySelector('[data-dog-form-section]')
  const dogSectionDivider = document.querySelector('[data-dog-section-divider]')
  const myDogsSection = document.querySelector('[data-my-dogs-section]')
  const myDogsDivider = document.querySelector('[data-my-dogs-divider]')
  const playdateSection = document.querySelector('[data-playdate-section]')
  const playdateDivider = document.querySelector('[data-playdate-divider]')

  if (!profilePage || !userInfo || !actionArea || !dogFormSection || !dogSectionDivider || !myDogsSection || !myDogsDivider || !playdateSection || !playdateDivider) {
    return
  }

  const { user, error } = await getCurrentUser()

  if (error) {
    setMessage(userInfo, error.message, 'danger')
    actionArea.innerHTML = ''
    dogFormSection.hidden = true
    dogSectionDivider.hidden = true
    myDogsSection.hidden = true
    myDogsDivider.hidden = true
    playdateSection.hidden = true
    playdateDivider.hidden = true
    return
  }

  if (!user) {
    setMessage(userInfo, t('profile.youAreNotLoggedIn'), 'warning')
    actionArea.innerHTML = ''
    dogFormSection.hidden = true
    dogSectionDivider.hidden = true
    myDogsSection.hidden = true
    myDogsDivider.hidden = true
    playdateSection.hidden = true
    playdateDivider.hidden = true
    return
  }

  dogFormSection.hidden = false
  dogSectionDivider.hidden = false
  myDogsSection.hidden = false
  myDogsDivider.hidden = false
  playdateSection.hidden = false
  playdateDivider.hidden = false

  userInfo.innerHTML = `
    <div class="alert alert-success mb-0" role="alert">
      ${escapeHtml(t('profile.loggedInAs', { email: user.email ?? t('common.notProvided') }))}
    </div>
  `

  actionArea.innerHTML = `
    <button type="button" class="btn btn-outline-danger" data-logout-button>${escapeHtml(t('profile.logout'))}</button>
  `

  const logoutButton = actionArea.querySelector('[data-logout-button]')

  logoutButton?.addEventListener('click', async () => {
    const { error: logoutError } = await logoutUser()

    if (logoutError) {
      setMessage(userInfo, logoutError.message, 'danger')
      return
    }

    window.history.pushState({}, '', '/login')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })

  await refreshMyDogs()
  bindMyDogsActions()
  await bindDogForm()
  bindPlaydateDashboard()
  await refreshPlaydateDashboard()
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindProfileView)
  return template
}