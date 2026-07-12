import template from './profile.html?raw'
import './profile.css'
import { getCurrentUser, logoutUser } from '../../services/authService.js'
import { createDogProfile, deleteDogById, getMyDogs, updateDogById, uploadDogPhotos } from '../../services/dogService.js'

let profileFormController = null

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
  if (!dogs.length) {
    return `
      <div class="col-12">
        <div class="alert alert-light border mb-0" role="alert">
          No dogs yet.
        </div>
      </div>
    `
  }

  return dogs
    .map((dog) => {
      const dogId = encodeURIComponent(dog.id)
      const dogName = escapeHtml(dog.name ?? 'Unnamed dog')
      const dogBreed = escapeHtml(dog.breed ?? 'No breed')
      const dogDistrict = escapeHtml(dog.district ?? 'No district')
      const dogStatus = escapeHtml(dog.status ?? 'unknown')
      const photoUrl = dog.photoUrl ? escapeHtml(dog.photoUrl) : ''
      const shortDescription = dog.description ? escapeHtml(dog.description.slice(0, 140)) : ''

      const photoMarkup = photoUrl
        ? `
          <img
            src="${photoUrl}"
            class="w-100 h-100 object-fit-cover"
            alt="${dogName} photo"
          />
        `
        : `
          <div class="d-flex align-items-center justify-content-center text-secondary small h-100">
            No photo
          </div>
        `

      return `
        <div class="col-12 col-lg-6">
          <article class="card h-100 shadow-sm">
            <div class="ratio ratio-4x3 bg-body-tertiary">
              ${photoMarkup}
            </div>

            <div class="card-body">
              <h3 class="h6 card-title mb-2">${dogName}</h3>
              <p class="text-secondary mb-2">${dogBreed} · ${dogDistrict}</p>
              <p class="mb-2"><span class="fw-semibold">Status:</span> ${dogStatus}</p>
              ${shortDescription ? `<p class="mb-0">${shortDescription}</p>` : '<p class="mb-0 text-secondary">No description.</p>'}

              <div class="d-flex flex-wrap gap-2 mt-3">
                <a href="/dogs/${dogId}" class="btn btn-outline-primary btn-sm" data-link>
                  View profile
                </a>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm"
                  data-edit-dog-id="${dogId}"
                  data-dog-name="${dogName}"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn-outline-success btn-sm"
                  data-add-photos-dog-id="${dogId}"
                  data-dog-name="${dogName}"
                >
                  Add photos
                </button>
                <button
                  type="button"
                  class="btn btn-outline-danger btn-sm"
                  data-delete-dog-id="${dogId}"
                  data-dog-name="${dogName}"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        </div>
      `
    })
    .join('')
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

  if (!list || !status) {
    return
  }

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
    const dogName = deleteButton.dataset.dogName || 'this dog'
    const confirmed = window.confirm(`Delete ${dogName}? This action cannot be undone.`)

    if (!confirmed) {
      return
    }

    deleteButton.disabled = true
    deleteButton.textContent = 'Deleting...'

    const { error } = await deleteDogById(dogId)

    if (error) {
      setMessage(status, error.message, 'danger')
      deleteButton.disabled = false
      deleteButton.textContent = 'Delete'
      return
    }

    setMessage(status, 'Dog deleted successfully.', 'success')
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
  const descriptionInput = document.querySelector('[name="description"]')

  if (!form || !status || !toggleButton || !submitButton || !cancelButton || !formTitle || !formSubtitle || !photoInput || !dogIdInput || !nameInput || !breedInput || !ageInput || !sizeInput || !genderInput || !temperamentInput || !districtInput || !descriptionInput) {
    return
  }

  const showCreateForm = () => {
    form.dataset.mode = 'create'
    dogIdInput.value = ''
    form.reset()
    photoInput.value = ''
    formTitle.textContent = 'Add your dog'
    formSubtitle.textContent = 'Create a new profile or edit an existing one.'
    submitButton.textContent = 'Add dog'
    cancelButton.classList.add('d-none')
    form.classList.remove('d-none')
    toggleButton.textContent = 'Hide form'
    toggleButton.classList.remove('btn-primary')
    toggleButton.classList.add('btn-outline-secondary')
  }

  const hideDogForm = () => {
    form.classList.add('d-none')
    toggleButton.textContent = 'Add new dog'
    toggleButton.classList.remove('btn-outline-secondary')
    toggleButton.classList.add('btn-primary')
    form.dataset.mode = 'create'
    dogIdInput.value = ''
    form.reset()
    photoInput.value = ''
    formTitle.textContent = 'Add your dog'
    formSubtitle.textContent = 'Create a new profile or edit an existing one.'
    submitButton.textContent = 'Add dog'
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
    descriptionInput.value = dog.description ?? ''
    photoInput.value = ''
    form.classList.remove('d-none')
    toggleButton.textContent = 'Hide form'
    toggleButton.classList.remove('btn-primary')
    toggleButton.classList.add('btn-outline-secondary')
    formTitle.textContent = 'Edit dog'
    formSubtitle.textContent = 'Update the dog profile or add more photos.'
    submitButton.textContent = 'Save changes'
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
      setMessage(status, 'Dog not found.', 'warning')
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
      description: String(formData.get('description') ?? '').trim(),
    }

    const isEditMode = Boolean(dogId)
    const dogActionLabel = isEditMode ? 'Dog updated successfully.' : 'Dog profile created successfully.'
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
        setMessage(status, `${isEditMode ? 'Dog profile updated' : 'Dog profile created'}, but photo upload failed: ${uploadError.message}`, 'warning')
        hideDogForm()
        submitButton.disabled = false
        cancelButton.disabled = false
        toggleButton.disabled = false
        await refreshMyDogs()
        return
      }

      setMessage(status, `${dogActionLabel} ${uploadedPhotos.length} photo${uploadedPhotos.length === 1 ? '' : 's'} uploaded.`, 'success')
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

