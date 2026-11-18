# Arbor to Vue port status

## Executive summary

This repository is an attempted Vue 2/ES-module port of the original
`arbor.js` graph visualization library. The port retains most of Arbor's
physics and graph-model code, and adds a Vue component whose intended job is
to own a canvas and expose a graph through props. It is not yet a working
drop-in port:

* the component does not correctly attach the renderer to the particle
  system's run loop;
* the renderer and graphics layer still depend on jQuery and old Arbor globals;
* the worker entry point is not valid module syntax and is not wired to the
  Vue build;
* several physics/system and rendering regressions remain;
* tests cover only empty color-test shells, and the configured test command
  does not find them.

The practical goal should be to preserve Arbor's graph and physics API while
making rendering, lifecycle, workers, and browser events Vue-native. A full
rewrite of the physics algorithm is not necessary for the first usable port.

## What the original Arbor package does

The original package is a small graph visualization toolkit, not a component
framework. Its responsibilities are:

1. **Graph organization** – `ParticleSystem` owns named `Node` and `Edge`
   objects, adjacency lookups, graft/merge/prune operations, and callbacks for
   iterating nodes and edges.
2. **Force-directed layout** – each node becomes a physics particle and each
   edge becomes a spring. Repulsion can use brute force or a Barnes-Hut
   quadtree; springs, friction, gravity, and either Verlet or Euler integration
   advance the simulation.
3. **Coordinate conversion** – the system calculates bounds and maps physics
   coordinates to a screen rectangle using padding and a scaling step.
4. **Run-loop coordination** – `Kernel` batches graph changes, runs physics
   either inline or in a Web Worker, transfers geometry back to the main
   thread, and asks a renderer to redraw.
5. **Rendering contract** – Arbor deliberately leaves visual design to a
   renderer. A renderer supplies `init(system)` and `redraw()`, and uses
   `eachNode`/`eachEdge` to receive screen-space points.
6. **Optional animation** – `arbor-tween.js` adds interpolation of node and
   edge data, including numeric values and colors.

The historical API is documented in the deleted `docs/reference.html` file in
the repository history. The historical sample renderer in
`docs/sample-project/main.js` demonstrates the intended lifecycle:

```js
const sys = arbor.ParticleSystem(1000, 600, 0.5)
sys.renderer = Renderer(canvas)
sys.addEdge('a', 'b')
```

The system calls `renderer.init(sys)` before drawing. The renderer does not
create a second system and does not need to start a separate animation loop.

## What this repository contains

### Public Vue surface

[`src/components/ArborVue.vue`](/Users/dmitri/Development/arbor-vue/src/components/ArborVue.vue)
renders a `<canvas>` and accepts two props:

* `systemParms` – physics parameters such as `stiffness`, `repulsion`,
  `gravity`, and `dt`;
* `particleParms` – an Arbor graft-shaped object with `nodes` and `edges`.

Its computed `sys` constructs a `ParticleSystem`, applies the parameters, and
grafts the graph. The example in
[`src/App.vue`](/Users/dmitri/Development/arbor-vue/src/App.vue) supplies a
central node and six continent nodes and edges, so this is intended to be a
declarative graph demo rather than a wrapper around an existing Arbor system.

### Ported layers

* [`src/services/physics/atoms.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/atoms.js)
  contains `Node`, `Edge`, `Particle`, `Spring`, and `Point`.
* [`src/services/physics/physics.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/physics.js)
  contains the force simulation and integrators.
* [`src/services/physics/barnes-hut.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/barnes-hut.js)
  contains the quadtree repulsion approximation.
* [`src/services/physics/system.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/system.js)
  contains the graph API, synchronization queue, bounds, screen conversion,
  nearest-node lookup, and tween entry points.
* [`src/services/kernel.js`](/Users/dmitri/Development/arbor-vue/src/services/kernel.js)
  contains the worker/inline run-loop abstraction.
* [`src/services/renderer.js`](/Users/dmitri/Development/arbor-vue/src/services/renderer.js)
  attempts to provide Arbor's canvas renderer and mouse dragging behavior.
* [`src/services/graphics/`](/Users/dmitri/Development/arbor-vue/src/services/graphics)
  contains canvas helpers, primitives, and color conversion.
* [`src/services/tween/`](/Users/dmitri/Development/arbor-vue/src/services/tween)
  contains easing and data interpolation.

