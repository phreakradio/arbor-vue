<template>
  <div id="app">
    <Arbor 	:systemParms=""
    		:particleParms="" />
  </div>
</template>

<script>
import Arbor from './components/ArborVue.vue'

export default {
  name: 'app',
  components: {
    Arbor
  },
  data(){
  	return{
  		color : {
  			black		: "#000000",
		    darkblue	: "#4046F5",
		    gray 		: "#8A8A86",
		    orange		: "#FFD900",
		    purple		: "#941e5e",
		    brown		: "#BFA843",
		    lightblue	: "#009fc3",
		    uber		: "#666666",
		    green		: "#73B55B"
  		},
  		systemParms : {
  			stiffness:700, 
  			repulsion:700, 
  			gravity:false, 
  			dt:0.015
  		},
  		particleParms : {
  			central: {	
  				'color': this.color.black, 
				'shape': 'dot', 
				'radius': 10,
				'image_w': 73,
				'image_h': 24,
				'alpha': 1
			},
			python:{
				'color': this.color.orange,
			 	'shape': 'dot',
				'radius': 50, 
				'image': 'python.png',
				'image_w': 25,
				'image_h': 25,
				'alpha': 1
	        },
	        cplus:{
	        	'color': this.color.uber,
			 	'shape': 'dot',
				'radius': 50, 
				'image': 'c++.png',
				'image_w': 25,
				'image_h': 25,
				'alpha': 1
	        },				 				 
	        java:{  
	   			'color': this.color.brown,
				'shape': 'dot',
				'radius': 50, 
				'image': 'java.png',
				'image_w': 25,
				'image_h': 25,
				'alpha': 1
	        },
	        android:{	
	   			'color': this.color.green,
				'shape': 'dot',
				'radius': 50, 
				'image':  'android.png',
				'image_w': 25,
				'image_h': 25,
				'alpha': 1
	        }, 
	/*========================================================================================================*/
	        python1:{
		    	'label': 'Tic-Tac-Toe', 
				'color': this.color.orange, 
				'alpha': 0, 
				'link': 'https://github.com/phreakradio/TicTacToe'
	        },
	        python2:{
		    	'label': 'Router Simulator', 
				'color': this.color.orange, 
				'alpha': 0, 
				'link': 'https://github.com/phreakradio/Router_simulator'
	        },
	        java1:{
	   			'label': 'L.E.T.T.E.R',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/LETTER'
	        }, 
	        java2:{
	   			'label': 'Game of Life',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/Conways-Game-Of-Life'
	        }, 					
	        java3:{
	   			'label': 'MazeSolver',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/MazeSolver'
	        },
	        java4:{
	   			'label': 'Towers of Hanoi',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/Towers-of-Hanoi'
	        }, 					
	        java5:{
	   			'label': 'DFA Verifier',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/DFA-Verifier'
	        },
	        java6:{
	   			'label': 'PDA Verifier',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/PDA-Verfier'
	        },
	        java7:{
	   			'label': 'DES Encryptor/Decryptor',
				'color': this.color.brown, 
				'alpha': 0,
				'link': 'https://github.com/phreakradio/DES-Example-in-Java'
	        },
	        android1:{
		   		'label': 'CS490 Project', 
				'color': this.color.green, 
				'alpha': 0,
				'link': 'https://github.com/hkajur/Code_Testing/tree/master/MobileApp/CS490ProjectRelease'
	        },
			cplus1:{
				'label': 'LongInteger Arithmetic',
				'color':color.uber,
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
  }
}
</script>

<style>
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
