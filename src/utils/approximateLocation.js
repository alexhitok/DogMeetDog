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

const CYRILLIC_SOFIA = '\u0441\u043e\u0444\u0438\u044f'
const CYRILLIC_SOFIA_TYPO = '\u0441\u043e\u0444\u0438\u0430'

const CITY_KEY_BY_NORMALIZED = {
  sofia: 'sofia',
  [CYRILLIC_SOFIA]: 'sofia',
  [CYRILLIC_SOFIA_TYPO]: 'sofia',
}

const DISTRICT_KEY_BY_NORMALIZED = {
  center: 'center',
  lozenets: 'lozenets',
  mladost: 'mladost',
  'mladost 1': 'mladost_1',
  'mladost 2': 'mladost_2',
  'mladost 3': 'mladost_3',
  'mladost 4': 'mladost_4',
  nadezhda: 'nadezhda',
  'studentski grad': 'studentski_grad',
  'krasno selo': 'krasno_selo',
  lyulin: 'lyulin',
  'ovcha kupel': 'ovcha_kupel',
  vitosha: 'vitosha',
  'geo milev': 'geo_milev',
  dianabad: 'dianabad',
  iztok: 'iztok',
  borovo: 'borovo',
  banishora: 'banishora',
}

const CITY_LABELS = {
  sofia: {
    en: 'Sofia',
    bg: '\u0421\u043e\u0444\u0438\u044f',
  },
}

const DISTRICT_LABELS = {
  center: { en: 'Center', bg: '\u0426\u0435\u043d\u0442\u044a\u0440' },
  lozenets: { en: 'Lozenets', bg: '\u041b\u043e\u0437\u0435\u043d\u0435\u0446' },
  mladost: { en: 'Mladost', bg: '\u041c\u043b\u0430\u0434\u043e\u0441\u0442' },
  mladost_1: { en: 'Mladost 1', bg: '\u041c\u043b\u0430\u0434\u043e\u0441\u0442 1' },
  mladost_2: { en: 'Mladost 2', bg: '\u041c\u043b\u0430\u0434\u043e\u0441\u0442 2' },
  mladost_3: { en: 'Mladost 3', bg: '\u041c\u043b\u0430\u0434\u043e\u0441\u0442 3' },
  mladost_4: { en: 'Mladost 4', bg: '\u041c\u043b\u0430\u0434\u043e\u0441\u0442 4' },
  nadezhda: { en: 'Nadezhda', bg: '\u041d\u0430\u0434\u0435\u0436\u0434\u0430' },
  studentski_grad: { en: 'Studentski Grad', bg: '\u0421\u0442\u0443\u0434\u0435\u043d\u0442\u0441\u043a\u0438 \u0433\u0440\u0430\u0434' },
  krasno_selo: { en: 'Krasno Selo', bg: '\u041a\u0440\u0430\u0441\u043d\u043e \u0441\u0435\u043b\u043e' },
  lyulin: { en: 'Lyulin', bg: '\u041b\u044e\u043b\u0438\u043d' },
  ovcha_kupel: { en: 'Ovcha Kupel', bg: '\u041e\u0432\u0447\u0430 \u043a\u0443\u043f\u0435\u043b' },
  vitosha: { en: 'Vitosha', bg: '\u0412\u0438\u0442\u043e\u0448\u0430' },
  geo_milev: { en: 'Geo Milev', bg: '\u0413\u0435\u043e \u041c\u0438\u043b\u0435\u0432' },
  dianabad: { en: 'Dianabad', bg: '\u0414\u0438\u0430\u043d\u0430\u0431\u0430\u0434' },
  iztok: { en: 'Iztok', bg: '\u0418\u0437\u0442\u043e\u043a' },
  borovo: { en: 'Borovo', bg: '\u0411\u043e\u0440\u043e\u0432\u043e' },
  banishora: { en: 'Banishora', bg: '\u0411\u0430\u043d\u0438\u0448\u043e\u0440\u0430' },
}

function normalizeLocationValue(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

export function getLocationCityKey(value) {
  const normalized = normalizeLocationValue(value)
  return CITY_KEY_BY_NORMALIZED[normalized] ?? normalized
}

export function getLocationDistrictKey(value) {
  const normalized = normalizeLocationValue(value)
  return DISTRICT_KEY_BY_NORMALIZED[normalized] ?? normalized
}

export function getLocalizedCityName(value, language = 'en') {
  const key = getLocationCityKey(value)
  const labels = CITY_LABELS[key]

  if (labels) {
    return labels[language] ?? labels.en
  }

  return String(value ?? '').trim()
}

export function getLocalizedDistrictName(value, language = 'en') {
  const key = getLocationDistrictKey(value)
  const labels = DISTRICT_LABELS[key]

  if (labels) {
    return labels[language] ?? labels.en
  }

  return String(value ?? '').trim()
}

function lookupApproximateCoordinates(city, district) {
  const cityKey = getLocationCityKey(city)
  const districtKey = getLocationDistrictKey(district)

  if (!cityKey && !districtKey) {
    return null
  }

  if (cityKey && cityKey !== 'sofia') {
    return null
  }

  const exactDistrictMatch = APPROXIMATE_LOCATIONS.find(
    (entry) => getLocationDistrictKey(entry.district) === districtKey
  )

  if (exactDistrictMatch) {
    return { latitude: exactDistrictMatch.latitude, longitude: exactDistrictMatch.longitude }
  }

  if (cityKey === 'sofia') {
    return { ...SOFIA_CENTER }
  }

  return null
}

export function resolveApproximateDogLocation(dog = {}) {
  const storedCity = String(dog.location_city ?? '').trim()
  const district = String(dog.district ?? '').trim()
  const coordinates = lookupApproximateCoordinates(storedCity, district)
  const canonicalCity = getLocalizedCityName(storedCity || (coordinates ? 'Sofia' : ''), 'en')

  return {
    city: canonicalCity,
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

export function formatApproximateDogLocation(dog = {}, language = 'en') {
  const location = resolveApproximateDogLocation(dog)
  const localizedCity = getLocalizedCityName(location.city, language)
  const localizedDistrict = getLocalizedDistrictName(location.district, language)

  if (!localizedCity && !localizedDistrict) {
    return language === 'bg' ? 'Местоположението не е посочено' : 'Location not provided'
  }

  return [localizedCity, localizedDistrict].filter(Boolean).join(' · ')
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