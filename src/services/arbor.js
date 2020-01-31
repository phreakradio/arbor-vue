'use strict';

import ParticleSystem from './physics/system';

// canvasId
// systemParms === {stiffness:700, repulsion:700, gravity:false, dt:0.015}

export default class Arbor{
	constructor(canvasId, systemParms, particleParms){
		this.sys = arbor.ParticleSystem();
    	this.sys.parameters(systemParms);

    	this.sys.renderer = Renderer(canvasId);
    	this.sys.graft(particleParms);
	}
}