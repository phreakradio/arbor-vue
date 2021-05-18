<template>
	<div id='app'>
		<Arbor class="arbor"
				:systemParms="system"
				:particleParms="particles"/>
	</div>
</template>

<script>
import Arbor from './components/ArborVue.vue';

export default {
	name: 'app',
	components: {
		Arbor
	},
	data(){
		let color = {
			black: '#000000',
			africa: "#D68300",
			asia: "#4D7A00",
			europe: "#6D87CF",
			nAmerica: "#D4E200",
			sAmerica: "#CD2900",
			oceania: "#4F2170"
		};

		return{
			system : {
				stiffness:700,
				repulsion:700, 
				gravity:false, 
				dt:0.015
			},
			particles : {
				nodes:{
					central: {
						'color': color.black, 
						'mass' : 100,
						'shape': 'dot', 
						'radius': 10,
						'alpha': 1
					},
					africa:{
						'color': color.africa,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						'alpha': 1
					},
					asia:{
						'color': color.asia,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						'alpha': 1
					},
					europe:{
						'color': color.europe,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						'alpha': 1
					},
					nAmerica:{
						'color': color.nAmerica,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						'alpha': 1
					},
					sAmerica:{
						'color': color.sAmerica,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						'alpha': 1
					},
					oceania:{
						'color': color.oceania,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						'alpha': 1
					},
				},
				edges:{
					central:{
						africa: {},
						asia: {},
						europe: {},
						nAmerica: {},
						sAmerica: {},
						oceania: {}
					}
				}
			}
		};
	}
}
</script>

<style>
*{
	margin:0;
	padding:0;
}
#app {
	font-family: 'Avenir', Helvetica, Arial, sans-serif;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	text-align: center;
	background: #000;
	width:100vw;
	height:100vh;
}

.arbor{
	border:1px dotted white;
	background: white;
	width:100%;
	margin: auto;
}

</style>
