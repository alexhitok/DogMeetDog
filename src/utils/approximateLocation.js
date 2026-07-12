const SOFIA_CENTER = { latitude: 42.6977, longitude: 23.3219 }

const APPROXIMATE_LOCATIONS = [
  { city: 'sofia', district: 'center', latitude: 42.6988, longitude: 23.3194 },
  { city: 'sofia', district: 'lozenets', latitude: 42.6685, longitude: 23.3182 },
  { city: 'sofia', district: 'mladost', latitude: 42.6408, longitude: 23.3786 },
  { city: 'sofia', district: 'mladost 1', latitude: 42.6440, longitude: 23.3764 },
  { city: 'sofia', district: 'mladost 2', latitude: 42.6490, longitude: 23.3855 },
  { city: 'sofia', district: 'mladost 3', latitude: 42.6375, longitude: 23.3718 },
  { city: 'sofia', district: 'mladost 4', latitude: 42.6318, longitude: 23.3660 },
  { city: 'sofia', district: 'nadezhda', latitude: 42.7422, longitude: 23.3050 },
  { city: 'sofia', district: 'studentski grad', latitude: 42.6487, longitude: 23.3486 },
  { city: 'sofia', district: 'krasno selo', latitude: 42.6865, longitude: 23.2769 },
  { city: 'sofia', district: 'lyulin', latitude: 42.7269, longitude: 23.2522 },
  { city: 'sofia', district: 'ovcha kupel', latitude: 42.6801, longitude: 23.2473 },
  { city: 'sofia', district: 'vitosha', latitude: 42.6539, longitude: 23.2767 },
  { city: 'sofia', district: 'geo milev', latitude: 42.6889, longitude: 23.3618 },
  { city: 'sofia', district: 'dianabad', latitude: 42.6624, longitude: 23.3518 },
  { city: 'sofia', district: 'iztok', latitude: 42.6763, longitude: 23.3486 },
  { city: 'sofia', district: 'borovo', latitude: 42.6761, longitude: 23.2893 },
]

function normalizeLocationValue(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function lookupApproximateCoordinates(city, district) {
  const normalizedCity = normalizeLocationValue(city)
  const normalizedDistrict = normalizeLocationValue(district)

  if (!normalizedCity && !normalizedDistrict) {
    return null
  }

  if (normalizedCity && normalizedCity !== 'sofia') {
    return null
  }

  const exactDistrictMatch = APPROXIMATE_LOCATIONS.find((entry) => entry.district === normalizedDistrict)

  if (exactDistrictMatch) {
    return { latitude: exactDistrictMatch.latitude, longitude: exactDistrictMatch.longitude }
  }

  if (normalizedCity === 'sofia') {
    return { ...SOFIA_CENTER }
  }

  return null
}

export function resolveApproximateDogLocation(dog = {}) {
  const storedCity = String(dog.location_city ?? '').trim()
  const district = String(dog.district ?? '').trim()
  const coordinates = lookupApproximateCoordinates(storedCity, district)

  return {
    city: storedCity || (coordinates ? 'Sofia' : ''),
    district,
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    visibility: coordinates ? 'approximate' : String(dog.location_visibility ?? 'approximate'),
    hasCoordinates: Boolean(coordinates),
  }
}

export function calculateDistanceKm(origin, destination) {
  if (!origin || !destination) {
    return null
  }

  const originLatitude = Number(origin.latitude)
  const originLongitude = Number(origin.longitude)
  const destinationLatitude = Number(destination.latitude)
  const destinationLongitude = Number(destination.longitude)

  if (
    !Number.isFinite(originLatitude) ||
    !Number.isFinite(originLongitude) ||
    !Number.isFinite(destinationLatitude) ||
    !Number.isFinite(destinationLongitude)
  ) {
    return null
  }

  const earthRadiusKm = 6371
  const latitudeDelta = (destinationLatitude - originLatitude) * (Math.PI / 180)
  const longitudeDelta = (destinationLongitude - originLongitude) * (Math.PI / 180)
  const originLatitudeRad = originLatitude * (Math.PI / 180)
  const destinationLatitudeRad = destinationLatitude * (Math.PI / 180)

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.sin(longitudeDelta / 2) ** 2 * Math.cos(originLatitudeRad) * Math.cos(destinationLatitudeRad)

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatApproximateDogLocation(dog = {}) {
  const location = resolveApproximateDogLocation(dog)

  if (!location.city && !location.district) {
    return 'Location not provided'
  }

  return [location.city, location.district].filter(Boolean).join(' · ')
}

export function getApproximateLocationCoordinates(dog = {}) {
  const location = resolveApproximateDogLocation(dog)

  if (!location.hasCoordinates) {
    return null
  }

  return {
    latitude: location.latitude,
    longitude: location.longitude,
  }
}