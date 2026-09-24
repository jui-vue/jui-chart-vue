# jui-chart-vue: `<Chart>` 단일 컴포넌트로 재설계 (jui-graph-ts 엔진을 직접 사용)

## Context

`jui-chart-vue`는 레거시 `jui-chart`(`chart("#selector", { axis, brush, widget, theme, style })` 단일 팩토리 호출) 엔진을 타입별 Vue 컴포넌트(`<BarChart>`, `<LineChart>` 등 35개+)로 재구성한 포팅 프로젝트였다. 이번 세션에서 `play/chart`의 나머지 데모를 변환하다가, 사용자가 이 구조 자체("타입마다 다른 태그를 쓰는" 구조)가 레거시와 너무 달라졌다고 지적했다. 레거시는 `chart(selector, option)` 하나로 axis 배열(퍼센트 기반 `area`/`padding` 배치, `extend`로 서로 상속), brush 배열(각각 `axis` 인덱스를 참조), widget 배열을 자유롭게 조합해 한 캔버스에 여러 축·여러 브러시·대시보드를 그릴 수 있는데, 지금 구조는 이런 조합을 데모 파일마다 수작업 오버레이(`position: absolute` 겹치기)로 흉내내고 있었다.

사용자 요청으로 `jui-chart-vue` 저장소에 `jui-chart-import` 브랜치를 새로 만들고, 그 브랜치 전체를 원본 `juijs/jui-chart` npm 패키지 소스로 덮어써서 커밋했다(`df0969b`). 이 브랜치를 기반으로 Vue 3 전환 계획을 새로 세우는 것이 이번 작업이다.

조사 결과, `jui-chart`(브러시/위젯/테마 46+15+4개, 순수 설정 데이터)는 코어 엔진이 없고 전부 별도 npm 패키지 `juijs-graph`에 의존한다. 그리고 `juijs-graph`의 **완전한 TypeScript 포팅판이 이미 `/home/jiho/juijs-vue/jui-graph-ts`에 존재**한다 — `Builder`/`Axis`/`CoreGrid`/`CoreBrush`/`CoreWidget`와 axis 타입 전부(block/range/date/dateblock/log/radar/panel/grid3d/fullblock/draw2d/draw3d/overlap/rule/table)가 실제 ES 클래스로, 유닛 테스트와 함께 포팅되어 있다. 단, `chart.brush.bar`/`chart.widget.title` 같은 **구체 타입은 아직 하나도 등록되어 있지 않다** — `registerBrush(type, ctor)`/`registerWidget(type, ctor)`/`registerTheme(name, style)`/`registerIcon(type, icons)`라는 외부 확장용 함수만 존재하고 "아직 아무도 호출하지 않음"이라고 주석에 명시되어 있다.

사용자는 (1) `jui-graph-ts`를 **수정하지 않고** 그대로 의존성으로 쓰면서, (2) `<Chart>` 하나로 레거시와 동일한 조합 능력(다중 axis, 다중 brush, area/padding 배치)을 살리되, (3) Vue 쪽에는 `options` 하나로 다 밀어넣지 않고 axis/brush/widget 등을 **개별 prop**으로 받는 컴포넌트를 원한다. 즉 "`jui-graph-ts`의 완성된 엔진을 적극적으로(그대로) 활용"하는 방향으로 확정됐다 — 외부에서 `registerBrush`/`registerWidget`/`registerTheme`를 호출해 타입들을 등록하기만 하면 되므로, `jui-graph-ts` 자체는 한 글자도 고칠 필요가 없다.

## 아키텍처

### `<Chart>` 컴포넌트 (신규, 유일한 공개 진입점)

```vue
<Chart
  :width="600" :height="400" :padding="10"
  :axis="[{ x: {...}, y: {...}, area: {...}, padding: {...}, extend: 0, data: [...] }, ...]"
  :brush="[{ type: 'area', target: [...], axis: 0 }, ...]"
  :widget="[{ type: 'title', text: '...', axis: 0 }, ...]"
  theme="classic"
  :style="{ axisBorderColor: '#dcdcdc', ... }"
/>
```

- props는 axis/brush/widget/theme/style/width/height/padding을 **개별로** 받는다 (레거시 `option` 객체를 그대로 감싼 단일 blob이 아님 — Vue 쪽 타이핑/자동완성을 살리기 위함).
- `<script setup>` 내부에서 이 props를 `computed`로 다시 `{ width, height, padding, axis, brush, widget, theme, style }` 형태의 순수 객체로 조립한다 — `jui-graph-ts`의 `Builder`가 원래 기대하는 옵션 모양 그대로.
- **렌더링은 Vue 템플릿이 아니라 `jui-graph-ts`의 실제 `Builder` 클래스가 수행한다** (imperative, DOM 직접 조작):
  ```ts
  const rootEl = ref<HTMLDivElement>()
  let builder: Builder | null = null

  onMounted(() => {
    builder = new Builder(rootEl.value!, assembledOptions.value)
    builder.render()
  })
  watch(assembledOptions, (opts) => {
    builder?.reload(opts)
    builder?.render(true)
  }, { deep: true })
  onUnmounted(() => builder?.destroy?.())
  ```
  (`Builder`의 정확한 생성자 시그니처와 `destroy` 유무는 `base/builder.ts` 전체 + `base/builder.spec.ts`를 1단계에서 직접 읽어 확정한다 — 지금까지 확인한 건 `reload(options)`/`render(isAll?)` 메서드가 존재한다는 것.)
