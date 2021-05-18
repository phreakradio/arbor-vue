'use strict';
//
// kernel.js
//
// run-loop manager for physics and tween updates
//

import Tween from './tween/tween';
import Physics from './physics/physics';
import mergeWith from 'lodash/mergeWith';

var Kernel = function(pSystem){
    // in chrome, web workers aren't available to pages with file:// urls
    var chrome_local_file = window.location.protocol == "file:" &&
                            navigator.userAgent.toLowerCase().indexOf('chrome') > -1;
    var USE_WORKER = (window.Worker !== undefined && !chrome_local_file);

    var _physics = null;
    var _tween = null;
    var _fpsWindow = []; // for keeping track of the actual frame rate
    _fpsWindow.last = new Date();
    var _screenInterval = null;
    var _attached = null;

    var _tickInterval = null;
    var _lastTick = null;
    var _paused = false;

    var that = {
        system:pSystem,

        tween:null,
        
        nodes:{},

        init:function(){
            if (typeof(Tween)!='undefined') _tween = Tween();
            else if (typeof(arbor.Tween)!='undefined') _tween = arbor.Tween();
            else _tween = {
                busy:function(){return false},
                tick:function(){return true},
                to:function(){ 
                    _tween.to=function(){}; return;
                }
            }
            that.tween = _tween;
            var params = pSystem.parameters();

            if(USE_WORKER){
                _screenInterval = setInterval(that.screenUpdate, params.timeout);

                _physics = new Worker(arbor_path()+'physics/worker.js');
                _physics.onmessage = that.workerMsg;
                _physics.onerror = function(e){  }
                _physics.postMessage({
                    type:"physics", 
                    physics:objmerge(params, {timeout:Math.ceil(params.timeout)}) 
                });
            }else{
                _physics = Physics(params.dt, params.stiffness, params.repulsion, params.friction, that.system._updateGeometry, params.integrator);
                that.start();
            }
            return that;
        },

        //
        // updates from the ParticleSystem
        graphChanged:function(changes){
            // a node or edge was added or deleted
            if (USE_WORKER) _physics.postMessage({type:"changes","changes":changes});
            else _physics._update(changes);
            that.start(); // <- is this just to kick things off in the non-worker mode? (yes)
        },

        particleModified:function(id, mods){
            // a particle's position or mass is changed
            if (USE_WORKER) _physics.postMessage({type:"modify", id:id, mods:mods});
            else _physics.modifyNode(id, mods);
            that.start(); // <- is this just to kick things off in the non-worker mode? (yes)
        },

        physicsModified:function(param){
            // intercept changes to the framerate in case we're using a worker and
            // managing our own draw timer
            if (!isNaN(param.timeout)){
                if (USE_WORKER){
                    clearInterval(_screenInterval);
                    _screenInterval = setInterval(that.screenUpdate, param.timeout);
                }else{
                    // clear the old interval then let the call to .start set the new one
                    clearInterval(_tickInterval);
                    _tickInterval=null;
                }
            }

            // a change to the physics parameters 
            if (USE_WORKER) _physics.postMessage({type:'sys',param:param});
            else _physics.modifyPhysics(param);
            that.start(); // <- is this just to kick things off in the non-worker mode? (yes)
        },

        workerMsg:function(e){
            var type = e.data.type;
            if (type=='geometry'){
                that.workerUpdate(e.data);
            }else{}
        },

        _lastPositions:null,
        
        workerUpdate:function(data){
            that._lastPositions = data;
            that._lastBounds = data.bounds;
        },
        // 
        // the main render loop when running in web worker mode
        _lastFrametime:new Date().valueOf(),

        _lastBounds:null,

        _currentRenderer:null,

        screenUpdate:function(){
            var now = new Date().valueOf();

            var shouldRedraw = false
            if (that._lastPositions!==null){
                that.system._updateGeometry(that._lastPositions);
                that._lastPositions = null;
                shouldRedraw = true;
            }

            if (_tween && _tween.busy()) shouldRedraw = true;

            if (that.system._updateBounds(that._lastBounds)) shouldRedraw=true;

            if (shouldRedraw){
                var render = that.system.renderer;
                if (render!==undefined){
                    if (render !== _attached){
                        render.init(that.system);
                        _attached = render;
                    }

                    if (_tween) _tween.tick()
                        render.redraw();

                    var prevFrame = _fpsWindow.last
                    _fpsWindow.last = new Date();
                    _fpsWindow.push(_fpsWindow.last-prevFrame);
                    if (_fpsWindow.length>50) _fpsWindow.shift();
                }
            }
        },

        // 
        // the main render loop when running in non-worker mode
        physicsUpdate:function(){
            if (_tween) _tween.tick()
                _physics.tick();

            var stillActive = that.system._updateBounds();
            if (_tween && _tween.busy()) stillActive = true;

            var render = that.system.renderer;
            var now = new Date();
            var render = that.system.renderer;
            if (render!==undefined){
                if (render !== _attached){
                    render.init(that.system);
                    _attached = render;
                }
                render.redraw({timestamp:now});
            }

            var prevFrame = _fpsWindow.last;
            _fpsWindow.last = now;
            _fpsWindow.push(_fpsWindow.last-prevFrame);
            if (_fpsWindow.length>50) _fpsWindow.shift();

            // but stop the simulation when energy of the system goes below a threshold
            var sysEnergy = _physics.systemEnergy()
            if ((sysEnergy.mean + sysEnergy.max)/2 < 0.05){
                if (_lastTick===null) _lastTick=new Date().valueOf(){
                    if (new Date().valueOf()-_lastTick>1000){
                        clearInterval(_tickInterval);
                        _tickInterval = null;
                    }
                }
                else{
                    _lastTick = null;
                }
            }
        },

        fps:function(newTargetFPS){
            if (newTargetFPS!==undefined){
                var timeout = 1000/Math.max(1,targetFps);
                that.physicsModified({timeout:timeout});
            }

            var totInterv = 0;
            for (var i=0, j=_fpsWindow.length; i<j; i++) totInterv+=_fpsWindow[i];
            var meanIntev = totInterv/Math.max(1,_fpsWindow.length);
            if (!isNaN(meanIntev)) return Math.round(1000/meanIntev);
            else return 0;
        },

        // 
        // start/stop simulation
        // 
        start:function(unpause){
            if (_tickInterval !== null) return; // already running
            if (_paused && !unpause) return; // we've been .stopped before, wait for unpause
            _paused = false;

            if (USE_WORKER){
                _physics.postMessage({type:"start"});
            }else{
                _lastTick = null;
                _tickInterval = setInterval(that.physicsUpdate, that.system.parameters().timeout);
            }
        },

        stop:function(){
            _paused = true
            if (USE_WORKER){
                _physics.postMessage({type:"stop"});
            }else{
                if (_tickInterval!==null){
                    clearInterval(_tickInterval);
                    _tickInterval = null;
                }
            }
        }
    }

    return that.init();
}

