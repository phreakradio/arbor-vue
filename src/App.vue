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
          ref="graphView"
          :key="worker"
          :system-parms="system"
          :particle-parms="graph"
          :worker="worker"
          height="100%"
          aria-label="Interactive graph. Drag a node to move it."
          @error="onError"
          @node-click="selectNode"
          @ready="onReady"
        />
      </div>
      <aside
        class="controls"
        aria-label="Graph settings"
        tabindex="0"
      >
        <p
          v-if="error"
          class="error"
          role="status"
        >
          {{ error }}
        </p>
        <section aria-label="Graph controls">
          <label for="preset">Graph layout</label>
          <select
            id="preset"
            v-model="preset"
            @change="reset"
          >
            <option value="star">
              Central hub
            </option>
            <option value="network">
              Connected network
            </option>
            <option value="tree">
              Force-directed tree
            </option>
            <option value="hierarchy">
              Hierarchical tree
            </option>
          </select>
          <p>{{ presetDescription }}</p>
          <template v-if="isTree">
            <label for="parent">Parent for new nodes</label>
            <select
              id="parent"
              v-model="selectedNodeName"
            >
              <option
                v-for="name in nodeNames"
                :key="name"
                :value="name"
              >
                {{ name === 'center' ? 'arbor-vue (root)' : name }}
              </option>
            </select>
            <p v-if="preset === 'hierarchy'">
              Nodes start parked. Adding a node rearranges the tree; dragging or un-parking a node changes the layout.
            </p>
          </template>
          <button
            type="button"
            :disabled="nodeCount >= maxNodes"
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
          <p>{{ nodeCount }} nodes <span aria-hidden="true">·</span> demo limit {{ maxNodes }}</p>
        </section>
        <section aria-label="Force controls">
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
          <label for="friction">Friction <output>{{ Math.round(system.friction * 100) }}%</output></label>
          <input
            id="friction"
            v-model.number="system.friction"
            type="range"
            min="0"
            max="1"
            step="0.05"
          >
          <label class="checkbox"><input
            v-model="system.gravity"
            type="checkbox"
          > Enable gravity</label>
          <p>Friction damps movement. Gravity pulls nodes toward the origin, not toward each other; auto-fitting can make the effect subtle.</p>
        </section>
        <details>
          <summary>Advanced simulation settings</summary>
          <label for="precision">Barnes-Hut precision <output>{{ system.precision.toFixed(2) }}</output></label>
          <input
            id="precision"
            v-model.number="system.precision"
            type="range"
            min="0"
            max="1"
            step="0.05"
          >
          <p>Used for graphs of 128 nodes or more; the demo is limited to 100.</p>
          <label for="timestep">Time step <output>{{ system.dt.toFixed(3) }}</output></label>
          <input
            id="timestep"
            v-model.number="system.dt"
            type="range"
            min="0.005"
            max="0.03"
            step="0.005"
          >
          <label for="fps">Physics ticks per second <output>{{ system.fps }}</output></label>
          <input
            id="fps"
            v-model.number="system.fps"
            type="range"
            min="10"
            max="60"
            step="5"
          >
          <label for="integrator">Integrator</label>
          <select
            id="integrator"
            v-model="system.integrator"
          >
            <option value="verlet">
              Verlet
            </option>
            <option value="euler">
              Euler
            </option>
          </select>
          <label for="worker">Simulation thread</label>
          <select
            id="worker"
            v-model="worker"
          >
            <option :value="true">
              Worker
            </option>
            <option :value="false">
              Main thread
            </option>
          </select>
          <p>Changing the simulation thread restarts the layout.</p>
        </details>
        <details
          ref="nodeSettings"
          open
        >
          <summary>Node properties</summary>
          <label for="node">Selected node</label>
          <select
            id="node"
            v-model="selectedNodeName"
          >
            <option
              v-for="name in nodeNames"
              :key="name"
              :value="name"
            >
              {{ name === 'center' ? (isTree ? 'arbor-vue (root)' : 'arbor-vue (hub)') : name }}
            </option>
          </select>
          <template v-if="selectedNode">
            <label class="checkbox"><input
              v-model="selectedNode.fixed"
              type="checkbox"
            > Park selected node</label>
            <label for="mass">Mass <output>{{ selectedNode.mass.toFixed(1) }}</output></label>
            <input
              id="mass"
              v-model.number="selectedNode.mass"
              type="range"
              min="0.5"
              max="5"
              step="0.5"
            >
            <label for="radius">Radius <output>{{ selectedNode.radius }}</output></label>
            <input
              id="radius"
              v-model.number="selectedNode.radius"
              type="range"
              min="10"
              max="45"
              step="1"
            >
            <label for="node-color">Node color</label>
            <input
              id="node-color"
              v-model="selectedNode.color"
              type="color"
            >
          </template>
          <p>Click a node to select it. A parked node can still be dragged; auto-fitting can change its screen position.</p>
        </details>
        <details>
          <summary>Edge properties</summary>
          <label for="edge">Selected edge</label>
          <select
            id="edge"
            v-model="selectedEdgeKey"
          >
            <option
              v-for="edge in edgeChoices"
              :key="edge.key"
              :value="edge.key"
            >
              {{ edge.source }} → {{ edge.target }}
            </option>
          </select>
          <template v-if="selectedEdge">
            <label for="edge-length">Rest length <output>{{ selectedEdge.length.toFixed(1) }}</output></label>
            <input
              id="edge-length"
              v-model.number="selectedEdge.length"
              type="range"
              min="0.5"
              max="5"
              step="0.1"
            >
            <label for="edge-width">Line width <output>{{ selectedEdge.width }}</output></label>
            <input
              id="edge-width"
              v-model.number="selectedEdge.width"
              type="range"
              min="1"
              max="8"
              step="1"
            >
            <label for="edge-color">Edge color</label>
            <input
              id="edge-color"
              v-model="selectedEdge.color"
              type="color"
            >
            <p>Rest length controls the spring; line width and color change its appearance.</p>
          </template>
        </details>
      </aside>
    </section>
    <footer><a href="https://github.com/phreakradio/arbor-vue">View source on GitHub</a></footer>
  </main>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue';
