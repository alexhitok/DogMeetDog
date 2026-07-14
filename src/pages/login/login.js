import template from './login.html?raw'
import './login.css'
import { t } from '../../i18n/i18n.js'
import { loginUser } from '../../services/authService.js'

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('login.pageTitle')}`
}

function renderStatus(target, message, variant) {
  target.innerHTML = `
    <div class="alert alert-${variant} mb-0" role="alert">
      ${message}
    </div>
  `
}

function bindLoginForm() {
  const form = document.querySelector('[data-login-form]')

  if (!form) {
    return
  }

  const status = document.querySelector('[data-login-status]')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (status) {
      status.innerHTML = ''
    }

    const formData = new FormData(form)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')

    const { error } = await loginUser({ email, password })

    if (error) {
      if (status) {
        renderStatus(status, error.message, 'danger')
      }
      return
    }

    if (status) {
      renderStatus(status, t('login.success'), 'success')
    }

    window.history.pushState({}, '', '/profile')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindLoginForm)
  return template
}