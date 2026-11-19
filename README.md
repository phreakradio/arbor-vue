# arbor-vue

A Vue 3 component and graph-layout library inspired by the original Arbor.js.
It preserves the named-node/edge graph model, graft/merge/prune operations,
force-directed layout, canvas renderer, coordinate helpers, dragging, and
node/edge data tweens. Vue is a peer dependency and is not bundled.

[Try the interactive demo](https://phreakradio.github.io/arbor-vue/)

The demo offers a central hub, an interconnected network, and two branching
tree presets, inspired by the variety of graphs in the original
[Arbor demos](https://arborjs.org/). The force-directed tree moves freely;
the hierarchical tree starts with parked nodes arranged in levels. Select a
parent by tapping or clicking a node, or using the parent selector, before
adding a branch. Adding a node rearranges the hierarchical tree; dragging or
unparking a node changes its arrangement. These tree presets are demo
configurations, not a separate library layout API. The demo's
100-node limit is a demo safeguard, not a library limit. The settings scroll
independently of the graph. Drag nodes and adjust the forces to explore the
layout. Select a node from the menu or click it to change its mass, size, color,
or park it with `fixed`. A parked node can still be dragged and remains parked
where it is released. The demo also exposes edge rest length and appearance,
and advanced physics settings. Switching
between worker and main-thread simulation restarts the demo layout.

Friction controls how much velocity is damped per physics step: `0` leaves
velocity undamped, while `1` removes it completely. The demo starts at `0.5`
and resets to that value. Higher friction generally reduces oscillation.

Gravity attracts each node toward the simulation's origin; it does not attract
nodes to one another. Repulsion still pushes nearby nodes apart. Automatic
canvas scaling can make the resulting change in graph size less obvious.

## Install

```sh
npm install arbor-vue vue
```

Requires Vue 3.5 or later.

## Vue component

Register the component globally:

```js
import { createApp } from 'vue'
import ArborVuePlugin from 'arbor-vue'
import 'arbor-vue/style.css'
import App from './App.vue'

createApp(App).use(ArborVuePlugin).mount('#app')
```

Or import it locally:

```vue
<script setup>
import { ArborVue } from 'arbor-vue'
import 'arbor-vue/style.css'

const physics = { stiffness: 600, repulsion: 800, gravity: false }
const graph = {
  nodes: {
    arbor: { color: '#315b7d', label: 'Arbor', radius: 24 },
    vue: { color: '#42b883', label: 'Vue', radius: 18 }
  },
  edges: { arbor: { vue: { length: 1.5 } } }
}
</script>

<template>
  <ArborVue
    :system-parms="physics"
    :particle-parms="graph"
    :width="800"
    :height="500"
    :worker="true"
    @node-click="({ node }) => console.log(node.name)"
    @navigate="({ link }) => console.log('Navigation requested:', link)"
  />
</template>
```

`systemParms` and `particleParms` retain the names used by the initial Vue
prototype. `particleParms` uses Arbor's branch shape:

```js
{
  nodes: { nodeName: { color: 'steelblue', label: 'Node' } },
  edges: { nodeName: { otherNodeName: { length: 1.2 } } }
}
```

The graph is grafted at mount. Later deep changes to `particleParms` are
reconciled as a complete branch: absent nodes and edges are removed, retained
nodes/edges are updated, and new ones are added. Deep changes to
`systemParms` update physics parameters. Node physics attributes are `x`, `y`,
`mass`, and `fixed`; other node properties remain available in `node.data`.
The edge `length` attribute sets spring rest length; other edge fields are
available in `edge.data`.

The component emits:

* `ready(system)` after initialization;
* `node-click({ node, event, system })` after a node click;
* `navigate({ node, link, event })` when the clicked node has a `link` field.
  Navigation is emitted rather than performed automatically;
* `error(error)` for worker or runtime errors.

The component owns and destroys its `ParticleSystem`, canvas listeners,
resize observer, animation frame, and worker. `width` defaults to `100%` and
`height` defaults to `400` pixels. Pass CSS-compatible strings or numbers.
Import the stylesheet to enable touch-friendly pointer dragging. The viewport
stays fixed while a node is held, then gradually resumes fitting the graph
after release; other nodes continue responding to the forces during the drag.

## Mobile and tablet use

The canvas supports pointer-based touch: tap a node to select it or drag it
with one finger. The demo places its independently scrollable settings below
the graph on narrow screens and beside it on wider screens. Touches on the
canvas are reserved for interaction rather than page scrolling; scroll using
the settings or the area outside the graph. The renderer adjusts to canvas
resizing and uses device pixel ratio (capped at 3) for sharper rendering.

For responsive embedding, use a flexible width and give the canvas a definite
height (or a parent with a definite height when using `height="100%"`). The
fixed 800-pixel width in the example above is illustrative, not mobile-friendly.
Large or dense graphs may be harder to read or slower on smaller devices; the
worker moves physics off the main thread, but canvas drawing remains on it.
The canvas does not currently offer keyboard navigation between individual
nodes, so provide an accessible alternative when node interaction is essential.

## ParticleSystem API

The graph and simulation can also be used without the Vue component:

```js
import { ParticleSystem } from 'arbor-vue'

const system = ParticleSystem({ worker: 'auto', gravity: true })
// `new ParticleSystem({...})` is supported too.
system.addEdge('one', 'two', { length: 1.5 })
system.addNode('solo', { mass: 0.5 })
system.renderer = myRenderer // init(system) and redraw() are called by start()
system.start()

// Later:
system.stop()
system.destroy()
```

Physics options include `repulsion`, `stiffness`, `friction` (0 through 1),
`gravity`, `fps`, `dt`, `precision`, and `integrator` (`'verlet'` or
`'euler'`). Set them initially or update them with `system.parameters(...)`;
the Vue component accepts the same options through `systemParms`. Use
`system.energy()` to inspect the latest `{ sum, max, mean, n }` statistics.

`worker` may be `true`, `false`, or `'auto'` (the default). `'auto'` uses a
module Web Worker where supported and falls back to inline simulation when
workers are unavailable. The Barnes-Hut quadtree is used for repulsion once a
graph reaches 128 particles; smaller graphs use direct pair calculations.
Rendering and pointer handling stay on the main thread.
The solver automatically subdivides a physics step when spring stiffness,
node connectivity, or low node mass would otherwise make it unstable. If more
than 128 subdivisions are required, the simulation reports an error instead of
locking up the browser; reduce `dt` or stiffness, or increase node mass.
The worker is inlined into the ESM bundle; restrictive Content Security
Policies must allow data-URL workers (`worker-src data:`), or the system will
report the worker error and use inline simulation.

The API includes `addNode`, `getNode`, `pruneNode`, `addEdge`, `pruneEdge`,
`getEdges`, `getEdgesFrom`, `getEdgesTo`, `eachNode`, `eachEdge`, `graft`,
`merge`, `prune`, `parameters`, `fps`, `screen`, `screenSize`,
`screenPadding`, `screenStep`, `toScreen`, `fromScreen`, `nearest`,
`energy`, `tweenNode`, and `tweenEdge`. Node position and physics properties remain
mutable (`node.p.x`, `node.p.y`, `node.mass`, `node.fixed`, `node.tempMass`).
Changing an edge's `length` updates its spring. `Point(x, y)` and
`new Point(x, y)` are both supported. Tween options accept `easing` or the
original reference's `ease` spelling.

## Original Arbor compatibility

The original repository's core graph, simulation settings, worker, coordinate,
and tween APIs are available as ESM exports. The optional `Graphics`, `colors`,
`Tween`, and `etc` exports provide the original's canvas helper, color,
animation, and utility entry points. `Graphics` takes a canvas element rather
than a jQuery selector:

```js
import { Graphics, colors } from 'arbor-vue'

const graphics = Graphics(document.querySelector('canvas'))
graphics.fill('steelblue')
graphics.oval(10, 10, 40, 40)
console.log(colors.decode('#4682b4'))
```

The original Halfviz, Atlas, and Echolalia applications and their datasets are
examples, not part of this package. The built-in renderer is Vue-oriented and
does not recreate Halfviz's graph text editor or its arrow styling. Simulation
math and automatic viewport handling are adapted for this port rather than
being numerically identical to Arbor.js. The `etc.arbor_path()` script lookup is
for legacy script-tag integrations; ESM applications should not rely on it to
locate the inlined worker.

## Development

```sh
npm install
npm run dev
npm test
npm run lint
npm run build
npm run build:demo
```

The build produces an ES module package in `dist/`; Vite inlines the worker in
the package bundle. The package is ESM-only and Vue is externalized as a peer
dependency.

The demo is deployed separately to GitHub Pages by the `Deploy demo` workflow.
In the repository's Settings > Pages, set the build and deployment source to
**GitHub Actions**. The first successful workflow run makes the demo available
at the link above; the demo build is not included in the npm package.

## Releasing

The npm release workflow prepares a patch release when the head commit pushed
to `master` contains `#release`. It verifies the package, increments the patch
version in `package.json` and `package-lock.json`, and opens a pull request.
Review and merge that pull request to run the publish job. The job verifies
the merged commit and publishes it to npm using trusted publishing. A direct
push to `master` still requires permission to bypass its ruleset; a normal pull
request can also deliver the release request.

Before using the workflow:

1. In GitHub repository settings, under Actions > General > Workflow permissions,
   enable "Allow GitHub Actions to create and approve pull requests". This
   permits the workflow to open the version-bump pull request; it does not
   approve or merge it.
2. In the npm package settings, configure a GitHub Actions trusted publisher
   for owner `phreakradio`, repository `arbor-vue`, and workflow
   `release.yml`. Leave the environment field empty. The first trusted publish
   must succeed within the time limit described in the npm documentation.
3. Ensure the workflow is on `master` and review any outstanding security
   advisories before requesting a release.

Pull requests created using GitHub's built-in token do not automatically
trigger ordinary pull-request workflows. The release workflow therefore runs
the package checks both before creating the pull request and again after it
is merged, before publication. Review the version-bump PR before merging;
the merge initiates a public npm publish.

If preparing a release fails after its branch is pushed, remove or reuse the
existing release branch and pull request before retrying. If publication fails,
inspect the publish job and correct the reported problem before rerunning it.
A package name and version already published to npm cannot be reused.

## Credits and licensing

The graph and physics implementation follows the Arbor.js model. Third-party
copyright notices and license terms for Arbor.js, Springy.js, and Robert
Penner's easing equations are included in
[THIRD-PARTY-NOTICES](./THIRD-PARTY-NOTICES).
