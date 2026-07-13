import { translations } from './translations.js'

const STORAGE_KEY = 'dogmeetdog.language'
const SUPPORTED_LANGUAGES = ['en', 'bg']
const DEFAULT_LANGUAGE = 'en'

let currentLanguage = DEFAULT_LANGUAGE

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE
}

function getNestedValue(source, key) {
  return key.split('.').reduce((value, segment) => {
    if (value && typeof value === 'object' && segment in value) {
      return value[segment]
    }

    return undefined
  }, source)
}

function interpolate(template, replacements = {}) {
  return template.replace(/\{(\w+)\}/g, (match, token) => {
    if (token in replacements) {
      return String(replacements[token])
    }

    return match
  })
}

function getReplacementMap(element) {
  const raw = element.dataset.i18nReplacements

  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function updateLanguageSwitchers(root = document) {
  const switchers = root.querySelectorAll('[data-language-switcher]')

  switchers.forEach((switcher) => {
    if (!switcher.dataset.i18nBound) {
      switcher.dataset.i18nBound = 'true'
      switcher.addEventListener('click', (event) => {
        const option = event.target.closest('[data-lang-option]')

        if (!option) {
          return
        }

        const language = option.dataset.langOption
        setLanguage(language)
      })
    }

    const options = switcher.querySelectorAll('[data-lang-option]')
    options.forEach((option) => {
      const isActive = option.dataset.langOption === currentLanguage
      option.classList.toggle('is-active', isActive)
      option.classList.toggle('active', isActive)
      option.setAttribute('aria-pressed', String(isActive))
    })
  })
}

export function getCurrentLanguage() {
  return currentLanguage
}

export function t(key, replacements = {}) {
  const localizedValue = getNestedValue(translations[currentLanguage], key)
  const fallbackValue = getNestedValue(translations[DEFAULT_LANGUAGE], key)
  const value = typeof localizedValue === 'string' ? localizedValue : fallbackValue

  if (typeof value !== 'string') {
    return key
  }

  return interpolate(value, replacements)
}

export function translatePage(rootElement = document) {
  const root = rootElement || document

  root.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n, getReplacementMap(element))
  })

  root.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
    element.setAttribute('placeholder', t(element.dataset.i18nPlaceholder, getReplacementMap(element)))
  })

  root.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', t(element.dataset.i18nAriaLabel, getReplacementMap(element)))
  })

  root.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.setAttribute('title', t(element.dataset.i18nTitle, getReplacementMap(element)))
  })

  updateLanguageSwitchers(root)
}

export function setLanguage(language) {
  const nextLanguage = normalizeLanguage(language)

  if (nextLanguage === currentLanguage) {
    translatePage(document)
    return currentLanguage
  }

  currentLanguage = nextLanguage

  try {
    window.localStorage.setItem(STORAGE_KEY, currentLanguage)
  } catch {
    // Ignore storage failures in private browsing modes.
  }

  document.documentElement.lang = currentLanguage
  translatePage(document)

  window.dispatchEvent(
    new CustomEvent('language:changed', {
      detail: { language: currentLanguage },
    })
  )

  return currentLanguage
}

export function initializeLanguage() {
  let savedLanguage = DEFAULT_LANGUAGE

  try {
    savedLanguage = window.localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE
  } catch {
    savedLanguage = DEFAULT_LANGUAGE
  }

  currentLanguage = normalizeLanguage(savedLanguage)
  document.documentElement.lang = currentLanguage
  translatePage(document)

  return currentLanguage
}
