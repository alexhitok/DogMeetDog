import template from './register.html?raw'
import './register.css'
import { registerUser } from '../../services/authService.js'

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
      renderStatus(status, 'Registration successful. Redirecting to profile...', 'success')
    }

    window.location.assign('/profile')
  })
}

export function renderPage() {
  queueMicrotask(bindRegisterForm)
  return template
}