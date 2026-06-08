import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as loginApi, register as registerApi, getMe } from '../api/auth'
import { setToken, getToken, removeToken } from '../utils/token'

export const useUserStore = defineStore('user', () => {
  const userId = ref<number | null>(null)
  const username = ref<string | null>(null)
  const organizationId = ref<number | null>(null)
  const organizationName = ref<string | null>(null)
  const isLoggedIn = ref(!!getToken())

  async function login(user: string, password: string) {
    const res = await loginApi(user, password)
    setToken(res.token)
    userId.value = res.user.id
    username.value = res.user.username
    organizationId.value = res.user.organization.id
    organizationName.value = res.user.organization.name
    isLoggedIn.value = true
  }

  async function register(user: string, password: string, inviteCode: string) {
    const res = await registerApi(user, password, inviteCode)
    setToken(res.token)
    userId.value = res.user.id
    username.value = res.user.username
    organizationId.value = res.user.organization.id
    organizationName.value = res.user.organization.name
    isLoggedIn.value = true
  }

  async function fetchUser() {
    if (!getToken()) return
    try {
      const user = await getMe()
      userId.value = user.id
      username.value = user.username
      organizationId.value = user.organization.id
      organizationName.value = user.organization.name
      isLoggedIn.value = true
    } catch {
      logout()
    }
  }

  function logout() {
    removeToken()
    userId.value = null
    username.value = null
    organizationId.value = null
    organizationName.value = null
    isLoggedIn.value = false
  }

  return {
    userId,
    username,
    organizationId,
    organizationName,
    isLoggedIn,
    login,
    register,
    fetchUser,
    logout,
  }
})
