const authService = require('../../services/auth')
const { requireAuth, getStoredUser, setStoredUser, clearAuth } = require('../../utils/auth')

Page({
  data: {
    user: {},
    avatarText: '我',
  },

  onLoad() {
    if (!requireAuth()) return
    this.loadUser()
  },

  async loadUser() {
    let user = getStoredUser() || {}
    try {
      user = await authService.getMe()
      setStoredUser(user)
    } catch {
      // handled by request layer
    }
    this.setData({
      user,
      avatarText: String(user.username || '我').trim().charAt(0).toUpperCase() || '我',
    })
  },

  goCategories() {
    wx.navigateTo({ url: '/pages/admin/categories' })
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmColor: '#ee0a24',
      success(res) {
        if (!res.confirm) return
        clearAuth()
        wx.reLaunch({ url: '/pages/auth/login' })
      },
    })
  },
})
