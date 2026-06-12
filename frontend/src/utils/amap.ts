function normalizeName(name: string) {
  return name.replace(/[|,]/g, ' ').trim() || '目的地'
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent)
}

function isIOS() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function buildAmapWebNavigationUrl(destination: { lng: number; lat: number; name: string }) {
  const params = new URLSearchParams({
    from: '',
    to: `${destination.lng},${destination.lat},${normalizeName(destination.name)}`,
    mode: 'car',
    policy: '0',
    src: 'todo-app',
    callnative: '1',
  })

  return `https://uri.amap.com/navigation?${params.toString()}`
}

function buildAmapNativeNavigationUrl(destination: { lng: number; lat: number; name: string }) {
  const commonParams = new URLSearchParams({
    sourceApplication: 'todo-app',
    dlat: String(destination.lat),
    dlon: String(destination.lng),
    dname: normalizeName(destination.name),
    dev: '0',
    t: '0',
  })

  if (isAndroid()) {
    return `androidamap://route/plan/?${commonParams.toString()}`
  }

  if (isIOS()) {
    return `iosamap://path?${commonParams.toString()}`
  }

  return ''
}

export function openAmapNavigation(destination: { lng: number; lat: number; name: string }) {
  const webUrl = buildAmapWebNavigationUrl(destination)
  const nativeUrl = buildAmapNativeNavigationUrl(destination)

  if (!nativeUrl) {
    window.open(webUrl, '_blank', 'noreferrer')
    return
  }

  window.location.href = nativeUrl
}
