import template from './discover.html?raw'
import './discover.css'
import Modal from 'bootstrap/js/dist/modal'
import { t } from '../../i18n/i18n.js'
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

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('discover.pageTitle')}`
}

function setStatus(target, message, variant, translationKey = '', replacements = {}) {
  if (!target) {
    return
  }

  target.replaceChildren()

  const alert = document.createElement('div')
  alert.className = `alert alert-${variant} mb-0`
  alert.setAttribute('role', 'alert')
  if (translationKey) {
    alert.dataset.i18n = translationKey
    if (Object.keys(replacements).length) {
      alert.dataset.i18nReplacements = JSON.stringify(replacements)
    }
  }
  alert.textContent = message

  target.append(alert)
}

function setTranslatedStatus(target, translationKey, variant, replacements = {}) {
  setStatus(target, t(translationKey, replacements), variant, translationKey, replacements)
}

function setI18nText(element, translationKey, replacements = {}) {
  if (!element) {
    return
  }

  element.dataset.i18n = translationKey
  if (Object.keys(replacements).length) {
    element.dataset.i18nReplacements = JSON.stringify(replacements)
  }
  element.textContent = t(translationKey, replacements)
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
  media.className = 'ratio ratio-4x3 bg-body-tertiary'

  if (dog.photoUrl) {
    const image = document.createElement('img')
    image.src = dog.photoUrl
    image.alt = t('discover.photoAlt', { name: dog.name || t('common.unnamedDog') })
    image.className = 'w-100 h-100 object-fit-cover'
    media.append(image)
  } else {
    const placeholder = document.createElement('div')
    placeholder.className = 'd-flex align-items-center justify-content-center text-secondary small'
    setI18nText(placeholder, 'common.noPhoto')
    media.append(placeholder)
  }

  const body = document.createElement('div')
  body.className = 'card-body d-flex flex-column'

  const title = document.createElement('h2')
  title.className = 'h5 card-title mb-2'
  title.textContent = dog.name || t('common.unnamedDog')

  const location = document.createElement('p')
  location.className = 'text-secondary mb-2'
  location.textContent = getDogDisplayLocation(dog)

  const detailParts = [dog.breed, dog.size, dog.gender].filter(Boolean)
  const details = document.createElement('p')
  details.className = 'mb-3'
  details.textContent = detailParts.length ? detailParts.join(' · ') : t('discover.noBreedOrDetails')

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

  addItem(t('discover.ageYears'), dog.age_years)
  addItem(t('discover.temperament'), dog.temperament)

  const distanceLabel = getDogDistanceLabel(dog)

  if (distanceLabel) {
    addItem(t('discover.distance'), distanceLabel)
  }

  if (dog.description) {
    const description = document.createElement('p')
    description.className = 'mt-3 mb-0'
    description.textContent = dog.description
    body.append(title, location, details, list, description)
  } else {
    body.append(title, location, details, list)
  }

  const actions = document.createElement('div')
  actions.className = 'd-flex flex-wrap gap-2 mt-3'

  const viewButton = document.createElement('a')
  viewButton.className = 'btn btn-outline-primary btn-sm'
  viewButton.href = `/dogs/${dog.id}`
  viewButton.setAttribute('data-link', '')
  setI18nText(viewButton, 'discover.viewProfile')

  actions.append(viewButton)

  if (!isOwnDog(dog) && state.myDogs.length) {
    const requestButton = document.createElement('button')
    requestButton.type = 'button'
    requestButton.className = 'btn btn-outline-success btn-sm'
    requestButton.dataset.requestPlaydateId = dog.id
    if (hasAcceptedMatchForDog(dog.id)) {
      setI18nText(requestButton, 'discover.matched')
    } else {
      setI18nText(requestButton, 'discover.requestPlaydate')
    }
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
    setI18nText(alert, 'discover.noDogsMatchFilters')

    empty.append(alert)
    list.append(empty)
    setI18nText(listMeta, 'discover.zeroDogsShown')
    return
  }

  const fragment = document.createDocumentFragment()

  state.filteredDogs.forEach((dog) => {
    fragment.append(createDogCard(dog))
  })

  list.append(fragment)
  setI18nText(listMeta, 'discover.dogsShown', {
    count: state.filteredDogs.length,
    suffix: state.filteredDogs.length === 1 ? '' : 's',
  })
}

function renderMap(dogs) {
  const mapElement = document.querySelector('[data-discover-map]')
  const mapStatus = document.querySelector('[data-discover-map-status]')
  const mapMeta = document.querySelector('[data-discover-map-meta]')

  if (!mapElement || !mapStatus || !mapMeta) {
    return
  }

  if (!state.leaflet) {
    setTranslatedStatus(mapStatus, 'discover.mapUnavailable', 'warning')
    setI18nText(mapMeta, 'discover.mapUnavailableLabel')
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
          setTranslatedStatus(mapStatus, 'discover.mapTilesUnavailable', 'warning')
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
        <strong>${escapeHtml(dog.name || t('common.unnamedDog'))}</strong>
        <span class="text-secondary small">${escapeHtml([dog.breed, locationLabel].filter(Boolean).join(' · ') || t('discover.approxLocation'))}</span>
        <a class="small" href="/dogs/${encodeURIComponent(dog.id)}" data-link>${escapeHtml(t('discover.viewProfile'))}</a>
      </div>
    `

    marker.bindPopup(popupHtml)
    marker.addTo(state.markersLayer)
    markerBounds.push([coordinates.latitude, coordinates.longitude])
  })

  if (markerBounds.length) {
    state.map.fitBounds(markerBounds, { padding: [24, 24], maxZoom: 14 })
    setI18nText(mapMeta, 'discover.results', {
      count: markerBounds.length,
      suffix: markerBounds.length === 1 ? '' : 's',
    })
    setTranslatedStatus(mapStatus, 'discover.markersApproximateOnly', 'secondary')
    return
  }

  state.map.setView([SOFIA_FALLBACK_CENTER.latitude, SOFIA_FALLBACK_CENTER.longitude], 11)
  setI18nText(mapMeta, 'discover.noMarkers')
  setTranslatedStatus(mapStatus, 'discover.noApproximateCoordinates', 'warning')
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
    setI18nText(locationStatus, 'discover.locationStatusUsingBrowserLocation')
    return
  }

  radiusFilter.disabled = true
  clearButton.classList.add('d-none')
  setI18nText(locationStatus, 'discover.locationStatusRadiusDisabled')
}

