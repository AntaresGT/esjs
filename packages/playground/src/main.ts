import { createApp } from 'vue'
import VueGtag from 'vue-gtag'
import FloatingVue from 'floating-vue'
import App from './App.vue'
import { loadFonts } from '@/plugins/webfontloader'

import '@/styles/main.css'
import '@/styles/splitpanes.css'
import 'floating-vue/dist/style.css'
import 'splitpanes/dist/splitpanes.css'
import { useShare } from '@/composables/useShare'

const app = createApp(App)

async function init() {
  await loadFonts()
  useShare().setSettingsFromUrl()
  await useShare().setCodeFromUrl()

  app
    .use(VueGtag, {
      config: {
        id: import.meta.env.VITE_GTAG_ID,
      },
    })
    .use(FloatingVue, {
      themes: {
        tooltip: {
          hideTriggers: (events: any) => [...events],
        },
      },
    })
    .mount('#app')
}

init()

