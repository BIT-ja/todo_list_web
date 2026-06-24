const request = require('../utils/request')

module.exports = {
  login(username, password) {
    return request.post('/auth/login', { username, password })
  },
  wechatLogin(code) {
    return request.post('/auth/wechat-login', { code })
  },
  wechatRegister(username, inviteCode, code) {
    return request.post('/auth/wechat-register', { username, inviteCode, code })
  },
  wechatBind(username, password, code) {
    return request.post('/auth/wechat-bind', { username, password, code })
  },
  getMe() {
    return request.get('/auth/me')
  },
}