function renderSummary() {
  const meta = document.querySelector('[data-discover-meta]')
  const status = document.querySelector('[data-discover-status]')

  if (meta) {
    setI18nText(meta, 'discover.results', {
      count: state.filteredDogs.length,
      suffix: state.filteredDogs.length === 1 ? '' : 's',
    })
  }

  if (status) {
    if (!state.dogs.length) {
      setTranslatedStatus(status, 'discover.noDogsAvailableYet', 'light')
      return
    }

    if (!state.filteredDogs.length) {
      setTranslatedStatus(status, 'discover.noDogsMatchFilters', 'warning')
      return
    }

    if (!state.myDogs.length) {
      setTranslatedStatus(status, 'discover.browseDogsFromProfile', 'info')
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
  setI18nText(cityPlaceholder, 'discover.allCities')
  cityFilter.append(cityPlaceholder)

  options.cities.forEach((city) => {
    const option = document.createElement('option')
    option.value = city
    option.textContent = city
    cityFilter.append(option)
  })

  const districtPlaceholder = document.createElement('option')
  districtPlaceholder.value = ''
  setI18nText(districtPlaceholder, 'discover.allDistricts')
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
    setI18nText(note, 'discover.playdateModalNoteAddDog')
    submitButton.disabled = true
    return
  }

  if (!senderDogId || !recipientDogId) {
    setI18nText(note, 'discover.playdateModalNoteChooseSender')
    submitButton.disabled = true
    return
  }

  if (String(senderDogId) === String(recipientDogId)) {
    setI18nText(note, 'discover.playdateModalNoteSelf')
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
    setI18nText(note, 'discover.playdateModalNoteMatched')
    submitButton.disabled = true
    return
  }

  if (hasPendingPair) {
    setI18nText(note, 'discover.playdateModalNotePending')
    submitButton.disabled = true
    return
  }

  setI18nText(note, 'discover.playdateModalNoteNoMessages')
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
    ? t('discover.recipientSummary', {
        name: state.recipientDog.name || t('common.unnamedDog'),
        location: getDogDisplayLocation(state.recipientDog),
      })
    : ''
  recipientInput.value = state.recipientDog?.id ?? ''

  senderSelect.replaceChildren()

  if (!state.myDogs.length) {
    const option = document.createElement('option')
    option.value = ''
    setI18nText(option, 'discover.addYourOwnDogFirst')
    senderSelect.append(option)
    senderSelect.disabled = true
    setTranslatedStatus(modalStatus, 'discover.playdateModalNoteAddDog', 'warning')
    syncModalNotes()
    return
  }

  senderSelect.disabled = false

  const placeholder = document.createElement('option')
  placeholder.value = ''
  setI18nText(placeholder, 'discover.selectSenderDog')
  senderSelect.append(placeholder)

  state.myDogs.forEach((dog) => {
    const option = document.createElement('option')
    option.value = dog.id
    option.textContent = `${dog.name || t('common.unnamedDog')} · ${getDogDisplayLocation(dog)}`
    senderSelect.append(option)
  })

  senderSelect.value = state.myDogs[0]?.id ?? ''
  setTranslatedStatus(modalStatus, 'discover.chooseDogToSend', 'secondary')
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
    setTranslatedStatus(locationStatus, 'discover.locationStatusGeoUnavailable', 'warning')
    return
  }

  setTranslatedStatus(locationStatus, 'discover.locationStatusRequesting', 'secondary')

  navigator.geolocation.getCurrentPosition(
    (position) => {
      state.referenceLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }

      radiusFilter.disabled = false
      setTranslatedStatus(locationStatus, 'discover.locationStatusUsingBrowserLocation', 'success')
      refreshDiscoverUI()
    },
    (error) => {
      state.referenceLocation = null
      radiusFilter.disabled = true

      if (error.code === 1) {
        setTranslatedStatus(locationStatus, 'discover.locationStatusPermissionDenied', 'warning')
      } else {
        setTranslatedStatus(locationStatus, 'discover.locationStatusUnableToGet', 'danger')
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

  setTranslatedStatus(status, 'discover.loadingDogs', 'secondary')
  setTranslatedStatus(playdateModalStatus, 'discover.selectDogToSendRequest', 'secondary')
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
    setI18nText(meta, 'discover.unableToLoadDogs')
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
    submitButton.textContent = t('discover.sending')

    const { data, error } = await createPlaydateRequest({ senderDogId, recipientDogId })

    if (error) {
      setStatus(playdateModalStatus, error.message, 'danger')
      submitButton.disabled = false
      submitButton.textContent = t('discover.sendRequest')
      syncModalNotes()
      return
    }

    state.modal.hide()
    setTranslatedStatus(status, 'discover.requestSent', 'success')
    submitButton.disabled = false
    submitButton.textContent = t('discover.sendRequest')

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
    submitButton.textContent = t('discover.sendRequest')
    submitButton.disabled = false
    setTranslatedStatus(playdateModalStatus, 'discover.selectDogToSendRequest', 'secondary')
  })

  if (!state.myDogs.length) {
    setTranslatedStatus(status, 'discover.browseDogsFromProfileInfo', 'info')
  } else {
    setTranslatedStatus(status, 'discover.loadingDogs', 'secondary')
  }

  state.filters.city = cityFilter.value
  state.filters.district = districtFilter.value
  state.filters.radiusKm = radiusFilter.value

  refreshDiscoverUI()
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindDiscoverPage)
  return template
}