//
// atoms.js
//
// particle system- or physics-related datatypes
//
//  Ported by Dmytro Malaniouk on 2020-01-30.
//
let _nextNodeId = 1;
class Node{
    constructor(data){
        this._id = _nextNodeId++; // simple ints to allow the Kernel & ParticleSystem to chat
        this.data = data || {};  // the user-serviceable parts
        this._mass = (data.mass!==undefined) ? data.mass : 1;
        this._fixed = (data.fixed===true) ? true : false;
        this._p = new Point((typeof(data.x)=='number') ? data.x : null, 
                         (typeof(data.y)=='number') ? data.y : null);
        delete this.data.x;
        delete this.data.y;
        delete this.data.mass;
        delete this.data.fixed;
    }
}

let _nextEdgeId = -1;
class Edge{
    constructor(source, target, data){
        this._id = _nextEdgeId--;
        this.source = source;
        this.target = target;
        this.length = (data.length!==undefined) ? data.length : 1;
        this.data = (data!==undefined) ? data : {};
        delete this.data.length;
    }
}

class Particle{
    constructor(position, mass){
        this.p = position;
        this.m = mass;
        this.v = new Point(0, 0); // velocity
        this.f = new Point(0, 0); // force
    }

    applyForce(force){
        this.f = this.f.add(force.divide(this.m));
    }
}

class Spring{
    constructor(point1, point2, length, k){
        this.point1 = point1; // a particle
        this.point2 = point2; // another particle
        this.length = length; // spring length at rest
        this.k = k;           // stiffness
    }

    distanceToParticle(point){
        // see http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment/865080#865080
        let n = this.point2.p.subtract(this.point1.p).normalize().normal();
        let ac = point.p.subtract(this.point1.p);
        return Math.abs(ac.x * n.x + ac.y * n.y);
    }
}

class Point{
    constructor(x, y){
        if (x && x.hasOwnProperty('y')){
            y = x.y; x=x.x;
        }
        this.x = x;
        this.y = y;
    }

    exploded(){
        return ( isNaN(this.x) || isNaN(this.y) );
    }

    add(v2){
        return new Point(this.x + v2.x, this.y + v2.y);
    }

    subtract(v2){
        return new Point(this.x - v2.x, this.y - v2.y);
    }

    multiply(n){
        return new Point(this.x*n, this.y*n);
    }

    divide(n){
        return new Point(this.x/n, this.y/n);
    }

    magnitude(){
        return Math.sqrt(this.x*this.x + this.y*this.y);
    }

    normal(){
        return new Point(-this.y, this.x);
    }

    normalize(){
        return this.divide(this.magnitude());
    }

    random(radius){
        radius = (radius!==undefined) ? radius : 5;
        this.x = 2*radius * (Math.random() - 0.5);
        this.y = 2*radius* (Math.random() - 0.5);
        return this;        
    }
}

export {Node, Edge, Particle, Spring, Point};