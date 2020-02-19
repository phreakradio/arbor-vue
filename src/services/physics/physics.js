//
// physics.js
//
// the particle system itself. either run inline or in a worker (see worker.js)
//
//  Ported by Dmytro Malaniouk on 2020-01-30.
//
import forEach from 'lodash/forEach';
import includes from 'lodash/includes';

import BarnesHutTree from './barnes-hut.js';
import {Point, Particle, Spring} from './atoms.js';

export default class Physics{
    bhTree = new BarnesHutTree(); // for computing particle repulsion
    active = {particles:{}, springs:{}};
    free = {particles:{}};
    particles = [];
    springs = [];
    _epoch=0;
    _energy = {sum:0, max:0, mean:0};
    _bounds = {topleft:new Point(-1,-1), bottomright:new Point(1,1)};

    SPEED_LIMIT = 1000; // the max particle velocity per tick

    constructor(dt, stiffness, repulsion, friction, updateFn, integrator){
        this.integrator = ['verlet','euler'].indexOf(integrator)>=0 ? integrator : 'verlet';
        this.stiffness = (stiffness!==undefined) ? stiffness : 1000;
        this.repulsion = (repulsion!==undefined)? repulsion : 600;
        this.friction = (friction!==undefined)? friction : .3;
        this.gravity = false;
        this.dt = (dt!==undefined)? dt : 0.02;
        this.theta = .4; // the criterion value for the barnes-hut s/d calculation
        this.updateFn = updateFn;
    }

    modifyPhysics(param){
        forEach(['stiffness','repulsion','friction','gravity','dt','precision', 'integrator'], function(p){
            if (param[p]!==undefined){
                if (p=='precision'){
                    this.theta = 1-param[p];
                    return;
                }
                this[p] = param[p];

                if (p=='stiffness'){
                    var stiff=param[p];
                    forEach(this.active.springs, function(spring){
                        spring.k = stiff;
                    });
                }
            }                
        }.bind(this));
    }

    addNode(c){
        let id = c.id;
        let mass = c.m;

        let w = this._bounds.bottomright.x - this._bounds.topleft.x;
        let h = this._bounds.bottomright.y - this._bounds.topleft.y;
        let randomish_pt = new Point((c.x != null) ? c.x: this._bounds.topleft.x + w*Math.random(),
                                     (c.y != null) ? c.y: this._bounds.topleft.y + h*Math.random());


        this.active.particles[id] = new Particle(randomish_pt, mass);
        this.active.particles[id].connections = 0;
        this.active.particles[id].fixed = (c.f===1);
        this.free.particles[id] = this.active.particles[id];
        this.particles.push(this.active.particles[id]);
    }

    dropNode(c){
        let id = c.id;
        let dropping = this.active.particles[id];
        let idx = includes(dropping, this.particles);
        if (idx) this.particles.splice(idx,1);
        delete this.active.particles[id];
        delete this.free.particles[id];
    }

    modifyNode(id, mods){
        if (id in this.active.particles){
            let pt = this.active.particles[id];
            if ('x' in mods) pt.p.x = mods.x;
            if ('y' in mods) pt.p.y = mods.y;
            if ('m' in mods) pt.m = mods.m;
            if ('f' in mods) pt.fixed = (mods.f===1);
            if ('_m' in mods){
                if (pt._m===undefined) pt._m = pt.m;
                pt.m = mods._m;
            }
        }
    }

    addSpring(c){
        let id = c.id;
        let length = c.l;
        let from = this.active.particles[c.fm];
        let to = this.active.particles[c.to];

        if (from!==undefined && to!==undefined){
            this.active.springs[id] = new Spring(from, to, length, this.stiffness);
            this.springs.push(this.active.springs[id]);
          
            from.connections++;
            to.connections++;

            delete this.free.particles[c.fm];
            delete this.free.particles[c.to];
        }
    }

    dropSpring(c){
        var id = c.id;
        var dropping = this.active.springs[id];

        dropping.point1.connections--;
        dropping.point2.connections--;

        var idx = includes(dropping, this.springs);
        if (idx){
            this.springs.splice(idx,1);
        }
        delete this.active.springs[id];
    }

    _update(changes){
        // batch changes phoned in (automatically) by a ParticleSystem
        this._epoch++;

        forEach(changes, function(c){
            if (c.t in this) this[c.t](c);
        })
        return this._epoch;
    }

    tick(){
        this.tendParticles();
        if (this.integrator=='euler'){
            this.updateForces();
            this.updateVelocity(this.dt);
            this.updatePosition(this.dt);
        }
        else{
            // default to verlet
            this.updateForces();
            this.cacheForces();           // snapshot f(t)
            this.updatePosition(this.dt); // update position to x(t + 1)
            this.updateForces();          // calculate f(t+1)
            this.updateVelocity(this.dt); // update using f(t) and f(t+1) 
        }
        this.tock();
    }

    tock(){
        let coords = [];
        forEach(this.active.particles, function(pt, id){
            coords.push(id);
            coords.push(pt.p.x);
            coords.push(pt.p.y);
        });

        if (this.updateFn) this.updateFn({geometry:coords, epoch:this._epoch, energy:this._energy, bounds:this._bounds});
    }

    tendParticles(){
        forEach(this.active.particles, function(pt){
            // decay down any of the temporary mass increases that were passed along
            // by using an {_m:} instead of an {m:} (which is to say via a Node having
            // its .tempMass attr set)
            if (pt._m!==undefined){
                if (Math.abs(pt.m-pt._m)<1){
                    pt.m = pt._m;
                    delete pt._m;
                }
                else{
                    pt.m *= .98;
                }
            }

            // zero out the velocity from one tick to the next
            pt.v.x = pt.v.y = 0;
        });
    }

