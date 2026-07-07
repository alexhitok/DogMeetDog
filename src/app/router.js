import { isSameRoute, matchRoute } from './routes.js'

export function createRouter({
  headerElement,
  contentElement,
  footerElement,
  renderHeader,
  renderFooter,
  syncHeaderNavigation,
}) {
  async function render(pathname = window.location.pathname) {
    const { route, params } = matchRoute(pathname)
    const pageModule = await route.loader()

    headerElement.innerHTML = renderHeader()
    contentElement.innerHTML = pageModule.renderPage(params)
    footerElement.innerHTML = renderFooter()
    syncHeaderNavigation(headerElement, pathname)
    document.title = `DogMeetDog | ${route.title}`
  }

  function navigate(to, replace = false) {
    const targetPath = to instanceof URL ? to.pathname : to

    if (replace) {
      window.history.replaceState({}, '', targetPath)
    } else {
      window.history.pushState({}, '', targetPath)
    }

    return render(targetPath)
  }

  function onDocumentClick(event) {
    const link = event.target.closest('a[data-link]')

    if (!link) {
      return
    }

    const url = new URL(link.href)

    if (url.origin !== window.location.origin) {
      return
    }

    if (isSameRoute(window.location.pathname, url.pathname)) {
      event.preventDefault()
      return
    }

    event.preventDefault()
    navigate(url.pathname)
  }

  function start() {
    document.addEventListener('click', onDocumentClick)
    window.addEventListener('popstate', () => render())
    return render()
  }

  return { start, navigate, render }
}