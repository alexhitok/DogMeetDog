import template from './home.html?raw'
import './home.css'
import { getCurrentUser } from '../../services/authService.js'
import { supabase } from '../../services/supabaseClient.js'

let homeAuthListenerBound = false
let activeHomePageElement = null

function setHomeAuthState(homeElement, isLoggedIn) {
  const authItems = homeElement.querySelectorAll('[data-home-auth-visible]')

  authItems.forEach((item) => {
    item.hidden = item.dataset.homeAuthVisible === 'logged-out' ? isLoggedIn : false
  })
}

async function syncHomeAuthState(homeElement) {
  try {
    const { user } = await getCurrentUser()
    setHomeAuthState(homeElement, Boolean(user))
  } catch {
    setHomeAuthState(homeElement, false)
  }
}

function bindHomeAuthState(homeElement) {
  activeHomePageElement = homeElement

  if (!homeAuthListenerBound && supabase?.auth?.onAuthStateChange) {
    homeAuthListenerBound = true

    supabase.auth.onAuthStateChange(() => {
      if (activeHomePageElement) {
        syncHomeAuthState(activeHomePageElement)
      }
    })
  }

  syncHomeAuthState(homeElement)
}

function bindPhotoAccordion() {
  const accordion = document.querySelector('[data-photo-accordion]')

  if (!accordion) {
    return
  }

  const panels = Array.from(accordion.querySelectorAll('[data-photo-panel]'))

  const setActivePanel = (activePanel) => {
    panels.forEach((panel) => {
      const isActive = panel === activePanel
      panel.classList.toggle('is-active', isActive)
      panel.setAttribute('aria-pressed', String(isActive))
    })
  }

  panels.forEach((panel) => {
    panel.addEventListener('click', () => setActivePanel(panel))
    panel.addEventListener('focus', () => setActivePanel(panel))
    panel.addEventListener('mouseenter', () => {
      if (!window.matchMedia('(pointer: coarse)').matches) {
        setActivePanel(panel)
      }
    })
  })

  if (!panels.some((panel) => panel.classList.contains('is-active'))) {
    setActivePanel(panels[0])
  }
}

export function renderPage() {
  queueMicrotask(() => {
    bindPhotoAccordion()
    const homePage = document.querySelector('.home-page')

    if (homePage) {
      bindHomeAuthState(homePage)
    }
  })
  return template
}