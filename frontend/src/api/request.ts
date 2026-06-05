import axios from 'axios'
import { getToken, removeToken } from '../utils/token'
import { showToast } from 'vant'
import router from '../router'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

request.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

request.interceptors.response.use(
  (response) => {
    const { code, message, data } = response.data
    if (code === 0) {
      return data
    }
    showToast(message || '请求失败')
    return Promise.reject(new Error(message))
  },
  (error) => {
    if (error.response?.status === 401) {
      removeToken()
      router.push('/login')
      showToast('登录已过期，请重新登录')
    } else {
      const msg = error.response?.data?.message || '网络异常'
      showToast(msg)
    }
    return Promise.reject(error)
  },
)

export default request
