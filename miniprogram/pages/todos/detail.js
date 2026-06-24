const todoService = require('../../services/todo')
const { requireAuth, getStoredUser } = require('../../utils/auth')
const { getDueMeta, formatDateTime } = require('../../utils/time')
const { getIconOption } = require('../../utils/icon')
const { openLocation } = require('../../utils/location')

const PRIORITY_LABELS = ['无', '普通', '重要', '紧急']

Page({
  data: {
    id: null,
    todo: {},
    locations: [],
    contentLinks: [],
    comments: [],
    commentText: '',
    loading: true,
    commentSaving: false,
  },

  onLoad(options) {
    if (!requireAuth()) return
    this.setData({ id: Number(options.id) })
  },

  onShow() {
    if (!requireAuth()) return
    this.fetchAll()
  },

  async fetchAll() {
    this.setData({ loading: true })
    await Promise.all([this.fetchTodo(), this.fetchComments()])
    this.setData({ loading: false })
  },

  async fetchTodo() {
    try {
      const todo = await todoService.get(this.data.id)
      const due = getDueMeta(todo.due_at)
      const icon = getIconOption(todo.category_icon)
      const locations = this.getLocations(todo)
      this.setData({
        todo: {
          ...todo,
          priorityLabel: PRIORITY_LABELS[todo.priority] || '无',
          dueLabel: due.label,
          dueLevel: due.level,
          categoryGlyph: icon.glyph,
        },
        locations,
        contentLinks: this.extractUrls(todo.content || ''),
      })
    } catch {
      wx.showToast({ title: '待办不存在', icon: 'none' })
      wx.navigateBack()
    }
  },

  getLocations(todo) {
    if (Array.isArray(todo.locations) && todo.locations.length) {
      return todo.locations
    }
    if (todo.location) {
      return [{ name: todo.location, lat: todo.location_lat, lng: todo.location_lng }]
    }
    return []
  },

  async fetchComments() {
    try {
      const user = getStoredUser() || {}
      const comments = await todoService.comments(this.data.id)
      this.setData({
        comments: (comments || []).map((comment) => ({
          ...comment,
          isMine: Number(comment.user_id) === Number(user.id),
          avatar: String(comment.username || '?').trim().charAt(0).toUpperCase() || '?',
          createdLabel: formatDateTime(comment.created_at),
        })),
      })
    } catch {
      // handled by request layer
    }
  },

  extractUrls(text) {
    return Array.from(new Set(String(text).match(/https?:\/\/[^\s]+/g) || []))
  },

  copyLink(event) {
    const link = event.currentTarget.dataset.link
    wx.setClipboardData({ data: link })
  },

  openNavigation(event) {
    const index = Number(event.currentTarget.dataset.index)
    openLocation(this.data.locations[index])
  },

  goEdit() {
    wx.navigateTo({ url: `/pages/todos/form?id=${this.data.id}` })
  },

  async toggleComplete() {
    try {
      if (this.data.todo.status === 'active') {
        await todoService.complete(this.data.id)
        wx.showToast({ title: '已完成', icon: 'success' })
      } else {
        await todoService.uncomplete(this.data.id)
        wx.showToast({ title: '已恢复', icon: 'success' })
      }
      this.fetchTodo()
    } catch {
      // handled by request layer
    }
  },

  async togglePin() {
    try {
      if (this.data.todo.is_pinned) await todoService.unpin(this.data.id)
      else await todoService.pin(this.data.id)
      wx.showToast({ title: this.data.todo.is_pinned ? '已取消置顶' : '已置顶', icon: 'success' })
      this.fetchTodo()
    } catch {
      // handled by request layer
    }
  },

  async toggleUrgent() {
    try {
      if (this.data.todo.is_urgent) await todoService.unurgent(this.data.id)
      else await todoService.urgent(this.data.id)
      wx.showToast({ title: this.data.todo.is_urgent ? '已取消加急' : '已加急', icon: 'success' })
      this.fetchTodo()
    } catch {
      // handled by request layer
    }
  },

  onCommentInput(event) {
    this.setData({ commentText: event.detail.value })
  },

  async submitComment() {
    const content = this.data.commentText.trim()
    if (!content) {
      wx.showToast({ title: '请输入评论', icon: 'none' })
      return
    }

    this.setData({ commentSaving: true })
    try {
      await todoService.addComment(this.data.id, content)
      this.setData({ commentText: '' })
      wx.showToast({ title: '已评论', icon: 'success' })
      this.fetchComments()
    } catch {
      // handled by request layer
    } finally {
      this.setData({ commentSaving: false })
    }
  },
})
