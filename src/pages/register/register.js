import template from './register.html?raw'
import './register.css'
import { t } from '../../i18n/i18n.js'
import { registerUser } from '../../services/authService.js'

let titleSyncBound = false

function bindTitleSync() {
  if (titleSyncBound) {
    return
  }

  titleSyncBound = true
  window.addEventListener('language:changed', updatePageTitle)
}

function updatePageTitle() {
  document.title = `DogMeetDog | ${t('register.pageTitle')}`
}

function renderStatus(target, message, variant) {
  target.innerHTML = `
    <div class="alert alert-${variant} mb-0" role="alert">
      ${message}
    </div>
  `
}

function bindRegisterForm() {
  const form = document.querySelector('[data-register-form]')

  if (!form) {
    return
  }

  const status = document.querySelector('[data-register-status]')

  form.addEventListener('submit', async (event) => {
    event.preventDefault()

    if (status) {
      status.innerHTML = ''
    }

    const formData = new FormData(form)
    const payload = {
      email: String(formData.get('email') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
      fullName: String(formData.get('fullName') ?? '').trim(),
    }

    const { error } = await registerUser(payload)

    if (error) {
      if (status) {
        renderStatus(status, error.message, 'danger')
      }
      return
    }

    if (status) {
      renderStatus(status, t('register.success'), 'success')
    }

    window.history.pushState({}, '', '/profile')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
}

export function renderPage() {
  bindTitleSync()
  queueMicrotask(bindRegisterForm)
  return template
}