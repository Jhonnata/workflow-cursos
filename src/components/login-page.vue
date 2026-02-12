<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { API_BASE_URL } from '@/lib/config'
import { setAuth } from '@/lib/auth'

const router = useRouter()
const route = useRoute()

const form = reactive({
  email: '',
  password: '',
})

const errorMessage = ref('')
const isLoading = ref(false)

const canSubmit = computed(() => Boolean(form.email && form.password && !isLoading.value))

function extractAuthPayload(payload: any) {
  const candidates = [
    payload,
    payload?.data,
    payload?.data?.data,
    payload?.token,
    payload?.auth,
    payload?.payload,
  ]

  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue
    const token =
      item.access_token ||
      item.token ||
      item.accessToken ||
      item.jwt ||
      item?.session?.access_token ||
      item?.session?.token
    if (token) {
      const type =
        item.token_type ||
        item.type ||
        item.tokenType ||
        item?.session?.token_type ||
        item?.session?.type ||
        'Bearer'
      return { token: String(token), type: String(type) }
    }
  }
  return null
}

async function handleSubmit() {
  errorMessage.value = ''
  if (!form.email || !form.password) {
    errorMessage.value = 'Preencha email e senha para continuar.'
    return
  }

  isLoading.value = true
  try {
    const res = await fetch(`${API_BASE_URL}/authentication/employee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: form.email,
        login: form.email,
        username: form.email,
        password: form.password,
      }),
    })

    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message =
        (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
        'Falha ao autenticar. Verifique suas credenciais.'
      throw new Error(message)
    }

    const auth = extractAuthPayload(payload)
    if (!auth) {
      throw new Error('Resposta de login sem token.')
    }

    setAuth(auth.token, auth.type)
    const nextPath = typeof route.query.next === 'string' ? route.query.next : '/'
    await router.replace(nextPath || '/')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Erro inesperado ao autenticar.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-glow login-glow-one"></div>
    <div class="login-glow login-glow-two"></div>
    <div class="login-grid"></div>

    <div class="login-shell">
      <section class="login-panel">
        <div class="login-brand">
          <span class="login-kicker">workflow cursos</span>
          <h1 class="login-title">Controle o ritmo da sua operacao.</h1>
          <p class="login-subtitle">
            Autentique sua equipe para editar fluxos, gerenciar turmas e acompanhar o progresso.
          </p>
        </div>

        <div class="login-highlights">
          <div class="login-highlight">
            <p class="login-highlight-title">Fluxos vivos</p>
            <p class="login-highlight-copy">Visualize cada passo com contexto e acao imediata.</p>
          </div>
          <div class="login-highlight">
            <p class="login-highlight-title">Equipe sincronizada</p>
            <p class="login-highlight-copy">Acesse somente com credenciais ativas do time.</p>
          </div>
        </div>
      </section>

      <section class="login-card">
        <div class="login-card-header">
          <p class="login-card-kicker">Acesso restrito</p>
          <h2 class="login-card-title">Entrar</h2>
          <p class="login-card-subtitle">Use seu email corporativo para continuar.</p>
        </div>

        <form class="login-form" @submit.prevent="handleSubmit">
          <label class="login-field">
            <span>Email</span>
            <input
              v-model="form.email"
              type="email"
              name="email"
              autocomplete="email"
              placeholder="voce@empresa.com"
              class="login-input"
              :disabled="isLoading"
            />
          </label>

          <label class="login-field">
            <span>Senha</span>
            <input
              v-model="form.password"
              type="password"
              name="password"
              autocomplete="current-password"
              placeholder="Sua senha"
              class="login-input"
              :disabled="isLoading"
            />
          </label>

          <p v-if="errorMessage" class="login-error">{{ errorMessage }}</p>

          <button type="submit" class="login-button" :disabled="!canSubmit">
            <span v-if="isLoading">Autenticando...</span>
            <span v-else>Entrar</span>
          </button>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Playfair+Display:wght@600&display=swap');

.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  color: #0f1b2b;
  background: radial-gradient(circle at top left, #f9f2d8, #f2f6fb 45%, #d9e3f4 100%);
  font-family: 'Space Grotesk', sans-serif;
}

.login-shell {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 2.5rem;
  padding: 4.5rem clamp(1.5rem, 4vw, 4.5rem);
  max-width: 1100px;
  margin: 0 auto;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  align-items: center;
}

.login-grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(15, 27, 43, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(15, 27, 43, 0.05) 1px, transparent 1px);
  background-size: 48px 48px;
  opacity: 0.5;
}

.login-glow {
  position: absolute;
  width: 340px;
  height: 340px;
  border-radius: 999px;
  filter: blur(40px);
  opacity: 0.55;
  animation: float 9s ease-in-out infinite;
}

.login-glow-one {
  background: #ffb971;
  top: -80px;
  right: -80px;
}

.login-glow-two {
  background: #5bb2e4;
  bottom: -120px;
  left: -120px;
  animation-delay: 1.5s;
}

.login-panel {
  display: grid;
  gap: 1.5rem;
  animation: fadeInUp 0.8s ease both;
}

.login-brand {
  display: grid;
  gap: 1rem;
}

.login-kicker {
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-size: 0.75rem;
  color: #1b2d4d;
}

.login-title {
  font-family: 'Playfair Display', serif;
  font-size: clamp(2rem, 3vw, 2.75rem);
  line-height: 1.1;
}

.login-subtitle {
  font-size: 1.05rem;
  color: #3b4b66;
}

.login-highlights {
  display: grid;
  gap: 1rem;
}

.login-highlight {
  background: rgba(255, 255, 255, 0.75);
  border: 1px solid rgba(17, 32, 56, 0.08);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  box-shadow: 0 10px 30px rgba(25, 41, 62, 0.08);
  animation: fadeInUp 0.9s ease both;
}

.login-highlight:nth-child(2) {
  animation-delay: 0.12s;
}

.login-highlight-title {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.35rem;
}

.login-highlight-copy {
  font-size: 0.95rem;
  color: #4c5e7c;
}

.login-card {
  background: rgba(255, 255, 255, 0.92);
  border-radius: 1.5rem;
  border: 1px solid rgba(17, 32, 56, 0.08);
  padding: 2.5rem;
  box-shadow: 0 24px 60px rgba(16, 26, 43, 0.15);
  animation: fadeInUp 0.8s ease both;
  animation-delay: 0.1s;
}

.login-card-header {
  display: grid;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.login-card-kicker {
  text-transform: uppercase;
  letter-spacing: 0.25em;
  font-size: 0.7rem;
  color: #2b415f;
}

.login-card-title {
  font-size: 1.6rem;
  font-weight: 600;
}

.login-card-subtitle {
  color: #4c5e7c;
}

.login-form {
  display: grid;
  gap: 1.2rem;
}

.login-field {
  display: grid;
  gap: 0.4rem;
  font-size: 0.95rem;
  color: #2a3c57;
}

.login-input {
  border-radius: 0.9rem;
  border: 1px solid rgba(20, 35, 55, 0.15);
  padding: 0.85rem 1rem;
  background: #f7f9fc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.login-input:focus {
  outline: none;
  border-color: #1d71b8;
  box-shadow: 0 0 0 3px rgba(29, 113, 184, 0.2);
}

.login-error {
  font-size: 0.9rem;
  color: #b13127;
  background: rgba(177, 49, 39, 0.1);
  padding: 0.75rem 1rem;
  border-radius: 0.75rem;
}

.login-button {
  border-radius: 999px;
  padding: 0.95rem 1rem;
  background: linear-gradient(120deg, #1d71b8, #2d4b7a);
  color: #fff;
  font-weight: 600;
  letter-spacing: 0.01em;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  box-shadow: 0 18px 35px rgba(30, 77, 134, 0.2);
}

.login-button:hover:enabled {
  transform: translateY(-1px);
  box-shadow: 0 22px 40px rgba(30, 77, 134, 0.28);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(16px);
  }
}

@media (max-width: 720px) {
  .login-shell {
    padding-top: 3.5rem;
    padding-bottom: 3.5rem;
  }

  .login-card {
    padding: 2rem;
  }
}
</style>
