import template from './header.html?raw'
import './header.css'
import { getCurrentUserRole } from '../../services/adminService.js'

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
  } catch {
    setAuthNavigationState(headerElement, { isLoggedIn: false, isAdmin: false })
  }
}

export function renderHeader() {
  return template
}

export function syncHeaderNavigation(headerElement, pathname) {
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

  syncAuthNavigation(headerElement)
}