    // Physics stuff      
    updateForces() {
        if (this.repulsion>0){
            if (this.theta>0) this.applyBarnesHutRepulsion();
            else this.applyBruteForceRepulsion();
        }
        if (this.stiffness>0) this.applySprings();
        this.applyCenterDrift();
        if (this.gravity) this.applyCenterGravity();
    }

    cacheForces() {
        // keep a snapshot of the current forces for the verlet integrator
        forEach(this.active.particles, function(point) {
            point._F = point.f;
        });
    }

    applyBruteForceRepulsion(){
        forEach(this.active.particles, function(point1){
            forEach(this.active.particles, function(point2){
                if (point1 !== point2){
                    let d = point1.p.subtract(point2.p);
                    let distance = Math.max(1.0, d.magnitude());
                    let direction = ((d.magnitude()>0) ? d : Point.random(1)).normalize();

                    // apply force to each end point
                    // (consult the cached `real' mass value if the mass is being poked to allow
                    // for repositioning. the poked mass will still be used in .applyforce() so
                    // all should be well)
                    point1.applyForce(direction.multiply(this.repulsion*(point2._m||point2.m)*.5)
                        .divide(distance * distance * 0.5) );
                    point2.applyForce(direction.multiply(this.repulsion*(point1._m||point1.m)*.5)
                        .divide(distance * distance * -0.5) );
                }
            })
        })
    }

    applyBarnesHutRepulsion(){
        if (!this._bounds.topleft || !this._bounds.bottomright) return;
        let bottomright = new Point(this._bounds.bottomright);
        let topleft = new Point(this._bounds.topleft);

        // build a barnes-hut tree...
        this.bhTree = new BarnesHutTree(topleft, bottomright, this.theta);
        forEach(this.active.particles, function(particle){
            this.bhTree.insert(particle);
        });

        // ...and use it to approximate the repulsion forces
        forEach(this.active.particles, function(particle){
            this.bhTree.applyForces(particle, this.repulsion);
        });
    }

    applySpring(){
        forEach(this.active.springs, function(spring){
            let d = spring.point2.p.subtract(spring.point1.p); // the direction of the spring
            let displacement = spring.length - d.magnitude(); //Math.max(.1, d.magnitude());
            let direction = ( (d.magnitude()>0) ? d : Point.random(1) ).normalize();

            // BUG:
            // since things oscillate wildly for hub nodes, should probably normalize spring
            // forces by the number of incoming edges for each node. naive normalization 
            // doesn't work very well though. what's the `right' way to do it?

            // apply force to each end point
            spring.point1.applyForce(direction.multiply(spring.k * displacement * -0.5));
            spring.point2.applyForce(direction.multiply(spring.k * displacement * 0.5));
        });
    }

    applyCenterDrift(){
        // find the centroid of all the particles in the system and shift everything
        // so the cloud is centered over the origin
        let numParticles = 0;
        let centroid = new Point(0,0);
        forEach(this.active.particles, function(point) {
            centroid.add(point.p);
            numParticles++;
        });

        if (numParticles==0) return;

        var correction = centroid.divide(-numParticles);
        forEach(this.active.particles, function(point) {
            point.applyForce(correction);
        })
    }

    applyCenterGravity(){
        // attract each node to the origin
        forEach(this.active.particles, function(point) {
            let direction = point.p.multiply(-1.0);
            point.applyForce(direction.multiply(this.repulsion / 100.0));
        });
    }

    updateVelocity(timestep){
        // translate forces to a new velocity for this particle
        let sum=0, max=0, n = 0;
        forEach(this.active.particles, function(point) {
            if (point.fixed){
                point.v = new Point(0,0);
                point.f = new Point(0,0);
                return;
            }

            if (this.integrator=='euler'){
                point.v = point.v.add(point.f.multiply(timestep)).multiply(1-this.friction);
            }
            else{
                point.v = point.v.add(point.f.add(point._F.divide(point._m)).multiply(timestep*0.5)).multiply(1-this.friction);
            }
            point.f.x = point.f.y = 0

            let speed = point.v.magnitude();
            if (speed>this.SPEED_LIMIT) point.v = point.v.divide(speed*speed);

            speed = point.v.magnitude();
            
            let e = speed*speed;
            sum += e;
            max = Math.max(e,max);
            n++;
        });
        this._energy = {sum:sum, max:max, mean:sum/n, n:n};
    }

    updatePosition(timestep){
        // translate velocity to a position delta
        let bottomright = null;
        let topleft = null;

        forEach(this.active.particles, function(point) {
            // move the node to its new position
            if (this.integrator=='euler'){
                point.p = point.p.add(point.v.multiply(timestep));
            }
            else{
                //this should follow the equation
                //x(t+1) = x(t) + v(t) * timestep + 1/2 * timestep^2 * a(t)
                let accel = point.f.multiply(0.5 * timestep * timestep).divide(point.m);
                point.p = point.p.add(point.v.multiply(timestep)).add(accel);
            }

            if (!bottomright){
                bottomright = new Point(point.p.x, point.p.y);
                topleft = new Point(point.p.x, point.p.y);
                return;
            }

            let pt = point.p;
            if (pt.x===null || pt.y===null) return;
            if (pt.x > bottomright.x) bottomright.x = pt.x;
            if (pt.y > bottomright.y) bottomright.y = pt.y;          
            if (pt.x < topleft.x)     topleft.x = pt.x;
            if (pt.y < topleft.y)     topleft.y = pt.y;
        });

        this._bounds = {topleft:topleft||new Point(-1,-1), bottomright:bottomright||new Point(1,1)};
    }

    systemEnergy(){
        // system stats
        return this._energy;
    }
}