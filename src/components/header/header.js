import template from './header.html?raw'
import './header.css'
import Offcanvas from 'bootstrap/js/dist/offcanvas'
import { getCurrentUserRole } from '../../services/adminService.js'
import { logoutUser } from '../../services/authService.js'
import { supabase } from '../../services/supabaseClient.js'
import { getUnreadNotificationCount } from '../../services/notificationService.js'

let activeHeaderElement = null
let notificationsChangeListenerBound = false
let authListenerBound = false
let activeOffcanvas = null
let activeOffcanvasElement = null

function navigateWithoutRefresh(targetPath) {
  if (window.location.pathname === targetPath) {
    return
  }

  window.history.pushState({}, '', targetPath)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

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

    const badges = headerElement.querySelectorAll('[data-notifications-badge]')

    if (badges.length && user) {
      const { data: unreadCount } = await getUnreadNotificationCount()
      const displayCount = unreadCount > 99 ? '99+' : String(unreadCount ?? 0)
      badges.forEach((badge) => {
        badge.textContent = displayCount
        badge.classList.toggle('d-none', !unreadCount)
      })
    } else if (badges.length) {
      badges.forEach((badge) => {
        badge.classList.add('d-none')
        badge.textContent = '0'
      })
    }

    
  } catch {
    setAuthNavigationState(headerElement, { isLoggedIn: false, isAdmin: false })
    const badges = headerElement.querySelectorAll('[data-notifications-badge]')
    badges.forEach((badge) => {
      badge.classList.add('d-none')
      badge.textContent = '0'
    })    
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

function bindMobileNavigation(headerElement) {
  const offcanvasElement = headerElement.querySelector('#site-mobile-menu')

  if (!offcanvasElement) {
    return
  }

  if (activeOffcanvasElement !== offcanvasElement) {
    activeOffcanvas?.dispose?.()
    activeOffcanvas = new Offcanvas(offcanvasElement)
    activeOffcanvasElement = offcanvasElement
  }
  if (headerElement.dataset.mobileNavigationBound === 'true') {
    return
  }

  headerElement.dataset.mobileNavigationBound = 'true'
  headerElement.addEventListener('click', (event) => {
    const toggler = event.target.closest('[data-mobile-nav-toggle]')

    if (toggler && toggler.dataset.mobileNavTarget === '#site-mobile-menu') {
      event.preventDefault()
      activeOffcanvas.toggle()
    }
  })

  headerElement.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-link]')

    if (link && activeOffcanvasElement?.contains(link)) {
      activeOffcanvas.hide()
    }
  })

  headerElement.addEventListener('click', async (event) => {
    const logoutButton = event.target.closest('[data-mobile-logout-button]')

    if (!logoutButton) {
      return
    }

    event.preventDefault()

    const { error } = await logoutUser()

    if (error) {
      return
    }

    activeOffcanvas?.hide()
    navigateWithoutRefresh('/login')
  })

  offcanvasElement.addEventListener('show.bs.offcanvas', () => {
    headerElement.querySelectorAll('[data-mobile-nav-toggle]').forEach((button) => {
      button.setAttribute('aria-expanded', 'true')
    })
  })

  offcanvasElement.addEventListener('hidden.bs.offcanvas', () => {
    headerElement.querySelectorAll('[data-mobile-nav-toggle]').forEach((button) => {
      button.setAttribute('aria-expanded', 'false')
    })
  })
}

export function renderHeader() {
  return template
}

export function syncHeaderNavigation(headerElement, pathname) {
  activeHeaderElement = headerElement
  const links = headerElement.querySelectorAll('a[data-link]')

  if (activeOffcanvas) {
    activeOffcanvas.hide()
  }

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

  bindNotificationRefreshListener()
  bindAuthStateListener()
  bindMobileNavigation(headerElement)
  syncAuthNavigation(headerElement)
}