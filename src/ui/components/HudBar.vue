<script setup lang="ts">
import type { HudSnapshot } from '@/game/types'

defineProps<{ hud: HudSnapshot }>()

const MARIO_LABEL: Record<HudSnapshot['mario'], string> = {
  small: 'SMALL',
  super: 'SUPER',
  fire: 'FIRE',
}
</script>

<template>
  <header class="hud">
    <div class="cell">
      <b>SCORE</b><span>{{ String(hud.score).padStart(6, '0') }}</span>
    </div>
    <div class="cell">
      <b>COINS</b><span>×{{ String(hud.coins).padStart(2, '0') }}</span>
    </div>
    <div class="cell">
      <b>WORLD</b><span>1-1</span>
    </div>
    <div class="cell">
      <b>TIME</b><span>{{ String(hud.time).padStart(3, '0') }}</span>
    </div>
    <div class="cell">
      <b>LIVES</b><span>×{{ hud.lives }}</span>
    </div>
    <div class="cell">
      <b>MARIO</b><span>{{ MARIO_LABEL[hud.mario] }}</span>
    </div>
  </header>
</template>

<style scoped>
.hud {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  display: flex;
  gap: 32px;
  padding: 12px 24px;
  font:
    700 16px/1.4 'Segoe UI',
    system-ui,
    sans-serif;
  color: #fff;
  text-shadow: 0 1px 3px rgb(0 0 0 / 70%);
  pointer-events: none;
  user-select: none;
}
.cell {
  display: flex;
  flex-direction: column;
}
.cell b {
  font-size: 12px;
  letter-spacing: 2px;
  opacity: 0.85;
}
</style>
