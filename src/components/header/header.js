import template from './header.html?raw'
import './header.css'
import { getCurrentUser } from '../../services/authService.js'

function setAuthNavigationState(headerElement, isLoggedIn) {
  const authItems = headerElement.querySelectorAll('[data-auth-visible]')

  authItems.forEach((item) => {
    const visibility = item.dataset.authVisible

    const shouldShow =
      (visibility === 'logged-in' && isLoggedIn) ||
      (visibility === 'logged-out' && !isLoggedIn)

    item.hidden = !shouldShow
  })
}

async function syncAuthNavigation(headerElement) {
  try {
    const { user } = await getCurrentUser()
    setAuthNavigationState(headerElement, Boolean(user))
  } catch {
    setAuthNavigationState(headerElement, false)
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