//
// kernel.js
//
// run-loop manager for physics and tween updates
//

import Tween from './tween/tween';
import Physics from './physics/physics';
import mergeWith from 'lodash/mergeWith';

export default class Kernel{
    constructor(pSystem){
        // let test1 = window.location.protocol == "file:";
        // let test2 = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;

        // this.chrome_local_file = test1 && test2;
        this.chrome_local_file = true;
        this.USE_WORKER = (window.Worker !== undefined && !this.chrome_local_file);

        this._physics = null;
        this._tween = null;
        this._fpsWindow = []; // for keeping track of the actual frame rate
        this._fpsWindow.last = new Date();
        this._screenInterval = null;
        this._attached = null;

        this._tickInterval = null;
        this._lastTick = null;
        this._paused = false;


        this.system = pSystem;
        this.nodes = {};

        this._lastPositions=null;
        // 
        // the main render loop when running in web worker mode
        this._lastFrametime = new Date().valueOf();
        this._lastBounds = null;
        this._currentRenderer = null;

        this._tween = new Tween();
        let params = this.system.parameters();

        if(this.USE_WORKER){
            this._screenInterval = setInterval(this.screenUpdate.bind(this), params.timeout);

            this._physics = new Worker('./physics/worker.js');
            this._physics.onmessage = this.workerMsg;
            this._physics.postMessage({
                type:"physics", 
                physics:mergeWith(params, {timeout:Math.ceil(params.timeout)})
            });
        }
        else{
            this._physics = new Physics(params.dt, params.stiffness, params.repulsion, params.friction, this.system, params.integrator);
            // this.start();
        }
    }

    // updates from the ParticleSystem
    graphChanged(changes){
        // a node or edge was added or deleted
        if (this.USE_WORKER) this._physics.postMessage({type:"changes","changes":changes});
        else this._physics._update(changes);
        this.start(); // <- is this just to kick things off in the non-worker mode? (yes)
    }

    particleModified(id, mods){
        // a particle's position or mass is changed
        // trace('mod',objkeys(mods))
        if (this.USE_WORKER) this._physics.postMessage({type:"modify", id:id, mods:mods});
        else this._physics.modifyNode(id, mods);
        this.start(); // <- is this just to kick things off in the non-worker mode? (yes)
    }

    physicsModified(param){
        // intercept changes to the framerate in case we're using a worker and
        // managing our own draw timer
        if (!isNaN(param.timeout)){
            if (this.USE_WORKER){
                clearInterval(this._screenInterval);
                this._screenInterval = setInterval(this.screenUpdate.bind(this), param.timeout);
            }
            else{
                // clear the old interval then let the call to .start set the new one
                clearInterval(this._tickInterval);
                this._tickInterval=null;
            }
        }

        // a change to the physics parameters 
        if (this.USE_WORKER) this._physics.postMessage({type:'sys',param:param});
        else this._physics.modifyPhysics(param);
        this.start() // <- is this just to kick things off in the non-worker mode? (yes)
    }

    workerMsg(e){
        var type = e.data.type;
        if (type=='geometry'){
            this.workerUpdate(e.data);
        }
    }

    workerUpdate(data){
        this._lastPositions = data;
        this._lastBounds = data.bounds;
    }

    screenUpdate(){
        let shouldRedraw = false;
        if (this._lastPositions!==null){
            this.system._updateGeometry(this._lastPositions);
            this._lastPositions = null;
            shouldRedraw = true;
        }
        
        if (this._tween && this._tween.busy()) shouldRedraw = true;

        if (this.system._updateBounds(this._lastBounds)) shouldRedraw=true;

        if (shouldRedraw){
            let render = this.system.renderer;
            if (render!==undefined){
                if (render !== this._attached){
                    render.init(this.system);
                    this._attached = render;
                }

                if (this._tween) this._tween.tick();
                render.redraw();

                var prevFrame = this._fpsWindow.last;
                this._fpsWindow.last = new Date();
                this._fpsWindow.push(this._fpsWindow.last-prevFrame);
                if (this._fpsWindow.length>50) this._fpsWindow.shift();
            }
        }
    }

    // 
    // the main render loop when running in non-worker mode
    physicsUpdate(){
        if (this._tween) this._tween.tick();
        this._physics.tick();

        this.system._updateBounds();

        let render = this.system.renderer;
        let now = new Date();
        if (render!==undefined){
            if (render !== this._attached){
                render.init(this.system);
                this._attached = render;
            }
            render.redraw({timestamp:now});
        }

        let prevFrame = this._fpsWindow.last;
        this._fpsWindow.last = now;
        this._fpsWindow.push(this._fpsWindow.last-prevFrame);
        if (this._fpsWindow.length>50) this._fpsWindow.shift();

        // but stop the simulation when energy of the system goes below a threshold
        let sysEnergy = this._physics.systemEnergy();
        if ((sysEnergy.mean + sysEnergy.max)/2 < 0.05){
            if (this._lastTick===null) this._lastTick=new Date().valueOf();
            if (new Date().valueOf()-this._lastTick>1000){
                clearInterval(this._tickInterval)
                this._tickInterval = null;
            }
        }
        else{
            this._lastTick = null;
        }
    }

    fps(newTargetFPS){
        if (newTargetFPS!==undefined){
            var timeout = 1000/Math.max(1,this.system.targetFps);
            this.physicsModified({timeout:timeout});
        }
        
        var totInterv = 0;
        for (var i=0, j=this._fpsWindow.length; i<j; i++) 
            totInterv+=this._fpsWindow[i];
        var meanIntev = totInterv/Math.max(1,this._fpsWindow.length);
        if (!isNaN(meanIntev)) return Math.round(1000/meanIntev);
        else return 0;
    }

    //
    // start/stop simulation
    //
    start(unpause){
        if (this._tickInterval !== null) return; // already running
        if (this._paused && !unpause) return; // we've been .stopped before, wait for unpause
        this._paused = false;
        
        if (this.USE_WORKER){
           this._physics.postMessage({type:"start"});
        }
        else{
          this._lastTick = null;
          this._tickInterval = setInterval(this.physicsUpdate.bind(this), this.system.parameters().timeout);
        }
    }

    stop(){
        this._paused = true;
        if (this.USE_WORKER){
            this._physics.postMessage({type:"stop"});
        }
        else{
            if (this._tickInterval!==null){
                clearInterval(this._tickInterval);
                this._tickInterval = null;
            }
        }
    }
}