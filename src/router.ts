import { createRouter, createWebHistory } from 'vue-router'
import WorkflowEditor from '@/components/workflow-editor.vue'

const flowId = 'workflow-editor'

const router = createRouter({
  history: createWebHistory(),
  routes: [
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

export default router
