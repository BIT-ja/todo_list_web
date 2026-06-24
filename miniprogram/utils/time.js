function pad(value) {
  return String(value).padStart(2, '0')
}

function todayDateValue() {
  const date = new Date()
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDate(value) {
  if (!value) return null
  const date = new Date(String(value).replace(/-/g, '/'))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(value) {
  const date = parseDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatDateTime(value) {
  const date = parseDate(value)
  if (!date) return ''
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getDueMeta(value) {
  const date = parseDate(value)
  if (!date) {
    return { label: '', level: '' }
  }

  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.floor((dueDay - startToday) / 86400000)
  let label = formatDate(value)
  if (days < 0) label = `已过期 ${Math.abs(days)} 天`
  if (days === 0) label = '今天到期'
  if (days === 1) label = '明天到期'
  if (days > 1 && days <= 7) label = `${days} 天后到期`

  let level = ''
  if (days <= 3) level = 'danger'
  else if (days <= 7) level = 'warning'

  return { label, level, days }
}

module.exports = {
  todayDateValue,
  formatDate,
  formatDateTime,
  getDueMeta,
}
