<script setup lang="ts">
import { onMounted, onUnmounted, ref, shallowRef } from 'vue'
import type { Phase } from '@/game/types'
import { SKINS } from '@/engine/mesh/skins'
import { createGameSession, type GameSession } from '@/ui/composables/useGameSession'
import HudBar from './HudBar.vue'

const phaseTitle: Record<Phase, string> = {
  ready: '超级马里奥 1-1',
  playing: '',
  paused: '暂停',
  dying: '',
  clear: '🎉 恭喜过关!',
  gameover: '游戏结束',
}

const canvasEl = ref<HTMLCanvasElement | null>(null)
const session = shallowRef<GameSession | null>(null)

onMounted(() => {
  if (!canvasEl.value) return
  session.value = createGameSession(canvasEl.value)
  // DEV QA:「?autoplay」跳过开始覆盖层,让 threejs-qa inspector 截到真实游玩帧
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('autoplay'))
    session.value.start()
})
onUnmounted(() => {
  session.value?.dispose()
  session.value = null
})
</script>

<template>
  <div class="game-root">
    <canvas ref="canvasEl" class="game-canvas" />
    <template v-if="session">
      <HudBar :hud="session.state.hud" />
      <div v-if="session.state.phase !== 'playing'" class="overlay">
        <h1>{{ phaseTitle[session.state.phase] }}</h1>
        <p v-if="session.state.phase === 'clear' || session.state.phase === 'gameover'" class="final-score">
          得分 {{ session.state.hud.score }} · 金币 {{ session.state.hud.coins }}
        </p>
        <button v-if="session.state.phase === 'ready'" @click="session.start()">开始</button>
        <button v-else-if="session.state.phase === 'paused'" @click="session.resume()">继续</button>
        <button v-else-if="session.state.phase === 'clear' || session.state.phase === 'gameover'" @click="session.restart()">
          {{ session.state.phase === 'clear' ? '再来一局' : '重新开始' }}
        </button>
        <div class="skin-row">
          <button
            v-for="(s, i) in SKINS"
            :key="s.id"
            class="skin-card"
            :class="{ active: session.state.skin === s.id }"
            @click="session.setSkin(s.id)"
          >
            <span class="skin-key">{{ i + 1 }}</span>{{ s.label }}
          </button>
        </div>
        <p class="hint">←→ / A D 移动 · 空格 / Z 跳(按住跳更高)· Shift 跑 · Enter / P 暂停 · R 重开 · 1-4 切换皮肤</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.game-root {
  position: fixed;
  inset: 0;
}
.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  justify-content: center;
  color: #fff;
  background: rgb(0 0 0 / 45%);
}
.overlay h1 {
  margin: 0;
  font-size: 40px;
  letter-spacing: 6px;
  text-shadow: 0 2px 8px rgb(0 0 0 / 60%);
}
.overlay button {
  padding: 10px 40px;
  font-size: 20px;
  color: #fff;
  cursor: pointer;
  background: #d43a2f;
  border: 0;
  border-radius: 8px;
}
.overlay button:hover {
  background: #e0533f;
}
/* 皮肤卡片行:.overlay button 特异度更高,须用 .overlay .skin-card 覆盖 */
.skin-row {
  display: flex;
  gap: 10px;
}
.overlay .skin-card {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px 16px;
  font-size: 15px;
  background: rgb(255 255 255 / 12%);
  border: 2px solid rgb(255 255 255 / 35%);
  border-radius: 8px;
}
.overlay .skin-card:hover {
  background: rgb(255 255 255 / 25%);
}
.overlay .skin-card.active {
  background: #d43a2f;
  border-color: #ffd24a;
}
.skin-key {
  padding: 0 6px;
  font-size: 12px;
  border-radius: 4px;
  background: rgb(0 0 0 / 40%);
}
.final-score {
  margin: 0;
  font-size: 22px;
  letter-spacing: 2px;
}
.hint {
  margin: 0;
  font-size: 14px;
  opacity: 0.85;
}
</style>
