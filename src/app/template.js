export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function renderTemplate(template, values = {}) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => escapeHtml(values[key] ?? ''))
}