async function bindProfileView() {
  const userInfo = document.querySelector('[data-profile-user]')
  const actionArea = document.querySelector('[data-profile-actions]')
  const dogFormSection = document.querySelector('[data-dog-form-section]')
  const dogSectionDivider = document.querySelector('[data-dog-section-divider]')
  const myDogsSection = document.querySelector('[data-my-dogs-section]')
  const myDogsDivider = document.querySelector('[data-my-dogs-divider]')

  if (!userInfo || !actionArea || !dogFormSection || !dogSectionDivider || !myDogsSection || !myDogsDivider) {
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
    return
  }

  if (!user) {
    setMessage(userInfo, 'You are not logged in.', 'warning')
    actionArea.innerHTML = ''
    dogFormSection.hidden = true
    dogSectionDivider.hidden = true
    myDogsSection.hidden = true
    myDogsDivider.hidden = true
    return
  }

  dogFormSection.hidden = false
  dogSectionDivider.hidden = false
  myDogsSection.hidden = false
  myDogsDivider.hidden = false

  userInfo.innerHTML = `
    <div class="alert alert-success mb-0" role="alert">
      Logged in as <strong>${user.email ?? 'Unknown email'}</strong>
    </div>
  `

  actionArea.innerHTML = `
    <button type="button" class="btn btn-outline-danger" data-logout-button>Logout</button>
  `

  const logoutButton = actionArea.querySelector('[data-logout-button]')

  logoutButton?.addEventListener('click', async () => {
    const { error: logoutError } = await logoutUser()

    if (logoutError) {
      setMessage(userInfo, logoutError.message, 'danger')
      return
    }

    window.location.assign('/login')
  })

  await refreshMyDogs()
  bindMyDogsActions()
  await bindDogForm()
}

export function renderPage() {
  queueMicrotask(bindProfileView)
  return template
}