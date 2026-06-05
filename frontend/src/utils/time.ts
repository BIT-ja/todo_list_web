const EAST_8_OFFSET_MS = 8 * 60 * 60 * 1000
const EAST_8_PATTERN = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/

function pad(value: number | string) {
  return String(value).padStart(2, '0')
}

function getEast8NowDate() {
  return new Date(Date.now() + EAST_8_OFFSET_MS)
}

function parseEast8Parts(value: string) {
  const match = EAST_8_PATTERN.exec(value)
  if (!match) return null

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] || 0),
    minute: Number(match[5] || 0),
    second: Number(match[6] || 0),
  }
}

function parseEast8Timestamp(value: string) {
  const parts = parseEast8Parts(value)
  if (!parts) return Number.NaN
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour - 8, parts.minute, parts.second)
}

export function getEast8TodayDate() {
  const now = getEast8NowDate()
  return new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

export function getEast8DatePickerValue(value?: string | null) {
  const parts = value ? parseEast8Parts(value) : null
  if (parts) {
    return [String(parts.year), pad(parts.month), pad(parts.day)]
  }

  const now = getEast8NowDate()
  return [String(now.getUTCFullYear()), pad(now.getUTCMonth() + 1), pad(now.getUTCDate())]
}

export function formatEast8DateLabel(value: string) {
  const parts = parseEast8Parts(value)
  if (!parts) return value
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`
}

export function formatEast8MonthDay(value: string) {
  const parts = parseEast8Parts(value)
  if (!parts) return value
  return `${parts.month}月${parts.day}日`
}

export function formatEast8DateTime(value: string) {
  const parts = parseEast8Parts(value)
  if (!parts) return value
  return `${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`
}

export function isEast8BeforeNow(value: string) {
  const timestamp = parseEast8Timestamp(value)
  return Number.isFinite(timestamp) && timestamp < Date.now()
}
