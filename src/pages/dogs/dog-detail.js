import template from './dog-detail.html?raw'
import './dog-detail.css'
import { renderTemplate } from '../../app/template.js'

export function renderPage(params = {}) {
  return renderTemplate(template, {
    id: params.id ?? '',
  })
}