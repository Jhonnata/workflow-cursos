import { createRouter, createWebHashHistory } from 'vue-router'
import WorkflowEditor from '@/components/workflow-editor.vue'
import LoginPage from '@/components/login-page.vue'
import { isLoggedIn } from '@/lib/auth'

const flowId = 'workflow-editor'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginPage,
      meta: { public: true },
    },
    {
      path: '/',
      name: 'home',
      component: WorkflowEditor,
      props: { flowId },
    },
    {
      path: '/workflow/:id',
      name: 'workflow',
      component: WorkflowEditor,
      props: (route) => ({
        flowId,
        workflowId: route.params.id,
        initialTab: 'workflow',
      }),
    },
    {
      path: '/workflow/:id/apprentices',
      name: 'workflow-apprentices',
      component: WorkflowEditor,
      props: (route) => ({
        flowId,
        workflowId: route.params.id,
        initialTab: 'evolution',
      }),
    },
  ],
})

router.beforeEach((to) => {
  const loggedIn = isLoggedIn()
  if (to.meta?.public) {
    if (loggedIn && to.name === 'login') {
      return { name: 'home' }
    }
    return true
  }

  if (!loggedIn) {
    return { name: 'login', query: { next: to.fullPath } }
  }

  return true
})

export default router