export default Kernel;

// import Tween from './tween/tween';
// import Physics from './physics/physics';
// import mergeWith from 'lodash/mergeWith';

// export default class Kernel{
//     constructor(pSystem){
//         // let test1 = window.location.protocol == "file:";
//         // let test2 = navigator.userAgent.toLowerCase().indexOf('chrome') > -1;

//         // this.chrome_local_file = test1 && test2;
//         this.chrome_local_file = true;
//         this.USE_WORKER = (window.Worker !== undefined && !this.chrome_local_file);

//         this._physics = null;
//         this._tween = null;
//         this._fpsWindow = []; // for keeping track of the actual frame rate
//         this._fpsWindow.last = new Date();
//         this._screenInterval = null;
//         this._attached = null;

//         this._tickInterval = null;
//         this._lastTick = null;
//         this._paused = false;


//         this.system = pSystem;
//         this.nodes = {};

//         this._lastPositions=null;
//         // 
//         // the main render loop when running in web worker mode
//         this._lastFrametime = new Date().valueOf();
//         this._lastBounds = null;
//         this._currentRenderer = null;

//         this._tween = new Tween();
//         let params = this.system.parameters();

//         if(this.USE_WORKER){
//             this._screenInterval = setInterval(this.screenUpdate.bind(this), params.timeout);

//             this._physics = new Worker('./physics/worker.js');
//             this._physics.onmessage = this.workerMsg;
//             this._physics.postMessage({
//                 type:"physics", 
//                 physics:mergeWith(params, {timeout:Math.ceil(params.timeout)})
//             });
//         }
//         else{
//             this._physics = new Physics(params.dt, params.stiffness, params.repulsion, params.friction, this.system, params.integrator);
//             // this.start();
//         }
//     }

//     // updates from the ParticleSystem
//     graphChanged(changes){
//         // a node or edge was added or deleted
//         if (this.USE_WORKER) this._physics.postMessage({type:"changes","changes":changes});
//         else this._physics._update(changes);
//         this.start(); // <- is this just to kick things off in the non-worker mode? (yes)
//     }

//     particleModified(id, mods){
//         // a particle's position or mass is changed
//         // trace('mod',objkeys(mods))
//         if (this.USE_WORKER) this._physics.postMessage({type:"modify", id:id, mods:mods});
//         else this._physics.modifyNode(id, mods);
//         this.start(); // <- is this just to kick things off in the non-worker mode? (yes)
//     }

