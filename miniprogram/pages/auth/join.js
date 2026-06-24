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
    inviteCode: '',
    loading: false,
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value })
  },

  onInviteCodeInput(event) {
    this.setData({ inviteCode: event.detail.value })
  },

  async handleSubmit() {
    const username = this.data.username.trim()
    const inviteCode = this.data.inviteCode.trim()
    if (!username || !inviteCode) {
      wx.showToast({ title: '请填写用户名和邀请码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const code = await wxLoginCode()
      const result = await authService.wechatRegister(username, inviteCode, code)
      setAuth(result)
      wx.reLaunch({ url: '/pages/todos/index' })
    } catch {
      // handled by request layer
    } finally {
      this.setData({ loading: false })
    }
  },

  goBind() {
    wx.redirectTo({ url: '/pages/auth/bind' })
  },
})
