import template from './header.html?raw'
import './header.css'
import Collapse from 'bootstrap/js/dist/collapse'
import { getCurrentUserRole } from '../../services/adminService.js'
import { supabase } from '../../services/supabaseClient.js'
import { getUnreadNotificationCount } from '../../services/notificationService.js'

let activeHeaderElement = null
let notificationsChangeListenerBound = false
let authListenerBound = false
let collapseInstance = null

function setAuthNavigationState(headerElement, { isLoggedIn, isAdmin }) {
  const authItems = headerElement.querySelectorAll('[data-auth-visible]')

  authItems.forEach((item) => {
    const visibility = item.dataset.authVisible

    const shouldShow =
      (visibility === 'logged-in' && isLoggedIn) ||
      (visibility === 'logged-out' && !isLoggedIn) ||
      (visibility === 'admin' && isLoggedIn && isAdmin)

    item.hidden = !shouldShow
  })
}

async function syncAuthNavigation(headerElement) {
  try {
    const { user, isAdmin } = await getCurrentUserRole()
    setAuthNavigationState(headerElement, { isLoggedIn: Boolean(user), isAdmin })

    const badge = headerElement.querySelector('[data-notifications-badge]')

    if (badge && user) {
      const { data: unreadCount } = await getUnreadNotificationCount()
      badge.textContent = String(unreadCount ?? 0)
      badge.classList.toggle('d-none', !unreadCount)
    } else if (badge) {
      badge.classList.add('d-none')
      badge.textContent = '0'
    }
  } catch {
    setAuthNavigationState(headerElement, { isLoggedIn: false, isAdmin: false })
    const badge = headerElement.querySelector('[data-notifications-badge]')
    if (badge) {
      badge.classList.add('d-none')
      badge.textContent = '0'
    }
  }
}

function bindNotificationRefreshListener() {
  if (notificationsChangeListenerBound) {
    return
  }

  notificationsChangeListenerBound = true

  window.addEventListener('notifications:changed', () => {
    if (activeHeaderElement) {
      syncAuthNavigation(activeHeaderElement)
    }
  })
}

function bindAuthStateListener() {
  if (authListenerBound || !supabase?.auth?.onAuthStateChange) {
    return
  }

  authListenerBound = true

  supabase.auth.onAuthStateChange(() => {
    if (activeHeaderElement) {
      syncAuthNavigation(activeHeaderElement)
    }
  })
}

export function renderHeader() {
  return template
}

export function syncHeaderNavigation(headerElement, pathname) {
  activeHeaderElement = headerElement
  const links = headerElement.querySelectorAll('a[data-link]')

  links.forEach((link) => {
    const linkPath = new URL(link.href).pathname
    const isActive = pathname === linkPath

    link.classList.toggle('is-active', isActive)

    if (isActive) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })

  const navCollapse = headerElement.querySelector('#dmdNav')
  if (navCollapse && !collapseInstance) {
    collapseInstance = new Collapse(navCollapse, { toggle: false })
  }

  if (window.lucide?.createIcons) {
    window.lucide.createIcons()
  }

  bindNotificationRefreshListener()
  bindAuthStateListener()
  syncAuthNavigation(headerElement)
}