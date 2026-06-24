const authService = require('../../services/auth')
const { getToken, setAuth } = require('../../utils/auth')

function wxLoginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(res) {
        if (res.code) resolve(res.code)
        else reject(new Error('missing code'))
      },
      fail: reject,
    })
  })
}

Page({
  data: {
    username: '',
    password: '',
    wechatLoading: false,
    passwordLoading: false,
  },

  onLoad() {
    if (getToken()) {
      wx.reLaunch({ url: '/pages/todos/index' })
    }
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value })
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value })
  },

  async handleWechatLogin() {
    this.setData({ wechatLoading: true })
    try {
      const code = await wxLoginCode()
      const result = await authService.wechatLogin(code)
      if (!result.registered) {
        wx.showToast({ title: '请先加入组织或绑定账号', icon: 'none' })
        wx.navigateTo({ url: '/pages/auth/join' })
        return
      }
      setAuth(result)
      wx.reLaunch({ url: '/pages/todos/index' })
    } catch {
      // request layer already shows toast where possible
    } finally {
      this.setData({ wechatLoading: false })
    }
  },

  async handlePasswordLogin() {
    const username = this.data.username.trim()
    const password = this.data.password
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }

    this.setData({ passwordLoading: true })
    try {
      const result = await authService.login(username, password)
      setAuth(result)
      wx.reLaunch({ url: '/pages/todos/index' })
    } catch {
      // handled by request layer
    } finally {
      this.setData({ passwordLoading: false })
    }
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/auth/join' })
  },

  goBind() {
    wx.navigateTo({ url: '/pages/auth/bind' })
  },
})
