import template from './discover.html?raw'
import './discover.css'
import Modal from 'bootstrap/js/dist/modal'
import { getActiveDogs, getMyDogs } from '../../services/dogService.js'
import { createPlaydateRequest, getMyPlaydateRequests } from '../../services/playdateService.js'
import {
  calculateDistanceKm,
  formatApproximateDogLocation,
  getApproximateLocationCoordinates,
  resolveApproximateDogLocation,
} from '../../utils/approximateLocation.js'

const SOFIA_FALLBACK_CENTER = { latitude: 42.6977, longitude: 23.3219 }

const state = {
  dogs: [],
  filteredDogs: [],
  myDogs: [],
  playdates: {
    requests: [],
    sent: [],
    received: [],
    matches: [],
  },
  filters: {
    city: '',
    district: '',
    radiusKm: '',
  },
  referenceLocation: null,
  leaflet: null,
  map: null,
  markersLayer: null,
  mapTileError: false,
  modal: null,
  recipientDog: null,
}

function setStatus(target, message, variant) {
  if (!target) {
    return
  }

  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  alert.textContent = message

  target.append(alert)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return ''
  }

  return `${distanceKm.toFixed(1)} km`
}

function getDogCoordinates(dog) {
  const explicitCoordinates = getApproximateLocationCoordinates(dog)

  if (explicitCoordinates) {
    return explicitCoordinates
  }

  const resolvedLocation = resolveApproximateDogLocation(dog)

  if (!resolvedLocation.hasCoordinates) {
    return null
  }

  return {
    latitude: resolvedLocation.latitude,
    longitude: resolvedLocation.longitude,
  }
}

function isOwnDog(dog) {
  return state.myDogs.some((myDog) => myDog.id === dog.id)
}

function hasAcceptedMatchForDog(dogId) {
  return state.playdates.matches.some((request) => {
    const senderId = request.sender_dog_id
    const recipientId = request.recipient_dog_id

    return senderId === dogId || recipientId === dogId
  })
}

function hasExactRequest(senderDogId, recipientDogId, status) {
  return state.playdates.requests.some((request) => {
    if (request.sender_dog_id !== senderDogId || request.recipient_dog_id !== recipientDogId) {
      return false
    }

    if (status) {
      return request.status === status
    }

    return true
  })
}

function getDogDisplayLocation(dog) {
  return formatApproximateDogLocation(dog)
}

function getDogDistanceLabel(dog) {
  if (!state.referenceLocation) {
    return ''
  }

  const coordinates = getDogCoordinates(dog)

  if (!coordinates) {
    return ''
  }

  const distanceKm = calculateDistanceKm(state.referenceLocation, coordinates)

  if (!Number.isFinite(distanceKm)) {
    return ''
  }

  return formatDistance(distanceKm)
}

function applyFilters() {
  const cityFilter = normalizeText(state.filters.city)
  const districtFilter = normalizeText(state.filters.district)
  const radiusFilter = Number(state.filters.radiusKm)

  const filteredDogs = state.dogs.filter((dog) => {
    const location = resolveApproximateDogLocation(dog)
    const cityLabel = normalizeText(location.city)
    const districtLabel = normalizeText(location.district)

    if (cityFilter && cityLabel !== cityFilter) {
      return false
    }

    if (districtFilter && districtLabel !== districtFilter) {
      return false
    }

    if (radiusFilter && state.referenceLocation) {
      const coordinates = getDogCoordinates(dog)

      if (!coordinates) {
        return false
      }

      const distanceKm = calculateDistanceKm(state.referenceLocation, coordinates)

      if (!Number.isFinite(distanceKm) || distanceKm > radiusFilter) {
        return false
      }
    }

    return true
  })

  filteredDogs.sort((left, right) => {
    if (state.referenceLocation) {
      const leftCoordinates = getDogCoordinates(left)
      const rightCoordinates = getDogCoordinates(right)

      const leftDistance = leftCoordinates ? calculateDistanceKm(state.referenceLocation, leftCoordinates) : Number.POSITIVE_INFINITY
      const rightDistance = rightCoordinates ? calculateDistanceKm(state.referenceLocation, rightCoordinates) : Number.POSITIVE_INFINITY

      if (Number.isFinite(leftDistance) && Number.isFinite(rightDistance) && leftDistance !== rightDistance) {
        return leftDistance - rightDistance
      }
    }

    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  })

  state.filteredDogs = filteredDogs
}

