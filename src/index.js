import ArborVue from './components/ArborVue.vue';
import ParticleSystem, { Edge, Node, Point } from './services/physics/system.js';
import Renderer from './services/renderer.js';

const plugin = {
    install(app) {
        app.component('ArborVue', ArborVue);
    }
};

export { ArborVue, Edge, Node, ParticleSystem, Point, Renderer };
export default plugin;
