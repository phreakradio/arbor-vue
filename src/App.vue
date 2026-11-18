<template>
  <main class="demo">
    <header>
      <p class="eyebrow">
        ARBOR VUE / INTERACTIVE DEMO
      </p>
      <h1>Explore a living graph.</h1>
      <p>Drag the nodes, add a few more, or adjust the forces that hold the graph together.</p>
    </header>

    <section
      class="workspace"
      aria-label="Interactive graph demo"
    >
      <div class="graph">
        <ArborVue
          :system-parms="system"
          :particle-parms="graph"
          :worker="true"
          height="100%"
          aria-label="Interactive graph. Drag a node to move it."
          @error="onError"
        />
      </div>
      <aside class="controls">
        <h2>Make it your own</h2>
        <label for="repulsion">Repulsion <output>{{ system.repulsion }}</output></label>
        <input
          id="repulsion"
          v-model.number="system.repulsion"
          type="range"
          min="100"
          max="2000"
          step="50"
        >
        <label for="stiffness">Spring stiffness <output>{{ system.stiffness }}</output></label>
        <input
          id="stiffness"
          v-model.number="system.stiffness"
          type="range"
          min="100"
          max="1500"
          step="50"
        >
        <label class="checkbox"><input
          v-model="system.gravity"
          type="checkbox"
        > Enable gravity</label>
        <button
          type="button"
          :disabled="nodeCount >= 25"
          @click="addNode"
        >
          Add a node
        </button>
        <button
          type="button"
          class="secondary"
          @click="reset"
        >
          Reset graph
        </button>
        <p>{{ nodeCount }} nodes <span aria-hidden="true">·</span> up to 25</p>
        <p
          v-if="error"
          class="error"
          role="status"
        >
          {{ error }}
        </p>
      </aside>
    </section>
    <footer><a href="https://github.com/phreakradio/arbor-vue">View source on GitHub</a></footer>
  </main>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { ArborVue } from './index.js';

const colors = ['#d97646', '#486bb0', '#729e77', '#b57a9d', '#dbad4d', '#638a9a'];
const initialNames = ['Vue', 'Arbor', 'Canvas', 'Physics', 'Worker', 'Graph'];
const system = reactive({ repulsion: 700, stiffness: 700, gravity: false, dt: 0.015, precision: 0.7 });
const graph = reactive({ nodes: {}, edges: {} });
const nodeCount = ref(0);
const error = ref('');

function reset() {
    const nodes = { center: { color: '#253450', radius: 32, label: 'arbor-vue' } };
    const edges = { center: {} };
    initialNames.forEach((name, index) => {
        nodes[name] = { color: colors[index], radius: 25, label: name };
        edges.center[name] = {};
    });
    graph.nodes = nodes;
    graph.edges = edges;
    nodeCount.value = initialNames.length + 1;
    Object.assign(system, { repulsion: 700, stiffness: 700, gravity: false });
    error.value = '';
}

function addNode() {
    if (nodeCount.value >= 25) return;
    const name = `Node ${nodeCount.value}`;
    graph.nodes[name] = { color: colors[nodeCount.value % colors.length], radius: 25, label: name };
    graph.edges.center[name] = {};
    nodeCount.value++;
}

function onError(value) {
    console.error(value);
    error.value = `Simulation warning: ${value.message || String(value)}`;
}

reset();
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; background: #f3f5f8; color: #23304a; font-family: system-ui, sans-serif; }
.demo { max-width: 1200px; margin: auto; padding: 48px 24px; }
header { margin-bottom: 30px; }
.eyebrow { color: #486bb0; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.14em; }
h1 { margin: 8px 0; font-size: clamp(2rem, 5vw, 3.2rem); letter-spacing: -0.04em; }
header p:last-child { color: #66748a; }
.workspace { display: grid; grid-template-columns: minmax(0, 1fr) 270px; overflow: hidden; background: white; border: 1px solid #dfe5ed; border-radius: 16px; }
.graph { height: 550px; min-width: 0; background: #fbfcfe; }
.controls { padding: 24px; border-left: 1px solid #e6ebf1; }
.controls h2 { margin: 0 0 24px; font-size: 1.1rem; }
.controls label:not(.checkbox) { display: flex; justify-content: space-between; margin: 20px 0 8px; font-size: 0.88rem; font-weight: 600; }
output, .controls p { color: #68758a; font-size: 0.82rem; }
input[type="range"] { width: 100%; accent-color: #486bb0; }
.checkbox { display: flex; gap: 8px; align-items: center; margin: 24px 0; font-size: 0.88rem; }
button { width: 100%; padding: 11px; border: 1px solid #486bb0; border-radius: 8px; background: #486bb0; color: white; font: inherit; cursor: pointer; }
button.secondary { margin-top: 10px; background: white; color: #486bb0; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
.error { color: #a52c2c !important; }
footer { margin-top: 22px; font-size: 0.9rem; }
a { color: #486bb0; }
@media (max-width: 700px) {
    .demo { padding: 24px 16px; }
    .workspace { grid-template-columns: 1fr; }
    .graph { height: 400px; }
    .controls { border-top: 1px solid #e6ebf1; border-left: 0; }
}
</style>
