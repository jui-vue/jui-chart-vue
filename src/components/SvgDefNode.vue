<script setup lang="ts">
// Generic `{type, attr, children}` JSON-literal -> real SVG element renderer, used ONLY to render
// `useColorResolver.ts`'s registered `defs` entries (`GradientDescriptor`/`PatternDescriptor`
// shapes from `colorParser.ts`/`patternClassic.ts`) inside `ChartBase.vue`'s `<defs>`. Mirrors
// upstream's own `SVGUtil.createObject(obj)` (`dist/jui-chart.js:8788-8798`): `<component :is>` +
// `v-bind="attr"` for the element itself, recursing into `children` for nested elements (a
// `<linearGradient>`'s `<stop>` children, or a `<pattern>`'s single `<image>` child) - the same
// generic recursive shape as the source's own `el.create(obj.type, obj.attr)` +
// `obj.children.forEach(child => el.append(createObject(child)))`.
// `attr`/`children` are typed loosely on purpose: this renders BOTH `GradientDescriptor`
// (`colorParser.ts`, precisely-typed `LinearGradientAttr | RadialGradientAttr`) and
// `PatternDescriptor` (`patternClassic.ts`) trees generically via `v-bind`, which needs no
// stronger a contract than "some attribute bag" - the precise shapes are enforced at the source.
export interface DefNode {
  type: string
  attr?: object
  children?: DefNode[]
}

defineProps<{ node: DefNode }>()
</script>

<template>
  <component :is="node.type" v-bind="node.attr">
    <SvgDefNode v-for="(child, i) in node.children" :key="i" :node="child" />
  </component>
</template>