The implementation is therefore structurally close to Arbor, but the
boundaries between those layers have not been completed.

## Outstanding work

### P0: make the component lifecycle functional

[`ArborVue.vue`](/Users/dmitri/Development/arbor-vue/src/components/ArborVue.vue)
currently does:

```js
this.sys.renderer = new Renderer(this.$refs.arborViewport)
this.sys.renderer.init()
```

The renderer's `init` expects a particle system, and the system/kernel expects
to discover the renderer and invoke `init(system)` itself. Calling `init()`
without an argument leaves `particleSystem` unset. Fix this by:

1. constructing one system instance during component creation/mount, not by
   repeatedly relying on a computed object;
2. assigning a renderer to that instance;
3. allowing the kernel to attach it, or explicitly calling
   `renderer.init(system)` exactly once if the lifecycle is deliberately
   kept outside the kernel;
4. starting the system after the renderer and initial graft are ready;
5. stopping the system and terminating any worker in `beforeDestroy`.

The component also needs a canvas resize strategy. `screenSize` currently
uses the canvas's intrinsic dimensions, but the component only sets CSS
dimensions. Set the backing canvas size from its displayed dimensions (with
device-pixel-ratio handling if desired), then update `system.screenSize` when
the container changes.

### P0: remove jQuery and undeclared globals from the browser path

The following code cannot run as an ES-module Vue application:

* [`graphics.js`](/Users/dmitri/Development/arbor-vue/src/services/graphics/graphics.js)
  calls `$`, `$(canvas)`, `.attr`, and `get(0)`;
* [`primitives.js`](/Users/dmitri/Development/arbor-vue/src/services/graphics/primitives.js)
  uses `$` and assigns `ox`, `oy`, `xe`, `ye`, `xm`, and `ym` without
  declarations;
* [`renderer.js`](/Users/dmitri/Development/arbor-vue/src/services/renderer.js)
  calls `canvas.offset`, `bind`, `unbind`, `mousemove`, and references
  undeclared `sys` and `dom`.

Use the native canvas element and `getBoundingClientRect()` instead. Register
listeners with `addEventListener`, retain handler references, and remove them
in a renderer `destroy()` method. Pass the particle system into the renderer
or store it as `particleSystem`; do not use a global `sys`. Replace the
graphics helper's DOM attribute calls with `canvas.width` and `canvas.height`.

### P0: repair the worker/module boundary

[`worker.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/worker.js)
contains `import * from 'atoms.js'`, which is invalid syntax, and uses
extensionless/non-relative imports that do not match the other source files.
The kernel also relies on the old `arbor_path()` global and constructs a
worker from a string path.

Choose one explicit strategy:

* **Inline first (recommended for the initial port):** disable workers,
  complete and test the inline kernel, then add a separately bundled worker.
* **Bundled worker:** use the project’s bundler worker mechanism and create a
  worker entry module with valid imports. Keep the message protocol
  (`physics`, `changes`, `modify`, `sys`, `start`, `stop`) stable.

Do not silently fall back from a worker error. Surface worker startup/runtime
errors and clean them up when the component is destroyed.

### P1: preserve and correct the graph API

The intended API in
[`system.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/system.js)
is `addNode`, `pruneNode`, `getNode`, `addEdge`, `pruneEdge`, `getEdges`,
`getEdgesFrom`, `getEdgesTo`, `eachNode`, `eachEdge`, `graft`, `merge`,
`prune`, `parameters`, `screen`, `screenSize`, `screenPadding`, `toScreen`,
`fromScreen`, `nearest`, `tweenNode`, and `tweenEdge`.

Verify each against the original reference before changing semantics. Known
issues to address:

* `toScreen` returns `arbor.Point`, but no `arbor` global exists; return the
  imported `Point`.
* `screenPadding` assigns `trbl` without declaring it and can therefore write
  a browser global.
* `getNode` dereferences `nodeOrName._id` before guarding an undefined input.
* `pruneNode`, `pruneEdge`, and `dropNode`/`dropSpring` need safe handling of
  missing objects and correct array-index checks.
* `graft` starts the kernel while the graph is still being assembled and
  assumes `state.kernel` is ready; batch the changes and start once.
* Vue prop updates currently do not update an existing system. Decide whether
  props are immutable after mount or implement a watcher that uses
  `merge`/`graft` and updates parameters.

### P1: fix physics correctness before optimizing

The physics code is recognizable as Arbor, but it needs regression tests and
several suspicious translations should be checked:

