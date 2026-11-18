<template>
  <canvas
    ref="canvas"
    class="arbor-vue"
    :style="{ width: cssSize(width), height: cssSize(height), display: 'block' }"
    :aria-label="ariaLabel"
    role="img"
  />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import ParticleSystem from '../services/physics/system.js';
import Renderer from '../services/renderer.js';

const props = defineProps({
    systemParms: { type: Object, default: () => ({}) },
    particleParms: { type: Object, default: () => ({ nodes: {}, edges: {} }) },
    worker: { type: [Boolean, String], default: 'auto' },
    rendererOptions: { type: Object, default: () => ({}) },
    width: { type: [Number, String], default: '100%' },
    height: { type: [Number, String], default: 400 },
    ariaLabel: { type: String, default: 'Force-directed graph' }
});
const emit = defineEmits(['node-click', 'navigate', 'error', 'ready']);

const canvas = ref(null);
const system = shallowRef(null);
let renderer = null;

function cssSize(value) {
    return typeof value === 'number' || /^\d+(\.\d+)?$/.test(value) ? `${value}px` : value;
}

function reportError(error) {
    emit('error', error);
}

onMounted(() => {
    const graph = new ParticleSystem({
        ...props.systemParms,
        worker: props.worker,
        onError: reportError
    });
    renderer = new Renderer(canvas.value, {
        ...props.rendererOptions,
        onNodeClick(node, event) {
            emit('node-click', { node, event, system: graph });
            if (node.data.link) {
                emit('navigate', { node, link: node.data.link, event });
            }
        }
    });
    graph.renderer = renderer;
    graph.graft(props.particleParms);
    system.value = graph;
    graph.start();
    emit('ready', graph);
});

watch(() => props.particleParms, (branch) => {
    if (system.value) system.value.merge(branch || {});
}, { deep: true });

watch(() => props.systemParms, (parameters) => {
    if (system.value) system.value.parameters(parameters || {});
}, { deep: true });

onBeforeUnmount(() => {
    if (system.value) system.value.destroy();
    system.value = null;
    renderer = null;
});

defineExpose({ system });
</script>

<style>
.arbor-vue {
    touch-action: none;
}
</style>