//     physicsModified(param){
//         // intercept changes to the framerate in case we're using a worker and
//         // managing our own draw timer
//         if (!isNaN(param.timeout)){
//             if (this.USE_WORKER){
//                 clearInterval(this._screenInterval);
//                 this._screenInterval = setInterval(this.screenUpdate.bind(this), param.timeout);
//             }
//             else{
//                 // clear the old interval then let the call to .start set the new one
//                 clearInterval(this._tickInterval);
//                 this._tickInterval=null;
//             }
//         }

//         // a change to the physics parameters 
//         if (this.USE_WORKER) this._physics.postMessage({type:'sys',param:param});
//         else this._physics.modifyPhysics(param);
//         this.start() // <- is this just to kick things off in the non-worker mode? (yes)
//     }

//     workerMsg(e){
//         var type = e.data.type;
//         if (type=='geometry'){
//             this.workerUpdate(e.data);
//         }
//     }

//     workerUpdate(data){
//         this._lastPositions = data;
//         this._lastBounds = data.bounds;
//     }

//     screenUpdate(){
//         let shouldRedraw = false;
//         if (this._lastPositions!==null){
//             this.system._updateGeometry(this._lastPositions);
//             this._lastPositions = null;
//             shouldRedraw = true;
//         }
        
//         if (this._tween && this._tween.busy()) shouldRedraw = true;

//         if (this.system._updateBounds(this._lastBounds)) shouldRedraw=true;

//         if (shouldRedraw){
//             let render = this.system.renderer;
//             if (render!==undefined){
//                 if (render !== this._attached){
//                     render.init(this.system);
//                     this._attached = render;
//                 }

//                 if (this._tween) this._tween.tick();
//                 render.redraw();

//                 var prevFrame = this._fpsWindow.last;
//                 this._fpsWindow.last = new Date();
//                 this._fpsWindow.push(this._fpsWindow.last-prevFrame);
//                 if (this._fpsWindow.length>50) this._fpsWindow.shift();
//             }
//         }
//     }

//     // 
//     // the main render loop when running in non-worker mode
//     physicsUpdate(){
//         if (this._tween) this._tween.tick();
//         this._physics.tick();

//         this.system._updateBounds();

//         let render = this.system.renderer;
//         let now = new Date();
//         if (render!==undefined){
//             if (render !== this._attached){
//                 render.init(this.system);
//                 this._attached = render;
//             }
//             render.redraw({timestamp:now});
//         }

//         let prevFrame = this._fpsWindow.last;
//         this._fpsWindow.last = now;
//         this._fpsWindow.push(this._fpsWindow.last-prevFrame);
//         if (this._fpsWindow.length>50) this._fpsWindow.shift();

//         // but stop the simulation when energy of the system goes below a threshold
//         let sysEnergy = this._physics.systemEnergy();
//         if ((sysEnergy.mean + sysEnergy.max)/2 < 0.05){
//             if (this._lastTick===null) this._lastTick=new Date().valueOf();
//             if (new Date().valueOf()-this._lastTick>1000){
//                 clearInterval(this._tickInterval)
//                 this._tickInterval = null;
//             }
//         }
//         else{
//             this._lastTick = null;
//         }
//     }

//     fps(newTargetFPS){
//         if (newTargetFPS!==undefined){
//             var timeout = 1000/Math.max(1,this.system.targetFps);
//             this.physicsModified({timeout:timeout});
//         }
        
//         var totInterv = 0;
//         for (var i=0, j=this._fpsWindow.length; i<j; i++) 
//             totInterv+=this._fpsWindow[i];
//         var meanIntev = totInterv/Math.max(1,this._fpsWindow.length);
//         if (!isNaN(meanIntev)) return Math.round(1000/meanIntev);
//         else return 0;
//     }

//     //
//     // start/stop simulation
//     //
//     start(unpause){
//         if (this._tickInterval !== null) return; // already running
//         if (this._paused && !unpause) return; // we've been .stopped before, wait for unpause
//         this._paused = false;
        
//         if (this.USE_WORKER){
//            this._physics.postMessage({type:"start"});
//         }
//         else{
//           this._lastTick = null;
//           this._tickInterval = setInterval(this.physicsUpdate.bind(this), this.system.parameters().timeout);
//         }
//     }

//     stop(){
//         this._paused = true;
//         if (this.USE_WORKER){
//             this._physics.postMessage({type:"stop"});
//         }
//         else{
//             if (this._tickInterval!==null){
//                 clearInterval(this._tickInterval);
//                 this._tickInterval = null;
//             }
//         }
//     }
// }