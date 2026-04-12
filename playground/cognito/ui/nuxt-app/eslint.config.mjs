// @ts-check
import prettierConfig from 'eslint-config-prettier'
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    rules: {
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
    },
  },
  prettierConfig,
)
