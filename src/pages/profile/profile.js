import template from './profile.html?raw'
import './profile.css'
import { getCurrentUser, logoutUser } from '../../services/authService.js'
import { createDogProfile, getMyDogs, uploadDogPhotos } from '../../services/dogService.js'

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
      const dogName = escapeHtml(dog.name ?? 'Unnamed dog')
      const dogBreed = escapeHtml(dog.breed ?? 'No breed')
      const dogDistrict = escapeHtml(dog.district ?? 'No district')
      const dogStatus = escapeHtml(dog.status ?? 'unknown')
      const shortDescription = dog.description ? escapeHtml(dog.description.slice(0, 140)) : ''

      return `
        <div class="col-12 col-lg-6">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h3 class="h6 card-title mb-2">${dogName}</h3>
              <p class="text-secondary mb-2">${dogBreed} · ${dogDistrict}</p>
              <p class="mb-2"><span class="fw-semibold">Status:</span> ${dogStatus}</p>
              ${shortDescription ? `<p class="mb-0">${shortDescription}</p>` : '<p class="mb-0 text-secondary">No description.</p>'}
            </div>
          </div>
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

async function bindDogForm() {
  const form = document.querySelector('[data-dog-form]')
  const status = document.querySelector('[data-dog-form-status]')

  if (!form || !status) {
    return
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    status.innerHTML = ''

    const formData = new FormData(form)
    const selectedPhotos = Array.from(form.querySelector('[name="photos"]')?.files ?? [])
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

    const { data: createdDog, error: createError } = await createDogProfile(payload)

    if (createError) {
      setMessage(status, createError.message, 'danger')
      return
    }

    if (selectedPhotos.length) {
      const { error: uploadError, data: uploadedPhotos } = await uploadDogPhotos({
        dogId: createdDog.id,
        files: selectedPhotos,
      })

      if (uploadError) {
        setMessage(status, `Dog profile created, but photo upload failed: ${uploadError.message}`, 'warning')
        form.reset()
        await refreshMyDogs()
        return
      }

      setMessage(
        status,
        `Dog profile created successfully and ${uploadedPhotos.length} photo${uploadedPhotos.length === 1 ? '' : 's'} uploaded.`,
        'success'
      )
      form.reset()
      await refreshMyDogs()
      return
    }

    setMessage(status, 'Dog profile created successfully.', 'success')
    form.reset()
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
  await bindDogForm()
}

export function renderPage() {
  queueMicrotask(bindProfileView)
  return template
}