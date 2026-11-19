# arbor-vue

A Vue 3 component for interactive, force-directed graphs. Define nodes and
edges, adjust the physics, and let users drag nodes on a canvas.

[Try the interactive demo](https://phreakradio.github.io/arbor-vue/)

Try hub, network, and tree examples in the demo. The tree layouts and 100-node
limit apply to the demo, not the library.

## How it works

A **node** represents an item. An **edge** connects a source node to a target
node and behaves like a spring. The simulation moves nodes in response to
repulsion, springs, friction, and optional gravity; the renderer draws the
result on a canvas. Edge direction identifies the source and target for graph
operations; the built-in renderer draws a line without an arrow.

Positions and spring lengths use **simulation coordinates**, not pixels. The
canvas automatically fits the graph, so a change in simulation distance may not
produce the same change in apparent screen distance.

## Install

```sh
npm install arbor-vue vue
```

Requires Vue 3.5 or later.

## Vue component

Import the component and stylesheet:

```vue
<script setup>
import { ArborVue } from 'arbor-vue'
import 'arbor-vue/style.css'
import { reactive } from 'vue'

const physics = reactive({ stiffness: 600, repulsion: 800, gravity: false })
const graph = reactive({
  nodes: {
    arbor: { color: '#315b7d', label: 'Arbor', radius: 24 },
    vue: { color: '#42b883', label: 'Vue', radius: 18 }
  },
  edges: { arbor: { vue: { length: 1.5 } } }
})

function onNodeClick({ node }) {
  console.log(node.name)
}
</script>

<template>
  <ArborVue
    :system-parms="physics"
    :particle-parms="graph"
    :height="500"
    @node-click="onNodeClick"
  />
</template>
```

To register it globally instead:

```js
import { createApp } from 'vue'
import ArborVuePlugin from 'arbor-vue'
import 'arbor-vue/style.css'
import App from './App.vue'

createApp(App).use(ArborVuePlugin).mount('#app')
```

## Defining and updating a graph

Pass `particleParms` (written `particle-parms` in a Vue template) an object
with named nodes and edges. In `edges`, the outer key is the source and the
inner key is the target:

```js
{
  nodes: {
    root: { label: 'Root', fixed: true, x: 0, y: 0 },
    child: { label: 'Child', color: '#42b883' }
  },
  edges: { root: { child: { length: 1.2 } } }
}
```

Keep the graph reactive to add, edit, or remove items:

```js
graph.nodes.docs = { label: 'Docs', color: '#d97646', radius: 20 }
graph.edges.arbor.docs = { length: 2, color: '#888', width: 2 }

// Remove the connection and node.
delete graph.edges.arbor.docs
delete graph.nodes.docs
```

The component treats the updated object as the **complete graph**, not a
partial patch: missing nodes and edges are removed. Include both endpoints in
`nodes` when updating an edge. Existing positions are retained if `x` and `y`
are omitted.

### Node properties

The appearance defaults below apply when no corresponding `renderer-options`
override is supplied.

| Property | Default | Description |
| --- | --- | --- |
| `x`, `y` | Random initial position | Position in simulation coordinates. Set both for a predictable initial location. |
| `mass` | `1` | Positive number. Heavier nodes generally accelerate less in response to forces. |
| `fixed` | `false` | Parks the node at its simulation position. It can still be dragged and stays fixed at the new position. Auto-fitting can change its screen position. |
| `label` | No text | Text drawn in the center of the node. |
| `radius` | `6` | Radius in canvas pixels for a dot; also sets the minimum width of other shapes. |
| `color` | `#526f91` | Canvas fill color. |
| `labelColor` | `#fff` | Label text color. |
| `shape` | `'dot'` | `'dot'` draws a circle; other values draw a rounded rectangle. |
| `height` | `24` | Rectangle height in canvas pixels; ignored for dots. |
| `alpha` | `1` | Opacity from `0` (hidden) to `1` (opaque). |
| `link` | None | A truthy value triggers the `navigate` event when the node is clicked; navigation is not automatic. |
| `image` | None | Image URL drawn over the node; `image_w` and `image_h` set its size in pixels (each defaults to twice the radius). |

Custom properties can also be supplied and are available through `node.data`
in event handlers. Physics properties are on `node.p`, `node.mass`, and
`node.fixed`. If you supply `x` or `y` in reactive graph data, subsequent graph
updates reapply those coordinates; omit them after initialization if the
simulation or dragging should control the node's position.

### Edge properties

Appearance defaults can also be overridden through `renderer-options`.

| Property | Default | Description |
| --- | --- | --- |
| `length` | `1` | Positive spring rest length in simulation units. Springs pull nodes together when farther apart and push them apart when closer. |
| `color` | `#888` | Canvas line color. |
| `width` | `1` | Line width in canvas pixels. |
| `alpha` | Lower endpoint opacity | Line opacity from `0` to `1`. A hidden endpoint hides the edge. |

Other edge fields are available as `edge.data`. The renderer does not draw
arrowheads or edge labels.

## Component options and events

| Prop | Default | Description |
| --- | --- | --- |
| `particle-parms` | Empty graph | Graph data described above; deep changes are reconciled. |
| `system-parms` | Default physics | Simulation settings described below; deep changes update the simulation. |
| `width` | `'100%'` | Canvas width as pixels (number) or a CSS size string. |
| `height` | `400` | Canvas height as pixels (number) or a CSS size string. |
| `worker` | `'auto'` | `false` runs physics on the main thread; `true` or `'auto'` requests a worker when available. Set this prop rather than `system-parms.worker`. Changing the prop after mounting does not switch the running simulation; remount to change it. |
| `aria-label` | `'Force-directed graph'` | Accessible label for the canvas. |
| `renderer-options` | `{}` | Default styles and image resolution options listed below. |

`renderer-options` supports `background`, `nodeColor`, `nodeRadius`,
`edgeColor`, `edgeWidth`, and `font` (a canvas font string). Per-node and
per-edge values override the corresponding defaults. `resolveImage(url, node)`
can return the URL to load for a node's `image`. Configure these options before
mounting; changes to the object are not watched.

The component emits:

* `ready(system)`: initialized `ParticleSystem` instance.
* `node-click({ node, event, system })`: clicked node, pointer event, and system.
* `navigate({ node, link, event })`: emitted for a clicked node with a `link`;
  your app decides whether and how to navigate.
* `error(error)`: worker or simulation error. Handle it to notify users.

For example, handle node metadata and errors:

```vue
<ArborVue
  :particle-parms="graph"
  @node-click="({ node }) => console.log(node.name, node.data)"
  @error="(error) => console.error('Graph error:', error)"
/>
```

The component cleans up its simulation and listeners when unmounted. The
viewport stays fixed while a node is dragged, then resumes fitting the graph.

## Mobile and tablet use

The canvas supports pointer-based touch: tap a node to emit `node-click` or
drag it with one finger. The demo places its independently scrollable settings below
the graph on narrow screens and beside it on wider screens. Touches on the
canvas are reserved for interaction rather than page scrolling; scroll using
the settings or the area outside the graph. The renderer adjusts to canvas
resizing and uses device pixel ratio (capped at 3) for sharper rendering.

For responsive embedding, use a flexible width and give the canvas a definite
height (or a parent with a definite height when using `height="100%"`).
Large or dense graphs may be harder to read or slower on smaller devices; the
worker moves physics off the main thread, but canvas drawing remains on it.
The canvas does not currently offer keyboard navigation between individual
nodes, so provide an accessible alternative when node interaction is essential.

## ParticleSystem API

The graph and simulation can also be used without the Vue component:

```js
import { ParticleSystem } from 'arbor-vue'

const system = ParticleSystem({ worker: 'auto', gravity: true })
system.addEdge('one', 'two', { length: 1.5 })
system.addNode('solo', { mass: 0.5 })
// Supply a renderer with init(system) and redraw() methods.
system.renderer = myRenderer
system.start()

// Later:
system.stop()
system.destroy()
```

`ParticleSystem` can also be constructed with `new`. Use `addNode` / `addEdge`
to add or update items, `getNode` / `getEdges` to look them up, and
`pruneNode` / `pruneEdge` to remove them. `graft` adds or updates a graph
branch; `merge` replaces the graph with the supplied branch. Use `parameters`
to update physics, and `energy()` to inspect `{ sum, max, mean, n }`.
`destroy()` stops the simulation and releases its worker and renderer.

## Physics settings

Pass these as `system-parms` to the component, or to `ParticleSystem()` /
`system.parameters()`:

| Setting | Default | Description |
| --- | --- | --- |
| `repulsion` | `1000` | Strength of the force pushing nodes apart. Higher values spread nodes out; `0` disables repulsion. |
| `stiffness` | `600` | Strength of the springs along edges. Higher values pull connected nodes toward their rest length more strongly; `0` disables spring forces. |
| `friction` | `0.5` | Velocity damping per physics step, from `0` to `1`. Higher values generally reduce oscillation; `1` removes velocity each step. |
| `gravity` | `false` | Pulls each node toward the simulation origin, not toward other nodes. Its strength depends on `repulsion`. |
| `fps` | `50` | Target physics updates per second, not a guarantee of render frame rate. Must be positive; values below `1` are clamped to `1`. |
| `dt` | `0.02` | Simulated time advanced per physics update. Smaller values can improve stability; values below `0.001` are clamped to `0.001`. |
| `precision` | `0.6` | Barnes–Hut repulsion accuracy, clamped to `0–1`. Higher values generally trade speed for accuracy. Applies only at 128 or more nodes. |
| `integrator` | `'verlet'` | Integration method: `'verlet'` or `'euler'`. It changes how forces update positions and velocities. |

For example, update a reactive settings object at runtime:

```js
physics.repulsion = 1200
physics.friction = 0.7
physics.gravity = true
```

`targetFps` is an alias for `fps`; `timeout` is an alternative interval in
milliseconds (`fps = 1000 / timeout`). If supplied together, `fps` takes
precedence.

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

The low-level API also provides coordinate conversion (`toScreen`,
`fromScreen`), graph traversal (`eachNode`, `eachEdge`), and animation
(`tweenNode`, `tweenEdge`). TypeScript declarations are included.

## Credits and licensing

The graph and physics implementation follows the Arbor.js model. Third-party
copyright notices and license terms for Arbor.js, Springy.js, and Robert
Penner's easing equations are included in
[THIRD-PARTY-NOTICES](./THIRD-PARTY-NOTICES).