import { ArborVue } from './index.js';
import { treePositions } from './demo/tree-layout.js';

const colors = ['#d97646', '#486bb0', '#729e77', '#b57a9d', '#dbad4d', '#638a9a'];
const initialNames = ['Vue', 'Arbor', 'Canvas', 'Physics', 'Worker', 'Graph'];
const maxNodes = 100;
const preset = ref('star');
const graphView = ref(null);
const nodeSettings = ref(null);
const worker = ref(true);
const defaults = { repulsion: 700, stiffness: 700, friction: 0.5, gravity: false, dt: 0.015, precision: 0.7, fps: 50, integrator: 'verlet' };
const system = reactive({ ...defaults });
const graph = reactive({ nodes: {}, edges: {} });
const nodeCount = ref(0);
const error = ref('');
const selectedNodeName = ref('center');
const selectedEdgeKey = ref('');
const nodeNames = computed(() => Object.keys(graph.nodes));
const isTree = computed(() => preset.value === 'tree' || preset.value === 'hierarchy');
const presetDescription = computed(() => ({
    star: 'A central hub connects to each node.',
    network: 'Nodes form a network of interconnected paths.',
    tree: 'A root branches into a freely moving tree.',
    hierarchy: 'A parked tree is arranged in levels from the root.'
})[preset.value]);
const selectedNode = computed(() => graph.nodes[selectedNodeName.value]);
const edgeChoices = computed(() => Object.entries(graph.edges).flatMap(([source, targets]) =>
    Object.keys(targets).map((target) => ({ source, target, key: JSON.stringify([source, target]) }))));
const selectedEdge = computed(() => {
    const choice = edgeChoices.value.find((edge) => edge.key === selectedEdgeKey.value);
    return choice ? graph.edges[choice.source][choice.target] : null;
});

function nodeData(color, radius, label) {
    return { color, radius, label, mass: 1, fixed: false };
}

function edgeData() {
    return { length: 1, width: 1, color: '#888888' };
}

function selectNode({ node }) {
    selectedNodeName.value = node.name;
    if (nodeSettings.value) nodeSettings.value.open = true;
}

function positionHierarchy(particleSystem) {
    if (preset.value !== 'hierarchy' || !particleSystem) return;
    const positions = treePositions('center', graph.edges);
    for (const [name, position] of Object.entries(positions)) {
        const node = particleSystem.getNode(name);
        if (node) node.p = position;
    }
}

function onReady(particleSystem) {
    positionHierarchy(particleSystem);
}

function scheduleHierarchy() {
    nextTick(() => positionHierarchy(graphView.value?.system));
}

