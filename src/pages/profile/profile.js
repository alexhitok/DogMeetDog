import template from './profile.html?raw'
import './profile.css'
import { getCurrentUser, logoutUser } from '../../services/authService.js'

function setMessage(target, message, variant) {
  target.innerHTML = `
    <div class="alert alert-${variant} mb-0" role="alert">
      ${message}
    </div>
  `
}

async function bindProfileView() {
  const userInfo = document.querySelector('[data-profile-user]')
  const actionArea = document.querySelector('[data-profile-actions]')

  if (!userInfo || !actionArea) {
    return
  }

  const { user, error } = await getCurrentUser()

  if (error) {
    setMessage(userInfo, error.message, 'danger')
    actionArea.innerHTML = ''
    return
  }

  if (!user) {
    setMessage(userInfo, 'You are not logged in.', 'warning')
    actionArea.innerHTML = ''
    return
  }

  userInfo.innerHTML = `
    <div class="alert alert-success mb-0" role="alert">
      Logged in as <strong>${user.email ?? 'Unknown email'}</strong>
    </div>
  `

  actionArea.innerHTML = `
    <button type="button" class="btn btn-outline-danger" data-logout-button>Logout</button>
  `

  const logoutButton = actionArea.querySelector('[data-logout-button]')

  logoutButton?.addEventListener('click', async () => {
    const { error: logoutError } = await logoutUser()

    if (logoutError) {
      setMessage(userInfo, logoutError.message, 'danger')
      return
    }

    window.location.assign('/login')
  })
}

export function renderPage() {
  queueMicrotask(bindProfileView)
  return template
}