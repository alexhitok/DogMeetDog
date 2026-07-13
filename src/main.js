import 'bootstrap/dist/css/bootstrap.min.css'
import './style.css'
import { createRouter } from './app/router.js'
import { renderFooter } from './components/footer/footer.js'
import { renderHeader, syncHeaderNavigation } from './components/header/header.js'
import { initializeLanguage, translatePage } from './i18n/i18n.js'

const app = document.querySelector('#app')

app.innerHTML = `
  <div class="container py-3 py-lg-4 app-shell">
    <header id="site-header"></header>
    <main id="site-content" class="py-4 flex-grow-1"></main>
    <footer id="site-footer" class="pt-3"></footer>
  </div>
`

initializeLanguage()

createRouter({
  headerElement: document.querySelector('#site-header'),
  contentElement: document.querySelector('#site-content'),
  footerElement: document.querySelector('#site-footer'),
  renderHeader,
  renderFooter,
  syncHeaderNavigation,
  onAfterRender: () => translatePage(document),
}).start()