function reset() {
    const nodes = { center: nodeData('#253450', 32, 'arbor-vue') };
    const edges = { center: {} };
    initialNames.forEach((name, index) => {
        nodes[name] = nodeData(colors[index], 25, name);
        const parent = isTree.value && index >= 2 ? initialNames[Math.floor((index - 2) / 2)] : 'center';
        if (!edges[parent]) edges[parent] = {};
        edges[parent][name] = edgeData();
        if (preset.value === 'network') {
            edges[name] = {
                [initialNames[(index + 1) % initialNames.length]]: edgeData(),
                [initialNames[(index + 2) % initialNames.length]]: edgeData()
            };
        }
    });
    if (preset.value === 'hierarchy') {
        Object.values(nodes).forEach((node) => { node.fixed = true; });
    }
    graph.nodes = nodes;
    graph.edges = edges;
    nodeCount.value = initialNames.length + 1;
    selectedNodeName.value = 'center';
    selectedEdgeKey.value = JSON.stringify(['center', initialNames[0]]);
    Object.assign(system, defaults);
    error.value = '';
    scheduleHierarchy();
}

function addNode() {
    if (nodeCount.value >= maxNodes) return;
    const name = `Node ${nodeCount.value}`;
    graph.nodes[name] = nodeData(colors[nodeCount.value % colors.length], 25, name);
    if (preset.value === 'star') {
        graph.edges.center[name] = edgeData();
    } else if (isTree.value) {
        const parent = selectedNodeName.value;
        if (!graph.edges[parent]) graph.edges[parent] = {};
        graph.edges[parent][name] = edgeData();
        graph.nodes[name].fixed = preset.value === 'hierarchy';
    } else {
        const names = Object.keys(graph.nodes);
        graph.edges[name] = { [names[names.length - 2]]: edgeData(), [names[names.length - 3]]: edgeData() };
    }
    nodeCount.value++;
    if (preset.value === 'hierarchy') scheduleHierarchy();
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
.demo { max-width: 100%; margin: auto; padding: 18px 24px 16px; }
header { margin-bottom: 16px; }
.eyebrow { margin: 0 0 4px; color: #486bb0; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; }
h1 { margin: 0; font-size: clamp(1.6rem, 3vw, 2rem); letter-spacing: -0.04em; line-height: 1.15; }
header p:last-child { margin: 4px 0 0; color: #66748a; font-size: 0.88rem; }
.workspace { --graph-height: clamp(350px, calc(100dvh - 155px), 650px); display: grid; grid-template-columns: minmax(0, 1fr) 270px; overflow: hidden; background: white; border: 1px solid #dfe5ed; border-radius: 16px; }
.graph { height: var(--graph-height); min-width: 0; background: #fbfcfe; }
.controls { height: var(--graph-height); overflow-y: auto; overscroll-behavior: contain; padding: 18px; border-left: 1px solid #e6ebf1; }
.controls:focus-visible { outline: 2px solid #486bb0; outline-offset: -2px; }
.controls label:not(.checkbox) { display: flex; justify-content: space-between; margin: 10px 0 4px; font-size: 0.82rem; font-weight: 600; }
output, .controls p { color: #68758a; font-size: 0.82rem; }
.controls p { margin: 8px 0; line-height: 1.3; }
input[type="range"] { width: 100%; accent-color: #486bb0; }
select { width: 100%; padding: 6px; border: 1px solid #dfe5ed; border-radius: 6px; background: white; color: inherit; font: inherit; }
details { margin: 18px 0; border-top: 1px solid #e6ebf1; padding-top: 14px; }
summary { font-size: 0.9rem; font-weight: 700; cursor: pointer; }
input[type="color"] { width: 100%; height: 30px; border: 1px solid #dfe5ed; border-radius: 6px; background: white; cursor: pointer; }
.checkbox { display: flex; gap: 8px; align-items: center; margin: 10px 0 4px; font-size: 0.82rem; }
button { width: 100%; padding: 11px; border: 1px solid #486bb0; border-radius: 8px; background: #486bb0; color: white; font: inherit; cursor: pointer; }
button.secondary { margin-top: 10px; background: white; color: #486bb0; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
.error { color: #a52c2c !important; }
footer { margin-top: 8px; font-size: 0.8rem; }
a { color: #486bb0; }
@media (max-width: 700px) {
    .demo { padding: 16px; }
    .workspace { --graph-height: clamp(180px, 30dvh, 300px); grid-template-columns: 1fr; }
    .controls { height: clamp(180px, calc(100dvh - var(--graph-height) - 175px), 420px); border-top: 1px solid #e6ebf1; border-left: 0; }
}
@media (max-width: 700px) and (max-height: 700px) {
    .workspace { --graph-height: clamp(130px, 21dvh, 180px); }
}
</style>
