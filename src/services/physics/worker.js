//
// worker.js
//
// wraps physics.js in an onMessage/postMessage protocol that the
// Kernel object can deal with
//
//  Ported by Dmytro Malaniouk on 2020-01-30.
//
import * from 'atoms.js';
import BarnesHutTree from 'barnes-hut.js';
import Physics from './physics';

class PhysicsWorker{
    _timeout = 20;
    _physics = null;
    _physicsInterval = null;
    _lastTick = null;

    times = [];
    last = new Date().valueOf();

    init(param){
        this.timeout(param.timeout);
        this._physics = new Physics(param.dt, param.stiffness, param.repulsion, param.friction, this.tock);
    }
    timeout(newTimeout){
        if (newTimeout!=this._timeout){
            this._timeout = newTimeout;
            if (this._physicsInterval!==null){
                this.stop();
                this.go();
            }
        }
    }

    go(){
        if (this._physicsInterval!==null) return;

        this._lastTick=null;
        this._physicsInterval = setInterval(this.tick, this._timeout);
    }

    stop(){
        if (this._physicsInterval===null) return;
        clearInterval(this._physicsInterval);
        this._physicsInterval = null;
    }

    tick(){
        // iterate the system
        this._physics.tick();

        // but stop the simulation when energy of the system goes below a threshold
        let sysEnergy = this._physics.systemEnergy();
        if ((sysEnergy.mean + sysEnergy.max)/2 < 0.05){
            if (this._lastTick===null) this._lastTick=new Date().valueOf();
            if (new Date().valueOf()-this._lastTick>1000){
                this.stop();
            }
        }
        else{
            this._lastTick = null;
        }
    }

    tock(sysData){
        sysData.type = "geometry";
        postMessage(sysData);
    }

    modifyNode(id, mods){
        this._physics.modifyNode(id, mods);
        this.go();
    }

    modifyPhysics(param){
        this._physics.modifyPhysics(param);
    }

    update(changes){
        let epoch = this._physics._update(changes);
    }
}

var physics = new PhysicsWorker();

onmessage = function(e){
  if (!e.data.type){
    postMessage("¿kérnèl?")
    return
  }
  
  if (e.data.type=='physics'){
    var param = e.data.physics
    physics.init(e.data.physics)
    return
  }
  
  switch(e.data.type){
    case "modify":
      physics.modifyNode(e.data.id, e.data.mods)
      break

    case "changes":
      physics.update(e.data.changes)
      physics.go()
      break
      
    case "start":
      physics.go()
      break
      
    case "stop":
      physics.stop()
      break
      
    case "sys":
      var param = e.data.param || {}
      if (!isNaN(param.timeout)) physics.timeout(param.timeout)
      physics.modifyPhysics(param)
      physics.go()
      break
    }  
}
