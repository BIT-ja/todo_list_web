const { API_BASE_URL } = require('./config')
const { getToken, clearAuth } = require('./auth')

function buildUrl(path, data, method) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  if (method !== 'GET' || !data || Object.keys(data).length === 0) {
    return `${API_BASE_URL}${normalizedPath}`
  }

  const query = Object.keys(data)
    .filter((key) => data[key] !== undefined && data[key] !== null && data[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
    .join('&')
  return query ? `${API_BASE_URL}${normalizedPath}?${query}` : `${API_BASE_URL}${normalizedPath}`
}

function request(path, options = {}) {
  const method = options.method || 'GET'
  const token = getToken()

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(path, options.data, method),
      method,
      data: method === 'GET' ? undefined : options.data,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {}),
      },
      success(res) {
        const body = res.data || {}
        if (res.statusCode === 401 || body.code === 401) {
          clearAuth()
          wx.showToast({ title: '请重新登录', icon: 'none' })
          wx.redirectTo({ url: '/pages/auth/login' })
          reject(body)
          return
        }

        if (res.statusCode < 200 || res.statusCode >= 300 || body.code !== 0) {
          wx.showToast({ title: body.message || '请求失败', icon: 'none' })
          reject(body)
          return
        }

        resolve(body.data)
      },
      fail(err) {
        wx.showToast({ title: '网络请求失败', icon: 'none' })
        reject(err)
      },
    })
  })
}

module.exports = {
  get(path, data) {
    return request(path, { method: 'GET', data })
  },
  post(path, data) {
    return request(path, { method: 'POST', data })
  },
  patch(path, data) {
    return request(path, { method: 'PATCH', data })
  },
  delete(path, data) {
    return request(path, { method: 'DELETE', data })
  },
}
