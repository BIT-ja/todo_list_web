const { getStoredUser } = require('./utils/auth')

App({
  globalData: {
    user: null,
  },

  onLaunch() {
    this.globalData.user = getStoredUser()
  },
})
