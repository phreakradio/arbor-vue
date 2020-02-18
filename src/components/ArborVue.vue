<template>
	<canvas id="arborViewport"></canvas>
</template>

<script>
import Renderer from "../services/renderer";
import ParticleSystem from "../services/physics/system";

export default {
	name: 'Arbor',
	props : ['systemParms', 'particleParms'],
	computed:{
		sys : function(){
			let tmp = new ParticleSystem();
			tmp.parameters(this.systemParms);
			tmp.renderer = new Renderer("#arborViewport");
			tmp.graft(this.particleParms);
			return tmp;
		}
	},
	created(){
	},
	mounted(){
		
	}
}
</script>

<style scoped>
#arborViewport{
	border:1px dotted white;
}

</style>