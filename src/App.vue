<template>
	<div id='app'>
		<Arbor :systemParms="systemParms"
				:particleParms="particleParms"/>
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
			darkblue: '#4046F5',
			gray: '#8A8A86',
			orange: '#FFD900',
			purple: '#941e5e',
			brown: '#BFA843',
			lightblue: '#009fc3',
			uber: '#666666',
			green: '#73B55B'
		};

		return{
			systemParms : {
				stiffness:700,
				repulsion:700, 
				gravity:false, 
				dt:0.015
			},
			particleParms : {
				nodes:{
					central: {
						'color': color.black, 
						'mass' : 100,
						'shape': 'dot', 
						'radius': 10,
						'alpha': 1
					},
					python:{
						'color': color.orange,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						// 'image': 'python.png',
						'image_w': 25,
						'image_h': 25,
						'alpha': 1
					},
					cplus:{
						'color': color.uber,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						// 'image': 'c++.png',
						'image_w': 25,
						'image_h': 25,
						'alpha': 1
					},
					java:{
						'color': color.brown,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						// 'image': 'java.png',
						'image_w': 25,
						'image_h': 25,
						'alpha': 1
					},
					android:{
						'color': color.green,
						'mass' : 50,
						'shape': 'dot',
						'radius': 50, 
						// 'image':  'android.png',
						'image_w': 25,
						'image_h': 25,
						'alpha': 1
					},
					python1:{
						'label': 'Tic-Tac-Toe',
						'mass' : 25,
						'color': color.orange, 
						'alpha': 0, 
						'link': 'https://github.com/phreakradio/TicTacToe'
					},
					python2:{
						'label': 'Router Simulator',
						'mass' : 25, 
						'color': color.orange, 
						'alpha': 0, 
						'link': 'https://github.com/phreakradio/Router_simulator'
					},
					java1:{
						'label': 'L.E.T.T.E.R',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/LETTER'
					},
					java2:{
						'label': 'Game of Life',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/Conways-Game-Of-Life'
					},
					java3:{
						'label': 'MazeSolver',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/MazeSolver'
					},
					java4:{
						'label': 'Towers of Hanoi',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/Towers-of-Hanoi'
					},
					java5:{
						'label': 'DFA Verifier',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/DFA-Verifier'
					},
					java6:{
						'label': 'PDA Verifier',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/PDA-Verfier'
					},
					java7:{
						'label': 'DES Encryptor/Decryptor',
						'mass' : 25,
						'color': color.brown, 
						'alpha': 0,
						'link': 'https://github.com/phreakradio/DES-Example-in-Java'
					},
					android1:{
						'label': 'CS490 Project', 
						'mass' : 25,
						'color': color.green, 
						'alpha': 0,
						'link': 'https://github.com/hkajur/Code_Testing/tree/master/MobileApp/CS490ProjectRelease'
					},
					cplus1:{
						'label': 'LongInteger Arithmetic',
						'mass' : 25,
						'color': color.uber,
						'alpha':0,
						'link': 'https://github.com/phreakradio/LongInteger-Arithmetic-functions'
					}
				},
				edges:{
					central:{
						python:{},
						java:{},
						android:{},
						cplus:{}
					},
					python:{
						python1:{},
						python2:{}
					},
					java:{
						java1:{},
						java2:{},
						java3:{},
						java4:{},
						java5:{},
						java6:{},
						java7:{}
					},
					cplus:{
						cplus1:{}
					},
					android:{
						android1:{}
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
</style>
