import template from './header.html?raw'
import './header.css'

export function renderHeader() {
  return template
}

export function syncHeaderNavigation(headerElement, pathname) {
  const links = headerElement.querySelectorAll('a[data-link]')

  links.forEach((link) => {
    const linkPath = new URL(link.href).pathname
    const isActive = pathname === linkPath || (pathname.startsWith('/dogs/') && linkPath === '/dogs/1')

    link.classList.toggle('is-active', isActive)

    if (isActive) {
      link.setAttribute('aria-current', 'page')
    } else {
      link.removeAttribute('aria-current')
    }
  })
}