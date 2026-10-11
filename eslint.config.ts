import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginVitest from '@vitest/eslint-plugin'
import pluginOxlint from 'eslint-plugin-oxlint'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx}'],
  },

  globalIgnores(['**/dist/**', '**/dist-ssr/**', '**/coverage/**']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*'],
  },

  // ── 三层架构硬边界(DESIGN §5.1 / §13,第一天锁死)──────────────────
  {
    name: 'app/game-pure-logic',
    files: ['src/game/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/addons/**', '@threejs/**'],
              message: 'game/ 是纯玩法真相层,禁止 import three(DESIGN §5.1)',
            },
            {
              group: ['vue', 'vue/**', '@vue/**'],
              message: 'game/ 禁止依赖 Vue:引擎→UI 只发离散事件(DESIGN §5.1 规则 2/3)',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'app/engine-no-vue',
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['vue', 'vue/**', '@vue/**'],
              message: 'engine/ 禁止依赖 Vue,渲染层保持独立可测试(DESIGN §5.1)',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'app/ui-no-three',
    files: ['src/ui/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/addons/**', '@threejs/**'],
              message: 'UI 壳层不得直接触碰渲染器,一律经 engine 公共入口(DESIGN §5.1)',
            },
          ],
        },
      ],
    },
  },

  ...pluginOxlint.buildFromOxlintConfigFile('.oxlintrc.json'),
)
