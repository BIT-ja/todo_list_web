const TOKEN_KEY = 'todo_token'
const USER_KEY = 'todo_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function getStoredUser() {
  return wx.getStorageSync(USER_KEY) || null
}

function getRuntimeApp() {
  try {
    return getApp()
  } catch {
    return null
  }
}

function setStoredUser(user) {
  wx.setStorageSync(USER_KEY, user)
  const app = getRuntimeApp()
  if (app && app.globalData) {
    app.globalData.user = user
  }
}

function setAuth(data) {
  if (data.token) {
    setToken(data.token)
  }
  if (data.user) {
    setStoredUser(data.user)
  }
}

function clearAuth() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
  const app = getRuntimeApp()
  if (app && app.globalData) {
    app.globalData.user = null
  }
}

function requireAuth() {
  if (!getToken()) {
    wx.redirectTo({ url: '/pages/auth/login' })
    return false
  }
  return true
}

module.exports = {
  TOKEN_KEY,
  USER_KEY,
  getToken,
  setToken,
  getStoredUser,
  setStoredUser,
  setAuth,
  clearAuth,
  requireAuth,
}
