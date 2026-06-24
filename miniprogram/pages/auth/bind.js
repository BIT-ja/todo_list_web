const authService = require('../../services/auth')
const { setAuth } = require('../../utils/auth')

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
    loading: false,
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value })
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value })
  },

  async handleSubmit() {
    const username = this.data.username.trim()
    const password = this.data.password
    if (!username || !password) {
      wx.showToast({ title: '请填写用户名和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const code = await wxLoginCode()
      const result = await authService.wechatBind(username, password, code)
      setAuth(result)
      wx.reLaunch({ url: '/pages/todos/index' })
    } catch {
      // handled by request layer
    } finally {
      this.setData({ loading: false })
    }
  },

  goJoin() {
    wx.redirectTo({ url: '/pages/auth/join' })
  },
})