function buildLocationOptions(dogs) {
  const cities = []
  const districts = []

  dogs.forEach((dog) => {
    const location = resolveApproximateDogLocation(dog)

    if (location.city) {
      cities.push(location.city)
    }

    if (location.district) {
      districts.push(location.district)
    }
  })

  const uniqueCities = [...new Set(cities)].sort((left, right) => left.localeCompare(right))
  const uniqueDistricts = [...new Set(districts)].sort((left, right) => left.localeCompare(right))

  return { cities: uniqueCities, districts: uniqueDistricts }
}

function createDogCard(dog) {
  const column = document.createElement('div')
  column.className = 'col-12 col-md-6 col-xl-4'

  const card = document.createElement('article')
  card.className = 'card h-100 shadow-sm discover-dog-card'
  card.setAttribute('role', 'button')
  card.setAttribute('tabindex', '0')

  const openDogProfile = () => {
    window.history.pushState({}, '', `/dogs/${dog.id}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  card.addEventListener('click', (event) => {
    const target = event.target.closest('[data-request-playdate-id]')

    if (target) {
      event.preventDefault()
      event.stopPropagation()
      openPlaydateModal(dog)
      return
    }

    openDogProfile()
  })

  card.addEventListener('keydown', (event) => {
    if (event.target.closest('button, a, input, select, textarea')) {
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDogProfile()
    }
  })

  const media = document.createElement('div')
  media.className = 'ratio ratio-4x3 bg-body-tertiary dog-card-media'

  if (dog.photoUrl) {
    const image = document.createElement('img')
    image.src = dog.photoUrl
    image.alt = `${dog.name || 'Dog'} photo`
    image.className = 'w-100 h-100 object-fit-cover'
    media.append(image)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'd-flex align-items-center justify-content-center text-secondary small h-100'
    placeholder.textContent = 'No photo'
    media.append(placeholder)
  }

  const body = document.createElement('div')
  body.className = 'card-body d-flex flex-column'

  const title = document.createElement('h2')
  title.className = 'h5 card-title mb-1'
  title.textContent = dog.name || 'Unnamed dog'

  const location = document.createElement('p')
  location.className = 'text-secondary small mb-2'
  location.textContent = getDogDisplayLocation(dog)

  const chips = document.createElement('div')
  chips.className = 'd-flex flex-wrap gap-1 mb-3'

  const addChip = (value, variant = '') => {
    if (!value && value !== 0) {
      return
    }
    const chip = document.createElement('span')
    chip.className = `dog-chip ${variant}`
    chip.textContent = value
    chips.append(chip)
  }

  if (dog.breed) addChip(dog.breed)
  if (dog.size) addChip(dog.size, 'dog-chip--coral')
  if (dog.gender) addChip(dog.gender, 'dog-chip--neutral')

  const list = document.createElement('ul')
  list.className = 'list-unstyled small mb-0 d-grid gap-1 text-secondary'

  const addItem = (label, value) => {
    if (!value && value !== 0) {
      return
    }

    const item = document.createElement('li')
    item.textContent = `${label}: ${value}`
    list.append(item)
  }

  addItem('Age years', dog.age_years)
  addItem('Temperament', dog.temperament)

  const distanceLabel = getDogDistanceLabel(dog)

  if (distanceLabel) {
    addItem('Distance', distanceLabel)
  }

  if (dog.description) {
    const description = document.createElement('p')
    description.className = 'mt-3 mb-0 small text-secondary'
    description.textContent = dog.description
    body.append(title, location, chips, list, description)
  } else {
    body.append(title, location, chips, list)
  }

  const actions = document.createElement('div')
  actions.className = 'd-flex flex-wrap gap-2 mt-3'

  const viewButton = document.createElement('a')
  viewButton.className = 'btn btn-outline-primary btn-sm'
  viewButton.href = `/dogs/${dog.id}`
  viewButton.setAttribute('data-link', '')
  viewButton.textContent = 'View profile'

  actions.append(viewButton)

  if (!isOwnDog(dog) && state.myDogs.length) {
    const requestButton = document.createElement('button')
    requestButton.type = 'button'
    requestButton.className = 'btn btn-outline-success btn-sm'
    requestButton.dataset.requestPlaydateId = dog.id
    requestButton.textContent = hasAcceptedMatchForDog(dog.id) ? 'Matched' : 'Request playdate'
    requestButton.disabled = hasAcceptedMatchForDog(dog.id)
    actions.append(requestButton)
  }

  body.append(actions)
  card.append(media, body)
  column.append(card)

  return column
}

function renderDogCards() {
  const list = document.querySelector('[data-discover-list]')
  const listMeta = document.querySelector('[data-discover-list-meta]')

  if (!list || !listMeta) {
    return
  }

  list.replaceChildren()

  if (!state.filteredDogs.length) {
    const empty = document.createElement('div')
    empty.className = 'col-12'

    const alert = document.createElement('div')
    alert.className = 'alert alert-light border mb-0'
    alert.setAttribute('role', 'alert')
    alert.textContent = 'No dogs match the current filters.'

    empty.append(alert)
    list.append(empty)
    listMeta.textContent = '0 dogs shown'
    return
  }

  const fragment = document.createDocumentFragment()

  state.filteredDogs.forEach((dog) => {
    fragment.append(createDogCard(dog))
  })

  list.append(fragment)
  listMeta.textContent = `${state.filteredDogs.length} dog${state.filteredDogs.length === 1 ? '' : 's'} shown`
}

function renderMap(dogs) {
  const mapElement = document.querySelector('[data-discover-map]')
  const mapStatus = document.querySelector('[data-discover-map-status]')
  const mapMeta = document.querySelector('[data-discover-map-meta]')

  if (!mapElement || !mapStatus || !mapMeta) {
    return
  }

  if (!state.leaflet) {
    setStatus(mapStatus, 'Nearby map unavailable. Listings remain usable without the map.', 'warning')
    mapMeta.textContent = 'Map unavailable'
    mapElement.innerHTML = ''
    return
  }

  if (!state.map) {
    state.map = state.leaflet.map(mapElement, {
      scrollWheelZoom: false,
    })

    state.leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      })
      .on('tileerror', () => {
        if (!state.mapTileError) {
          state.mapTileError = true
          setStatus(mapStatus, 'Map tiles could not load. Listings remain available.', 'warning')
        }
      })
      .addTo(state.map)

    state.markersLayer = state.leaflet.layerGroup().addTo(state.map)
    state.map.setView([SOFIA_FALLBACK_CENTER.latitude, SOFIA_FALLBACK_CENTER.longitude], 11)
  }

  state.markersLayer.clearLayers()

  const markerBounds = []

  dogs.forEach((dog) => {
    const coordinates = getDogCoordinates(dog)

    if (!coordinates) {
      return
    }

    const marker = state.leaflet.circleMarker([coordinates.latitude, coordinates.longitude], {
      radius: 8,
      color: '#0f5132',
      weight: 2,
      fillColor: '#198754',
      fillOpacity: 0.85,
    })

    const locationLabel = getDogDisplayLocation(dog)
    const popupHtml = `
      <div class="d-grid gap-1">
        <strong>${escapeHtml(dog.name || 'Unnamed dog')}</strong>
        <span class="text-secondary small">${escapeHtml([dog.breed, locationLabel].filter(Boolean).join(' · ') || 'Approximate location')}</span>
        <a class="small" href="/dogs/${encodeURIComponent(dog.id)}" data-link>View profile</a>
      </div>
    `

    marker.bindPopup(popupHtml)
    marker.addTo(state.markersLayer)
    markerBounds.push([coordinates.latitude, coordinates.longitude])
  })

  if (markerBounds.length) {
    state.map.fitBounds(markerBounds, { padding: [24, 24], maxZoom: 14 })
    mapMeta.textContent = `${markerBounds.length} marker${markerBounds.length === 1 ? '' : 's'}`
    setStatus(mapStatus, 'Markers show approximate public locations only.', 'secondary')
    return
  }

  state.map.setView([SOFIA_FALLBACK_CENTER.latitude, SOFIA_FALLBACK_CENTER.longitude], 11)
  mapMeta.textContent = 'No markers'
  setStatus(mapStatus, 'No approximate coordinates are available for the current filters.', 'warning')
}

function renderLocationStatus() {
  const locationStatus = document.querySelector('[data-discover-location-status]')
  const radiusFilter = document.querySelector('[data-discover-radius-filter]')
  const clearButton = document.querySelector('[data-discover-clear-location]')

  if (!locationStatus || !radiusFilter || !clearButton) {
    return
  }

  if (state.referenceLocation) {
    radiusFilter.disabled = false
    clearButton.classList.remove('d-none')
    locationStatus.textContent = 'Using your browser location for nearby results. Coordinates are never stored.'
    return
  }

  radiusFilter.disabled = true
  clearButton.classList.add('d-none')
  locationStatus.textContent = 'Nearby radius is disabled until you use your location.'
}

function renderSummary() {
  const meta = document.querySelector('[data-discover-meta]')
  const status = document.querySelector('[data-discover-status]')

  if (meta) {
    meta.textContent = `${state.filteredDogs.length} result${state.filteredDogs.length === 1 ? '' : 's'}`
  }

  if (status) {
    if (!state.dogs.length) {
      setStatus(status, 'No active dogs available yet.', 'light')
      return
    }

    if (!state.filteredDogs.length) {
      setStatus(status, 'No dogs match the current filters.', 'warning')
      return
    }

    if (!state.myDogs.length) {
      setStatus(status, 'Browse dogs now. Add your own dog from Profile to send playdate requests.', 'info')
      return
    }

    status.innerHTML = ''
  }
}

function refreshDiscoverUI() {
  applyFilters()
  renderSummary()
  renderLocationStatus()
  renderDogCards()
  renderMap(state.filteredDogs)
}

function renderFilterOptions() {
  const cityFilter = document.querySelector('[data-discover-city-filter]')
  const districtFilter = document.querySelector('[data-discover-district-filter]')

  if (!cityFilter || !districtFilter) {
    return
  }

  const currentCity = cityFilter.value
  const currentDistrict = districtFilter.value

  let options = { cities: [], districts: [] }

  try {
    options = buildLocationOptions(state.dogs)
  } catch (error) {
    console.error('Failed to build discover location filters:', error)
  }

  cityFilter.replaceChildren()
  districtFilter.replaceChildren()

  const cityPlaceholder = document.createElement('option')
  cityPlaceholder.value = ''
  cityPlaceholder.textContent = 'All cities'
  cityFilter.append(cityPlaceholder)

  options.cities.forEach((city) => {
    const option = document.createElement('option')
    option.value = city
    option.textContent = city
    cityFilter.append(option)
  })

  const districtPlaceholder = document.createElement('option')
  districtPlaceholder.value = ''
  districtPlaceholder.textContent = 'All districts'
  districtFilter.append(districtPlaceholder)

  options.districts.forEach((district) => {
    const option = document.createElement('option')
    option.value = district
    option.textContent = district
    districtFilter.append(option)
  })

  cityFilter.value = currentCity
  districtFilter.value = currentDistrict
}

function syncModalNotes() {
  const note = document.querySelector('[data-playdate-modal-note]')
  const submitButton = document.querySelector('[data-playdate-submit]')
  const senderSelect = document.querySelector('[name="senderDogId"]')
  const recipientInput = document.querySelector('[name="recipientDogId"]')

  if (!note || !submitButton || !senderSelect || !recipientInput) {
    return
  }

  const senderDogId = senderSelect.value
  const recipientDogId = recipientInput.value

  if (!state.myDogs.length) {
    note.textContent = 'Add your own dog first to send a playdate request.'
    submitButton.disabled = true
    return
  }

  if (!senderDogId || !recipientDogId) {
    note.textContent = 'Choose a sender dog to continue.'
    submitButton.disabled = true
    return
  }

  if (String(senderDogId) === String(recipientDogId)) {
    note.textContent = 'A dog cannot send a playdate request to itself.'
    submitButton.disabled = true
    return
  }

  const hasPendingPair = hasExactRequest(senderDogId, recipientDogId, 'pending')
  const hasAcceptedPair = state.playdates.requests.some((request) => {
    const samePair =
      (request.sender_dog_id === senderDogId && request.recipient_dog_id === recipientDogId) ||
      (request.sender_dog_id === recipientDogId && request.recipient_dog_id === senderDogId)

    return samePair && request.status === 'accepted'
  })

  if (hasAcceptedPair) {
    note.textContent = 'This pair is already matched.'
    submitButton.disabled = true
    return
  }

  if (hasPendingPair) {
    note.textContent = 'A pending request already exists for this sender and recipient.'
    submitButton.disabled = true
    return
  }

  note.textContent = 'Playdate requests do not include messages or attachments.'
  submitButton.disabled = false
}

function populatePlaydateModal() {
  const recipientSummary = document.querySelector('[data-playdate-recipient-summary]')
  const recipientInput = document.querySelector('[name="recipientDogId"]')
  const senderSelect = document.querySelector('[name="senderDogId"]')
  const modalStatus = document.querySelector('[data-playdate-modal-status]')

  if (!recipientSummary || !recipientInput || !senderSelect || !modalStatus) {
    return
  }

  recipientSummary.textContent = state.recipientDog
    ? `${state.recipientDog.name || 'Unnamed dog'} · ${getDogDisplayLocation(state.recipientDog)}`
    : ''
  recipientInput.value = state.recipientDog?.id ?? ''

  senderSelect.replaceChildren()

  if (!state.myDogs.length) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'Add your own dog first'
    senderSelect.append(option)
    senderSelect.disabled = true
    setStatus(modalStatus, 'Add your own dog first to send playdate requests.', 'warning')
    syncModalNotes()
    return
  }

  senderSelect.disabled = false

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Select a sender dog'
  senderSelect.append(placeholder)

  state.myDogs.forEach((dog) => {
    const option = document.createElement('option')
    option.value = dog.id
    option.textContent = `${dog.name || 'Unnamed dog'} · ${getDogDisplayLocation(dog)}`
    senderSelect.append(option)
  })

  senderSelect.value = state.myDogs[0]?.id ?? ''
  setStatus(modalStatus, 'Choose the dog that will send the request.', 'secondary')
  syncModalNotes()
}

function openPlaydateModal(recipientDog) {
  const modalElement = document.querySelector('[data-playdate-modal]')

  if (!modalElement || !state.modal) {
    return
  }

  state.recipientDog = recipientDog
  populatePlaydateModal()
  state.modal.show()
}

async function handleGeolocationRequest() {
  const locationStatus = document.querySelector('[data-discover-location-status]')
  const radiusFilter = document.querySelector('[data-discover-radius-filter]')

  if (!locationStatus || !radiusFilter) {
    return
  }

  if (!navigator.geolocation) {
    setStatus(locationStatus, 'Browser geolocation is not available in this browser.', 'warning')
    return
  }

  setStatus(locationStatus, 'Requesting your location...', 'secondary')

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.referenceLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }

      radiusFilter.disabled = false
      setStatus(locationStatus, 'Using your browser location for nearby filtering. Coordinates are not stored.', 'success')
      refreshDiscoverUI()
    },
    (error) => {
      state.referenceLocation = null
      radiusFilter.disabled = true

      if (error.code === 1) {
        setStatus(locationStatus, 'Location permission denied. Nearby filtering remains disabled.', 'warning')
      } else {
        setStatus(locationStatus, 'Unable to get your location. Nearby filtering remains disabled.', 'danger')
      }

      refreshDiscoverUI()
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000,
    }
  )
}

async function bindDiscoverPage() {
  const status = document.querySelector('[data-discover-status]')
  const list = document.querySelector('[data-discover-list]')
  const meta = document.querySelector('[data-discover-meta]')
  const cityFilter = document.querySelector('[data-discover-city-filter]')
  const districtFilter = document.querySelector('[data-discover-district-filter]')
  const radiusFilter = document.querySelector('[data-discover-radius-filter]')
  const useLocationButton = document.querySelector('[data-discover-use-location]')
  const clearLocationButton = document.querySelector('[data-discover-clear-location]')
  const modalElement = document.querySelector('[data-playdate-modal]')
  const playdateForm = document.querySelector('[data-playdate-form]')
  const playdateModalStatus = document.querySelector('[data-playdate-modal-status]')
  const senderSelect = document.querySelector('[name="senderDogId"]')
  const submitButton = document.querySelector('[data-playdate-submit]')

  if (
    !status ||
    !list ||
    !meta ||
    !cityFilter ||
    !districtFilter ||
    !radiusFilter ||
    !useLocationButton ||
    !clearLocationButton ||
    !modalElement ||
    !playdateForm ||
    !playdateModalStatus ||
    !senderSelect ||
    !submitButton
  ) {
    return
  }

  setStatus(status, 'Loading nearby dogs...', 'secondary')
  setStatus(playdateModalStatus, 'Select a dog to send a request.', 'secondary')
  meta.textContent = ''

  state.dogs = []
  state.filteredDogs = []
  state.myDogs = []
  state.playdates = {
    requests: [],
    sent: [],
    received: [],
    matches: [],
  }
  state.referenceLocation = null
  state.recipientDog = null
  state.mapTileError = false

  if (state.map) {
    state.map.remove()
    state.map = null
    state.markersLayer = null
  }

  state.modal = new Modal(modalElement)

  let leafletModule = null

  try {
    leafletModule = await import('https://esm.sh/leaflet@1.9.4')
  } catch {
    leafletModule = null
  }

  state.leaflet = leafletModule?.default ?? leafletModule ?? null

  const [dogsResult, myDogsResult, playdatesResult] = await Promise.all([
    getActiveDogs(),
    getMyDogs(),
    getMyPlaydateRequests(),
  ])

  if (dogsResult.error) {
    setStatus(status, dogsResult.error.message, 'danger')
    meta.textContent = 'Unable to load dogs.'
    return
  }

  if (myDogsResult.error) {
    setStatus(status, myDogsResult.error.message, 'danger')
    return
  }

  if (playdatesResult.error) {
    setStatus(status, playdatesResult.error.message, 'danger')
  }

  state.dogs = Array.isArray(dogsResult.data) ? dogsResult.data : []
  state.myDogs = Array.isArray(myDogsResult.data) ? myDogsResult.data : []
  state.playdates = playdatesResult.data ?? state.playdates

  renderLocationStatus()
  refreshDiscoverUI()

  try {
    renderFilterOptions()
  } catch (error) {
    console.error('Failed to render discover filter options:', error)
  }

  cityFilter.addEventListener('change', () => {
    state.filters.city = cityFilter.value
    refreshDiscoverUI()
  })

  districtFilter.addEventListener('change', () => {
    state.filters.district = districtFilter.value
    refreshDiscoverUI()
  })

  radiusFilter.addEventListener('change', () => {
    if (radiusFilter.disabled) {
      state.filters.radiusKm = ''
      refreshDiscoverUI()
      return
    }

    state.filters.radiusKm = radiusFilter.value
    refreshDiscoverUI()
  })

  useLocationButton.addEventListener('click', handleGeolocationRequest)

  clearLocationButton.addEventListener('click', () => {
    state.referenceLocation = null
    state.filters.radiusKm = ''
    radiusFilter.value = ''
    refreshDiscoverUI()
  })

  senderSelect.addEventListener('change', syncModalNotes)

  playdateForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (!state.recipientDog) {
      return
    }

    const formData = new FormData(playdateForm)
    const senderDogId = String(formData.get('senderDogId') ?? '').trim()
    const recipientDogId = String(formData.get('recipientDogId') ?? '').trim()

    syncModalNotes()

    if (submitButton.disabled) {
      return
    }

    submitButton.disabled = true
    submitButton.textContent = 'Sending...'

    const { data, error } = await createPlaydateRequest({ senderDogId, recipientDogId })

    if (error) {
      setStatus(playdateModalStatus, error.message, 'danger')
      submitButton.disabled = false
      submitButton.textContent = 'Send request'
      syncModalNotes()
      return
    }

    state.modal.hide()
    setStatus(status, 'Playdate request sent successfully.', 'success')
    submitButton.disabled = false
    submitButton.textContent = 'Send request'

    const refreshed = await getMyPlaydateRequests()

    if (!refreshed.error) {
      state.playdates = refreshed.data ?? state.playdates
    }

    refreshDiscoverUI()
    return data
  })

  modalElement.addEventListener('hidden.bs.modal', () => {
    state.recipientDog = null
    playdateForm.reset()
    submitButton.textContent = 'Send request'
    submitButton.disabled = false
    setStatus(playdateModalStatus, 'Select a dog to send a request.', 'secondary')
  })

  if (!state.myDogs.length) {
    setStatus(status, 'You can browse dogs now. Add your own dog from Profile to send playdate requests.', 'info')
  } else {
    setStatus(status, 'Loading nearby dogs...', 'secondary')
  }

  state.filters.city = cityFilter.value
  state.filters.district = districtFilter.value
  state.filters.radiusKm = radiusFilter.value

  refreshDiscoverUI()
}

export function renderPage() {
  queueMicrotask(bindDiscoverPage)
  return template
}