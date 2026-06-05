<template>
  <div class="page register-page">
    <div class="register-header">
      <h2>创建账号</h2>
      <p>注册后开始使用待办事项</p>
    </div>
    <van-form @submit="handleRegister" class="register-form">
      <van-cell-group inset>
        <van-field
          v-model="username"
          name="username"
          label="用户名"
          placeholder="2-20个字符"
          :rules="[
            { required: true, message: '请输入用户名' },
            { validator: (v: string) => v.length >= 2 && v.length <= 20, message: '用户名长度应为2-20个字符' }
          ]"
        />
        <van-field
          v-model="password"
          type="password"
          name="password"
          label="密码"
          placeholder="6-32个字符"
          :rules="[
            { required: true, message: '请输入密码' },
            { validator: (v: string) => v.length >= 6 && v.length <= 32, message: '密码长度应为6-32个字符' }
          ]"
        />
        <van-field
          v-model="confirmPassword"
          type="password"
          name="confirmPassword"
          label="确认密码"
          placeholder="再次输入密码"
          :rules="[
            { required: true, message: '请确认密码' },
            { validator: (v: string) => v === password, message: '两次密码不一致' }
          ]"
        />
      </van-cell-group>
      <div class="register-actions">
        <van-button type="primary" block round native-type="submit" :loading="loading">
          注册
        </van-button>
        <van-button block round plain type="primary" @click="router.push('/login')" class="login-btn">
          已有账号，去登录
        </van-button>
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import { showToast } from 'vant'

const router = useRouter()
const userStore = useUserStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)

async function handleRegister() {
  loading.value = true
  try {
    await userStore.register(username.value, password.value)
    showToast('注册成功')
    router.replace('/')
  } catch {
    // error handled in interceptor
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.register-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 100vh;
  padding: 0 16px;
  background: #fff;
}

.register-header {
  text-align: center;
  padding: 40px 0 32px;
}

.register-header h2 {
  font-size: 28px;
  color: #323233;
}

.register-header p {
  margin-top: 8px;
  color: #969799;
  font-size: 14px;
}

.register-form {
  margin-top: 16px;
}

.register-actions {
  margin: 24px 16px 0;
}

.login-btn {
  margin-top: 12px;
}
</style>
