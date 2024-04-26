import { useEventBus } from '@vueuse/core/index'
import { Options } from 'prettier'
import parserBabel from 'prettier/parser-babel'
import prettier from 'prettier/standalone'
import { ref, watch } from 'vue'
import { compileCode } from '@es-js/sandbox/utils'

export const loading = ref(true)

const language = ref('esjs')

const version = ref('0.0.1')

const availableLanguages = [
  [
    {
      label: 'EsJS',
      click: () => {
        language.value = 'esjs'
      },
    },
    {
      label: 'JavaScript',
      click: () => {
        language.value = 'js'
      },
    },
  ],
]

const availableVersions = [
  [
    {
      label: 'v0.0.1 (Actual)',
      click: () => {
        version.value = '0.0.1'
      },
    },
    {
      label: 'v0.1.0 (Próxima)',
      click: () => {
        version.value = '0.1.0'
      },
    },
  ],
]

watch(
  language,
  () => {
    useEventBus('editor_code').emit('change-language', language.value)
    useEventBus('editor_tests').emit('change-language', language.value)
  },
  { immediate: true },
)

const isLearnApp = computed(() => {
  const subdomain = useCookie('subdomain')
  return subdomain.value === 'aprender'
})

const EDITOR_DEFAULT_OPTIONS = {
  automaticLayout: true,
  fontFamily: 'Fira Code',
  fontSize: 16,
  renderWhitespace: 'all',
  roundedSelection: true,
  glyphMargin: true,
  lineNumbersMinChars: 2,
}

export const useEditor = () => {
  function setLanguage(value: 'esjs' | 'js') {
    language.value = value
  }

  function getLanguageExtension() {
    return language.value === 'esjs' ? '.esjs' : '.js'
  }

  function formatCode(code: string, fromLanguage: string = 'esjs', toLanguage: string = 'esjs') {
    const compiledCode = fromLanguage === 'esjs' ? compileCode(code) : code

    const formattedCode = formatWithPrettier(compiledCode)

    return toLanguage === 'esjs'
      ? compileCode(formattedCode, {
        from: 'js',
        to: 'esjs',
      })
      : formattedCode
  }

  function formatWithPrettier(code: string, options?: Partial<Options>) {
    return prettier.format(code, {
      parser: 'babel',
      plugins: [parserBabel],
      semi: false,
      ...options,
    })
  }

  return {
    loading,
    setLanguage,
    getLanguageExtension,
    language,
    availableLanguages,
    version,
    availableVersions,
    formatCode,
    isLearnApp,
    EDITOR_DEFAULT_OPTIONS,
  }
}
