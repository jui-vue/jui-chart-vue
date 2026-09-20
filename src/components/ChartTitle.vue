<script setup lang="ts">
// Ported from `chart.widget.title`: a static text label positioned relative to the chart.
// Simplified to take an explicit (x, y) rather than the original's orient/align + axis lookup -
// the caller (a page, or a chart component's #overlay slot) computes that from its own `area`.
withDefaults(
  defineProps<{
    text: string
    x: number
    y: number
    align?: 'start' | 'middle' | 'end'
    color?: string
    size?: number
    weight?: string
  }>(),
  {
    align: 'middle',
    color: '#333',
    size: 13,
    weight: 'normal',
  },
)
</script>

<template>
  <text :x="x" :y="y" :text-anchor="align" :fill="color" :font-size="size" :font-weight="weight">{{ text }}</text>
</template>
