import ArborVue from './components/ArborVue.vue';
import ParticleSystem, { Edge, Node, Point } from './services/physics/system.js';
import Renderer from './services/renderer.js';
import Graphics from './services/graphics/graphics.js';
import colors from './services/graphics/colors.js';
import Tween from './services/tween/tween.js';
import etc from './services/etc.js';

const plugin = {
    install(app) {
        app.component('ArborVue', ArborVue);
    }
};

export { ArborVue, Edge, Node, ParticleSystem, Point, Renderer, Graphics, colors, Tween, etc };
export default plugin;
