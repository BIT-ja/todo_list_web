const request = require('../utils/request')

module.exports = {
  list(params) {
    return request.get('/todos', params)
  },
  get(id) {
    return request.get(`/todos/${id}`)
  },
  create(data) {
    return request.post('/todos', data)
  },
  update(id, data) {
    return request.patch(`/todos/${id}`, data)
  },
  complete(id) {
    return request.post(`/todos/${id}/complete`)
  },
  uncomplete(id) {
    return request.post(`/todos/${id}/uncomplete`)
  },
  remove(id) {
    return request.delete(`/todos/${id}`)
  },
  pin(id) {
    return request.post(`/todos/${id}/pin`)
  },
  unpin(id) {
    return request.post(`/todos/${id}/unpin`)
  },
  urgent(id) {
    return request.post(`/todos/${id}/urgent`)
  },
  unurgent(id) {
    return request.post(`/todos/${id}/unurgent`)
  },
  comments(id) {
    return request.get(`/todos/${id}/comments`)
  },
  addComment(id, content) {
    return request.post(`/todos/${id}/comments`, { content })
  },
  deleteComment(id, commentId) {
    return request.delete(`/todos/${id}/comments/${commentId}`)
  },
}
