<template>
	<canvas id="arborViewport" ref="arborViewport"></canvas>
</template>

<script>
import Renderer from"../services/renderer";
import ParticleSystem from "../services/physics/system";

export default {
	name: 'Arbor',
	props : ['systemParms', 'particleParms'],
	computed:{
		sys : function(){
			let tmp = new ParticleSystem();
			tmp.parameters(this.systemParms);
			tmp.graft(this.particleParms);
			return tmp;
		}
	},
	created(){
	},
	mounted(){
		this.sys.renderer = new Renderer(this.$refs.arborViewport);
		this.sys.start();
	}
}
</script>

<style scoped>
#arborViewport{
	border:1px dotted white;
	width:70%;
}

</style>