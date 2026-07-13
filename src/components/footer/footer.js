import template from './footer.html?raw'
import './footer.css'
import { getCurrentUser } from '../../services/authService.js'
import { supabase } from '../../services/supabaseClient.js'
import { renderTemplate } from '../../app/template.js'

let activeFooterElement = null
let footerAuthListenerBound = false

function setFooterAuthState(footerElement, isLoggedIn) {
  footerElement.classList.toggle('site-footer--authenticated', isLoggedIn)

  const appShell = document.querySelector('.app-shell')

  if (appShell) {
    appShell.classList.toggle('app-shell--mobile-nav-space', isLoggedIn)
  }
}

async function syncFooterAuthState(footerElement) {
  try {
    const { user } = await getCurrentUser()
    setFooterAuthState(footerElement, Boolean(user))
  } catch {
    setFooterAuthState(footerElement, false)
  }
}

function bindFooterAuthState(footerElement) {
  activeFooterElement = footerElement

  if (!footerAuthListenerBound && supabase?.auth?.onAuthStateChange) {
    footerAuthListenerBound = true

    supabase.auth.onAuthStateChange(() => {
      if (activeFooterElement) {
        syncFooterAuthState(activeFooterElement)
      }
    })
  }

  syncFooterAuthState(footerElement)
}

function getCurrentYear() {
  return String(new Date().getFullYear())
}

export function renderFooter() {
  queueMicrotask(() => {
    const footerElement = document.querySelector('.site-footer')

    if (footerElement) {
      bindFooterAuthState(footerElement)
    }
  })

  return renderTemplate(template, {
    year: getCurrentYear(),
  })
}