<template>
  <main>
    <ArborVue
      :system-parms="system"
      :particle-parms="graph"
      :worker="true"
      @error="onError"
    />
  </main>
</template>

<script setup>
import { ArborVue } from './index.js';

const system = {
    repulsion: 700,
    stiffness: 700,
    gravity: false,
    dt: 0.015,
    precision: 0.7
};
const colors = ['#d68300', '#4d7a00', '#6d87cf', '#d4e200', '#cd2900', '#4f2170'];
const names = ['africa', 'asia', 'europe', 'north america', 'south america', 'oceania'];
const nodes = {
    central: { color: '#000000', mass: 100, shape: 'dot', radius: 10 }
};
const edges = { central: {} };
names.forEach((name, index) => {
    nodes[name] = { color: colors[index], mass: 50, shape: 'dot', radius: 16, label: name };
    edges.central[name] = {};
});
const graph = { nodes, edges };

function onError(value) {
    console.error(value);
}
</script>

<style>
* {
    box-sizing: border-box;
}
html,
body,
#app {
    width: 100%;
    height: 100%;
    margin: 0;
}
main {
    width: 100%;
    height: 100%;
    background: #fff;
}
.arbor-vue {
    touch-action: none;
}
</style>
