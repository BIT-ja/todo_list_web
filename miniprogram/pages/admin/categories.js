const authService = require('../../services/auth')
const categoryService = require('../../services/category')
const { requireAuth, getStoredUser, setStoredUser } = require('../../utils/auth')
const { ICON_OPTIONS, getIconOption } = require('../../utils/icon')

const colorOptions = ['#ff976a', '#9c6ade', '#07c160', '#1989fa', '#00b8d9', '#ee0a24', '#7d8da6']

Page({
  data: {
    ready: false,
    user: {},
    categories: [],
    iconOptions: ICON_OPTIONS,
    colorOptions,
    iconIndex: ICON_OPTIONS.length - 1,
    editingId: null,
    saving: false,
    form: {
      name: '',
      icon: 'sparkles',
      color: '#7d8da6',
    },
  },

  async onLoad() {
    if (!requireAuth()) return
    await this.loadUser()
    if (this.data.user.is_admin) {
      await this.fetchCategories()
    }
    this.setData({ ready: true })
  },

  async loadUser() {
    let user = getStoredUser() || {}
    try {
      user = await authService.getMe()
      setStoredUser(user)
    } catch {
      // handled by request layer
    }
    this.setData({ user })
  },

  async fetchCategories() {
    try {
      const categories = await categoryService.list()
      this.setData({
        categories: categories.map((category) => ({
          ...category,
          glyph: getIconOption(category.icon).glyph,
        })),
      })
    } catch {
      // handled by request layer
    }
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: event.detail.value })
  },

  onIconChange(event) {
    const iconIndex = Number(event.detail.value)
    const icon = this.data.iconOptions[iconIndex]?.value || 'sparkles'
    this.setData({ iconIndex, 'form.icon': icon })
  },

  chooseColor(event) {
    this.setData({ 'form.color': event.currentTarget.dataset.color })
  },

  editCategory(event) {
    const id = Number(event.currentTarget.dataset.id)
    const category = this.data.categories.find((item) => item.id === id)
    if (!category) return
    const iconIndex = Math.max(0, this.data.iconOptions.findIndex((item) => item.value === category.icon))
    this.setData({
      editingId: id,
      iconIndex,
      form: {
        name: category.name,
        icon: category.icon,
        color: category.color,
      },
    })
  },

  cancelEdit() {
    this.setData({
      editingId: null,
      iconIndex: this.data.iconOptions.length - 1,
      form: { name: '', icon: 'sparkles', color: '#7d8da6' },
    })
  },

  async saveCategory() {
    const name = this.data.form.name.trim()
    if (!name) {
      wx.showToast({ title: '请输入分类名称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      if (this.data.editingId) {
        await categoryService.update(this.data.editingId, { ...this.data.form, name })
        wx.showToast({ title: '已保存', icon: 'success' })
      } else {
        await categoryService.create({ ...this.data.form, name })
        wx.showToast({ title: '已新增', icon: 'success' })
      }
      this.cancelEdit()
      this.fetchCategories()
    } catch {
      // handled by request layer
    } finally {
      this.setData({ saving: false })
    }
  },

  deleteCategory(event) {
    const id = Number(event.currentTarget.dataset.id)
    const category = this.data.categories.find((item) => item.id === id)
    if (!category) return
    wx.showModal({
      title: '删除分类',
      content: `删除「${category.name}」不会删除待办，相关待办会迁移到“其他”或清空分类。确定删除吗？`,
      confirmColor: '#ee0a24',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await categoryService.remove(id)
          wx.showToast({ title: '已删除', icon: 'success' })
          this.fetchCategories()
        } catch {
          // handled by request layer
        }
      },
    })
  },
})