* [`physics.js`](/Users/dmitri/Development/arbor-vue/src/services/physics/physics.js)
  uses `includes(dropping, particles)` where an index lookup is required;
* center-drift calls `centroid.add(point.p)` without assigning the returned
  immutable `Point`;
* the Verlet path divides by `point._m` even when no temporary mass exists;
* the velocity speed-limit branch divides by `speed * speed`, which does not
  produce a max speed of `SPEED_LIMIT`;
* `systemEnergy()` can return undefined before the first tick;
* Barnes-Hut needs tests for coincident points, empty trees, and bounds.

First write deterministic tests for one node, two connected nodes, fixed
nodes, node/edge removal, and screen conversion. Then fix only behavior that
differs from the original contract.

### P1: finish the renderer and graphics API

The renderer currently draws edges and nodes conceptually, including color,
alpha, shape, label, and image data, but it mixes old sample-specific
behavior with library behavior:

* `switchSection` is application-specific and should not be part of the
  generic renderer;
* `nodeBoxes[node.name]` is collected but never exposed or used;
* image paths are hard-coded to `./js/graphics/`;
* mouse behavior assumes jQuery and old global variables;
* `ctx.measureText` is used before setting a font;
* `parseInt(undefined)` yields `NaN` for nodes without a radius.

Define renderer options for background, node/edge styling, image URL
resolution, and interaction callbacks. Keep the default renderer small and
make application-specific navigation a Vue event or a caller-provided
callback.

### P2: make tweening reliable and optional

The tween implementation in
[`tween.js`](/Users/dmitri/Development/arbor-vue/src/services/tween/tween.js)
has been copied into the main bundle, unlike the original optional
`arbor-tween.js`. It should either be a guaranteed dependency of the system or
be explicitly disabled when unavailable. Its queue uses object keys but checks
`.length`, so `busy()` and pruning do not reliably reflect active tweens.
Add tests for numeric, string, color, delay, easing, and queued replacement
behavior.

### P2: establish package and test boundaries

[`package.json`](/Users/dmitri/Development/arbor-vue/package.json) exposes a
Vue app build, but the library entry point is inconsistent with
`src/components/index.js`, which imports `./Arbor.vue` even though the
component is named `ArborVue.vue`, and the registration loop uses `name`
without defining it. Decide the public export (`ArborVue` component,
`ParticleSystem`, or both), correct the entry point, and document usage.

The configured `npm test` command runs `mocha` against the default `test`
directory, while the repository tests are under `tests/unit`. Replace it with
a test command that explicitly includes the real test paths. Expand coverage
to the graph, physics, coordinate, renderer, worker protocol, colors, and
tween layers.

## Recommended implementation order

1. Make the component own one system, pass the system into the renderer, and
   stop it on destruction.
2. Finish the inline kernel path and remove all jQuery/global references from
   graphics and pointer handling.
3. Correct the ES-module exports/imports and public package entry point.
4. Add graph and physics regression tests, then fix the identified correctness
   defects.
5. Make props reactive through explicit `watch` handlers or document them as
   mount-time-only inputs.
6. Add a native, bundled worker only after inline behavior is green; test both
   execution modes with the same message fixtures.
7. Add renderer options/events, tween tests, examples, and API documentation.

## Definition of done

The port is ready for normal use when:

* `npm run lint`, `npm test`, and `npm run build` pass on a supported Node
  version;
* mounting the component with the example graph produces a continuously
  settling canvas without console errors;
* adding, updating, and removing nodes/edges works after mount;
* resizing the component keeps coordinates and hit testing correct;
* dragging a node fixes it during the drag and releases it afterward;
* inline and worker modes produce equivalent graph geometry within a defined
  tolerance;
* destroying and remounting the component leaves no active timer, listener,
  or worker;
* the public API and supported prop/update semantics are documented.

## Validation notes from this checkout

At the time this document was written:

* `npm test` fails before running tests because Mocha looks for `test`, not
  `tests/unit`.
* `npm run build` initially fails under the installed Node/OpenSSL combination
  with `ERR_OSSL_EVP_UNSUPPORTED`. With the legacy OpenSSL provider enabled,
  compilation reaches the source and reports errors in `primitives.js` and
  `renderer.js`.
* `npm run lint` reports the same undeclared globals plus unused/incomplete
  graphics code.

These are porting blockers, not changes made by this documentation task.