- `<Chart>`의 `<template>`은 사실상 `<div ref="rootEl" />` 하나뿐이다. 다중 axis의 퍼센트 기반 `area`/`padding` 배치, `extend` 상속, brush/widget의 `axis` 인덱스 참조는 전부 `Builder`/`Axis` 내부(`calculatePanel()`, `axis.extend` 처리 등 - 이미 `jui-graph-ts`에 포팅 완료 확인함)가 알아서 처리하므로 Vue 쪽에서 별도 레이아웃 로직이 필요 없다.

### 구체 브러시/위젯/테마 등록 (신규 작업, `jui-graph-ts` 비수정)

- `jui-chart-vue`(이 저장소) 안에 `src/register/brush/*.ts`, `src/register/widget/*.ts`, `src/register/theme/*.ts` 형태로 새로 작성한다.
- 각 브러시 파일은 `jui-graph-ts`가 export하는 `CoreBrush`를 상속하는 클래스를 정의하고 `registerBrush('bar', BarBrush)`를 모듈 로드 시 부작용으로 호출한다:
  ```ts
  import { CoreBrush, registerBrush } from 'jui-graph-ts'

  class BarBrush extends CoreBrush {
    draw = () => { /* this.axis/this.brush/this.chart/this.svg 사용 */ }
  }
  registerBrush('bar', BarBrush)
  ```
  위젯도 `CoreWidget`을 상속하는 동일 패턴(`isRender()` 오버라이드 등).
- 각 파일의 실제 지오메트리 로직은 **지금 이 브랜치의 워킹 트리에 있는 원본 `src/brush/*.js`/`src/widget/*.js`/`src/theme/*.js`(레거시 jui-chart 소스, 46+15+4개)를 그대로 포팅 소스로 삼는다** — `this.chart.svg.*` 같은 legacy SVG 빌더 호출을 `jui-graph-ts`가 제공하는 동일한 `this.svg`/`this.chart.svg` API로 옮기기만 하면 된다(같은 계보라 API 형태가 거의 동일할 것으로 예상 - 1단계에서 `util/svg.ts` 확인).
- **`main` 브랜치(git 히스토리)에 남아있는 기존 Vue 포팅 작업(806개 테스트)의 수학/지오메트리 로직도 재사용 가능한 참고 자료다** — 예: `useCylinder3d.ts`/`useGauge.ts`/`usePie.ts`/`usePyramid.ts` 등은 이번 세션에 레거시 소스를 직접 읽어 검증한 공식들이라, `draw()` 메서드 안의 순수 계산 부분을 그대로 옮겨 쓰면 처음부터 다시 유도할 필요가 없다. 다만 렌더링 대상이 Vue 템플릿이 아니라 `this.svg.*` 명령형 호출로 바뀐다는 점만 다르다.
- 테마 4개(`classic`/`dark`/`gradient`/`pattern`)는 `src/theme/*.js`의 flat 설정 객체를 거의 그대로 `registerTheme(name, obj)`에 넘기면 된다 — `main`의 `useTheme.ts`에 이미 타입까지 정리된 동일 데이터가 있으니 대조용으로 쓴다.

### 패키지 배치

새 등록 코드와 `<Chart>` 컴포넌트는 **이 저장소(`jui-chart-vue`) 안에 그대로 둔다** (별도 `jui-chart-ts` 패키지로 분리하지 않음 - 필요해지면 나중에 쉽게 추출 가능). `package.json`은 `main` 브랜치가 이미 썼던 것과 동일하게 `"jui-graph-ts": "file:../jui-graph-ts"`로 링크한다.

## 단계별 진행

1. **기반 다지기**: `base/builder.ts`/`base/axis.ts`/`brush/core.ts`/`widget/core.ts`와 각각의 `.spec.ts`(실사용 예시)를 정독해 `Builder` 생성자 시그니처, `this.svg` API 모양, `CoreBrush`/`CoreWidget`가 요구하는 정확한 계약을 확정한다. `<Chart>` 컴포넌트 뼈대 작성 + `bar`/`column`/`line`/`area`/`pie` 5개 브러시, `title`/`tooltip`/`legend` 3개 위젯, `classic` 테마만 등록해서 최소 동작을 만든다. `brush_colors.js`처럼 이미 다뤘던 데모 몇 개를 `<Chart>` 호출로 다시 써서 Playwright로 레거시와 비교 검증한다(이번 세션 내내 써온 방식 그대로).
2. **폭 넓히기**: 나머지 브러시/위젯을 계열별로(bar 계열, line/area 계열, pie/gauge 계열, 3D 계열, canvas 계열 등) 배치 포팅한다. `main`의 기존 지오메트리 코드를 참고자료로 적극 재사용.
3. **데모 전면 전환**: `www.jui-vue.io/play/chart/json/*.js` 161개 전부를 `<Chart :axis :brush :widget>` 호출로 재작성한다 — 이번 세션에서 썼던 수많은 우회(도메인 함수 트릭, `min:0` 패치, 콤보 차트 수동 오버레이)가 대부분 필요 없어진다(엔진이 로그축/날짜축/다중축/다중브러시를 네이티브로 처리). 143개 전체에 대해 이번 세션에 만든 Playwright 일괄 검증 스크립트를 다시 돌려 회귀를 확인한다.

## 검증

- 각 브러시/위젯 등록 후 `@vue/test-utils`로 `<Chart>`를 마운트해 렌더링된 DOM(실제 `Builder`가 만든 SVG 트리)을 어서션하는 방식으로 유닛 테스트를 작성한다(jsdom에서 `Builder`가 실제 DOM API로 동작하는지 1단계에서 먼저 확인).
- 데모 단위 검증은 지금까지처럼 Playwright로 `http://localhost:8090/play/chart/?p=<code>`를 열어 에러 박스 유무 + 렌더 결과를 확인하고, 필요하면 `chartplay.jui.io`의 실제 레거시 페이지와 직접 비교한다.
