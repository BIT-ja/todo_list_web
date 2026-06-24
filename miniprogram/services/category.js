const request = require('../utils/request')

module.exports = {
  list() {
    return request.get('/categories')
  },
  create(data) {
    return request.post('/categories', data)
  },
  update(id, data) {
    return request.patch(`/categories/${id}`, data)
  },
  remove(id) {
    return request.delete(`/categories/${id}`)
  },
}
