import Vue from "vue";

import ArborCanvas from "./Arbor.vue";

const Components = {
	ArborCanvas
};

Object.keys(Components).forEach(() => {
	Vue.component(name, Components[name]);
});

export default Components;