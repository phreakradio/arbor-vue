//
// system.js
//
// the main controller object for creating/modifying graphs 
//
//  Ported by Dmytro Malaniouk on 2020-01-30.
//

import cloneDeep from 'lodash/cloneDeep';
import forEach from 'lodash/forEach';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';

class ParticleSystem{
    constructor(repulsion, stiffness, friction, centerGravity, targetFps, dt, precision, integrator){
        this._changes=[];
        this._notification=null;
        this._epoch = 0;

        this._screenSize = null;
        this._screenStep = .04;
        this._screenPadding = [20,20,20,20];
        this._bounds = null;
        this._boundsTarget = null;

        if (typeof repulsion=='object'){
            let _p = repulsion;
            this.friction = _p.friction;
            this.repulsion = _p.repulsion;
            this.targetFps = _p.fps;
            this.dt = _p.dt;
            this.stiffness = _p.stiffness;
            this.centerGravity = _p.gravity;
            this.precision = _p.precision;
            this.integrator = _p.integrator;
        }

        // param validation and defaults
        if (integrator!='verlet' && integrator!='euler') this.integrator='verlet';
        this.friction = isNaN(this.friction) ? .5 : this.friction;
        this.repulsion = isNaN(this.repulsion) ? 1000 : this.repulsion;
        this.targetFps = isNaN(this.targetFps) ? 55 : this.targetFps;
        this.stiffness = isNaN(this.stiffness) ? 600 : this.stiffness;
        this.dt = isNaN(this.dt) ? 0.02 : this.dt;
        this.precision = isNaN(this.precision) ? .6 : this.precision;
        this.centerGravity = (this.centerGravity===true);

        this._systemTimeout = (this.targetFps!==undefined) ? 1000/this.targetFps : 1000/50;
        this._parameters = {
            integrator:this.integrator, 
            repulsion:this.repulsion, 
            stiffness:this.stiffness, 
            friction:this.friction, 
            dt:this.dt, 
            gravity:this.centerGravity, 
            precision:this.precision, 
            timeout:this._systemTimeout
        };
        this._energy;

        this.state = {
            renderer:null, // this is set by the library user
            tween:null, // gets filled in by the Kernel
            nodes:{}, // lookup based on node _id's from the worker
            edges:{}, // likewise
            adjacency:{}, // {name1:{name2:{}, name3:{}}}
            names:{}, // lookup table based on 'name' field in data objects
            kernel: null
        };
    }

    parameters(newParams){
        if (newParams!==undefined){
            if (!isNaN(newParams.precision)){
                newParams.precision = Math.max(0, Math.min(1, newParams.precision))
            }
            forEach(this._parameters, function(p, v){
                if (newParams[p]!==undefined) this._parameters[p] = newParams[p];
            })
            this.state.kernel.physicsModified(newParams);
        }
        return this._parameters;
    }

    fps(newFPS){
        if (newFPS===undefined) return this.state.kernel.fps();
        else this.parameters({timeout:1000/(newFPS||50)});
    }

    start(){
        this.state.kernel.start();
    }

    stop(){
        this.state.kernel.stop();
    }

    addNode(name, data){
        data = data || {};
        let priorNode = this.state.names[name];
        if (priorNode){
            priorNode.data = data;
            return priorNode;
        }
        else if (name!=undefined){
            // the data object has a few magic fields that are actually used
            // by the simulation:
            //   'mass' overrides the default of 1
            //   'fixed' overrides the default of false
            //   'x' & 'y' will set a starting position rather than 
            //             defaulting to random placement
            let x = (data.x!=undefined) ? data.x : null;
            let y = (data.y!=undefined) ? data.y : null;
            let fixed = (data.fixed) ? 1 : 0;

            let node = new Node(data);
            node.name = name;
            this.state.names[name] = node;
            this.state.nodes[node._id] = node;

            this._changes.push({t:"addNode", id:node._id, m:node.mass, x:x, y:y, f:fixed});
            this._notify();
            return node;
        }
    }

    // remove a node and its associated edges from the graph
    pruneNode(nodeOrName) {
        let node = this.getNode(nodeOrName);

        if (typeof(this.state.nodes[node._id]) !== 'undefined'){
            delete this.state.nodes[node._id];
            delete this.state.names[node.name];
        }

        forEach(state.edges, function(e){
            if (e.source._id === node._id || e.target._id === node._id){
                this.pruneEdge(e);
            }
        }.bind(this));

        this._changes.push({t:"dropNode", id:node._id});
        this._notify();
    }

    getNode(nodeOrName){
        if (nodeOrName._id!==undefined){
            return nodeOrName;
        }
        else if (typeof nodeOrName=='string' || typeof nodeOrName=='number'){
            return this.state.names[nodeOrName];
        }
        // otherwise let it return undefined
    }

    eachNode(callback){
        // callback should accept two arguments: Node, Point
        forEach(state.nodes, function(n){
            if (n._p.x==null || n._p.y==null) return;
            let pt = (this._screenSize!==null) ? this.toScreen(n._p) : n._p;
            callback.call(this, n, pt);
        });
    }

    addEdge(source, target, data){
        source = this.getNode(source) || this.addNode(source);
        target = this.getNode(target) || this.addNode(target);
        data = data || {};
        let edge = new Edge(source, target, data);

        let src = source._id;
        let dst = target._id;
        this.state.adjacency[src] = this.state.adjacency[src] || {};
        this.state.adjacency[src][dst] = this.state.adjacency[src][dst] || [];

        let exists = (this.state.adjacency[src][dst].length > 0);
        if (exists){
            // probably shouldn't allow multiple edges in same direction
            // between same nodes? for now just overwriting the data...
            $.extend(this.state.adjacency[src][dst].data, edge.data)
            return;
        }
        else{
            this.state.edges[edge._id] = edge;
            this.state.adjacency[src][dst].push(edge);
            let len = (edge.length!==undefined) ? edge.length : 1;
            this._changes.push({t:"addSpring", id:edge._id, fm:src, to:dst, l:len});
            this._notify();
        }

        return edge;
    }

    // remove an edge and its associated lookup entries
    pruneEdge(edge) {
        this._changes.push({t:"dropSpring", id:edge._id});
        delete this.state.edges[edge._id];

        for (var x in this.state.adjacency){
            for (var y in this.state.adjacency[x]){
                let edges = this.state.adjacency[x][y];

                for (var j=edges.length - 1; j>=0; j--)  {
                    if (state.adjacency[x][y][j]._id === edge._id){
                        state.adjacency[x][y].splice(j, 1);
                    }
                }
            }
        }

        this._notify();
    }

    // find the edges from node1 to node2
    getEdges(node1, node2) {
        node1 = this.getNode(node1);
        node2 = this.getNode(node2);
        if (!node1 || !node2) return [];

        if (typeof(this.state.adjacency[node1._id]) !== 'undefined'
            && typeof(this.state.adjacency[node1._id][node2._id]) !== 'undefined'){
            return this.state.adjacency[node1._id][node2._id];
        }

        return [];
    }

    getEdgesFrom(node) {
        node = this.getNode(node);
        if (!node) return [];

        if (typeof(this.state.adjacency[node._id]) !== 'undefined'){
            let nodeEdges = [];
            forEach(this.state.adjacency[node._id], function(subEdges){
                nodeEdges = nodeEdges.concat(subEdges);
            });
            return nodeEdges;
        }

        return [];
    }

    getEdgesTo(node) {
        node = this.getNode(node);
        if (!node) return [];

        let nodeEdges = [];
        forEach(state.edges, function(edge){
            if (edge.target == node) nodeEdges.push(edge);
        });
        
        return nodeEdges;
    }

    eachEdge(callback){
        // callback should accept two arguments: Edge, Point
        forEach(state.edges, function(e){
            let p1 = this.state.nodes[e.source._id]._p;
            let p2 = this.state.nodes[e.target._id]._p;

            if (p1.x==null || p2.x==null) return;

            p1 = (this._screenSize!==null) ? this.toScreen(p1) : p1;
            p2 = (this._screenSize!==null) ? this.toScreen(p2) : p2;

            if (p1 && p2) callback.call(e, p1, p2);
        }.bind(this));
    }

    prune(callback){
        // callback should be of the form ƒ(node, {from:[],to:[]})

        let changes = {dropped:{nodes:[], edges:[]}};

        if (callback===undefined){
            forEach(state.nodes, function(node){
                this.changes.dropped.nodes.push(node);
                this.pruneNode(node);
            });
        }
        else{
            this.eachNode(function(node){
                let drop = callback.call(node, {from:this.getEdgesFrom(node), to:this.getEdgesTo(node)});
                if (drop){
                    this.changes.dropped.nodes.push(node);
                    this.pruneNode(node);
                }
            })
        }
        // trace('prune', changes.dropped)
        return changes;
    }

    graft(branch){
        // branch is of the form: { nodes:{name1:{d}, name2:{d},...}, 
        //                          edges:{fromNm:{toNm1:{d}, toNm2:{d}}, ...} }

        let changes = {added:{nodes:[], edges:[]}};
        if (branch.nodes){
            forEach(branch.nodes, function(nodeData, name){
                let oldNode = this.getNode(name);
                // should probably merge any x/y/m data as well...
                // if (oldNode) $.extend(oldNode.data, nodeData)

                if (oldNode) oldNode.data = nodeData;
                else this.changes.added.nodes.push( this.addNode(name, nodeData) );

                this.state.kernel.start();
            }.bind(this));
        }
        
        if (branch.edges) {
            forEach(branch.edges, function(dsts, src){
                let srcNode = this.getNode(src);
                if (!srcNode) this.changes.added.nodes.push( this.addNode(src, {}) );

                forEach(dsts, function(edgeData, dst){
                    // should probably merge any x/y/m data as well...
                    // if (srcNode) $.extend(srcNode.data, nodeData)

                    // i wonder if it should spawn any non-existant nodes that are part
                    // of one of these edge requests...
                    let dstNode = this.getNode(dst);
                    if (!dstNode) this.changes.added.nodes.push( this.addNode(dst, {}) );

                    let oldEdges = this.getEdges(src, dst);
                    if (oldEdges.length>0){
                        oldEdges[0].data = edgeData;
                    }
                    else{
                        this.changes.added.edges.push( this.addEdge(src, dst, edgeData) );
                    }
                }.bind(this));
            }.bind(this));
        }

        return changes
    }

    merge(branch){
        let changes = {added:{nodes:[], edges:[]}, dropped:{nodes:[], edges:[]}};

        forEach(state.edges, function(edge){
            // if ((branch.edges[edge.source.name]===undefined || branch.edges[edge.source.name][edge.target.name]===undefined) &&
            //     (branch.edges[edge.target.name]===undefined || branch.edges[edge.target.name][edge.source.name]===undefined)){
            if ((branch.edges[edge.source.name]===undefined || branch.edges[edge.source.name][edge.target.name]===undefined)){
                this.pruneEdge(edge);
                this.changes.dropped.edges.push(edge);
            }
        }.bind(this));
        
        let prune_changes = this.prune(function(node, edges){
            if (branch.nodes[node.name] === undefined){
                this.changes.dropped.nodes.push(node);
                return true;
            }
        })
        let graft_changes = this.graft(branch);
        this.changes.added.nodes = this.changes.added.nodes.concat(graft_changes.added.nodes);
        this.changes.added.edges = this.changes.added.edges.concat(graft_changes.added.edges);
        this.changes.dropped.nodes = this.changes.dropped.nodes.concat(prune_changes.dropped.nodes);
        this.changes.dropped.edges = this.changes.dropped.edges.concat(prune_changes.dropped.edges);
        
        return changes;
    }

    tweenNode(nodeOrName, dur, to){
        let node = this.getNode(nodeOrName);
        if (node) this.state.tween.to(node, dur, to);
    }

    tweenEdge(a,b,c,d){
        if (d===undefined){
            // called with (edge, dur, to)
            this._tweenEdge(a,b,c);
        }
        else{
            // called with (node1, node2, dur, to)
            let edges = this.getEdges(a,b);
            forEach(edges, function(edge){
                this._tweenEdge(edge, c, d);
            }.bind(this));
        }
    }

    _tweenEdge(edge, dur, to){
        if (edge && edge._id!==undefined) this.state.tween.to(edge, dur, to);
    }

    _updateGeometry(e){
        if (e != undefined){
            let stale = (e.epoch<this._epoch);

            this._energy = e.energy;
            let pts = e.geometry; // an array of the form [id1,x1,y1, id2,x2,y2, ...]
            if (pts!==undefined){
                for (var i=0, j=pts.length/3; i<j; i++){
                    var id = pts[3*i];

                    // canary silencer...
                    if (stale && this.state.nodes[id]==undefined) continue;
                    this.state.nodes[id]._p.x = pts[3*i + 1];
                    this.state.nodes[id]._p.y = pts[3*i + 2];
                }
            }
        }
    }

    // convert to/from screen coordinates
    screen(opts){
        if (opts == undefined) return {size:(this._screenSize)? objcopy(_screenSize) : undefined, 
                                       padding:_screenPadding.concat(), 
                                       step:_screenStep};
        if (opts.size!==undefined) this.screenSize(opts.size.width, opts.size.height);
        if (!isNaN(opts.step)) this.screenStep(opts.step);
        if (opts.padding!==undefined) this.screenPadding(opts.padding);
    }

    screenSize(canvasWidth, canvasHeight){
        this._screenSize = {width:canvasWidth,height:canvasHeight};
        this._updateBounds();
    }

    screenPadding(t,r,b,l){
        if (isArray(t)) trbl = t;
        else trbl = [t,r,b,l];

        let top = trbl[0];
        let right = trbl[1];
        let bot = trbl[2];
        if (right===undefined) trbl = [top,top,top,top];
        else if (bot==undefined) trbl = [top,right,top,right]

        this._screenPadding = trbl;
    }

    screenStep(stepsize){
        this._screenStep = stepsize;
    }

    toScreen(p) {
        if (!this._bounds || !this._screenSize) return;
        // trace(p.x, p.y)

        let _padding = this._screenPadding || [0,0,0,0];
        let size = this._bounds.bottomright.subtract(this._bounds.topleft);
        let sx = _padding[3] + p.subtract(this._bounds.topleft).divide(size.x).x * (this._screenSize.width - (_padding[1] + _padding[3]));
        let sy = _padding[0] + p.subtract(this._bounds.topleft).divide(size.y).y * (this._screenSize.height - (_padding[0] + _padding[2]));

        // return arbor.Point(Math.floor(sx), Math.floor(sy))
        return new Point(sx, sy);
    }

    fromScreen(s) {
        if (!this._bounds || !this._screenSize) return;

        let _padding = this._screenPadding || [0,0,0,0];
        let size = this._bounds.bottomright.subtract(this._bounds.topleft);
        let px = (s.x-_padding[3]) / (this._screenSize.width-(_padding[1]+_padding[3]))  * size.x + this._bounds.topleft.x;
        var py = (s.y-_padding[0]) / (this._screenSize.height-(_padding[0]+_padding[2])) * size.y + this._bounds.topleft.y;

        return new Point(px, py);
    }

    _updateBounds(newBounds){
        // step the renderer's current bounding box closer to the true box containing all
        // the nodes. if _screenStep is set to 1 there will be no lag. if _screenStep is
        // set to 0 the bounding box will remain stationary after being initially set 
        if (this._screenSize===null) return;

        if (newBounds) this._boundsTarget = newBounds;
        else this._boundsTarget = this.bounds();

        // _boundsTarget = newBounds || that.bounds()
        // _boundsTarget.topleft = new Point(_boundsTarget.topleft.x,_boundsTarget.topleft.y)
        // _boundsTarget.bottomright = new Point(_boundsTarget.bottomright.x,_boundsTarget.bottomright.y)

        let bottomright = new Point(this._boundsTarget.bottomright.x, this._boundsTarget.bottomright.y);
        let topleft = new Point(this._boundsTarget.topleft.x, this._boundsTarget.topleft.y);
        let dims = bottomright.subtract(topleft);
        let center = topleft.add(dims.divide(2));


        let MINSIZE = 4;                                   // perfect-fit scaling
        // MINSIZE = Math.max(Math.max(MINSIZE,dims.y), dims.x) // proportional scaling

        let size = new Point(Math.max(dims.x,MINSIZE), Math.max(dims.y,MINSIZE));
        this._boundsTarget.topleft = center.subtract(size.divide(2));
        this._boundsTarget.bottomright = center.add(size.divide(2));

        if (!this._bounds){
            if (isEmpty(state.nodes)) return false;
            this._bounds = _boundsTarget;
            return true;
        }

        // var stepSize = (Math.max(dims.x,dims.y)<MINSIZE) ? .2 : _screenStep
        var stepSize = this._screenStep;
        _newBounds = {
            bottomright: this._bounds.bottomright.add( this._boundsTarget.bottomright.subtract(this._bounds.bottomright).multiply(stepSize) ),
            topleft: this._bounds.topleft.add( this._boundsTarget.topleft.subtract(this._bounds.topleft).multiply(stepSize) )
        };
        
        // return true if we're still approaching the target, false if we're ‘close enough’
        let diff = new Point(this._bounds.topleft.subtract(_newBounds.topleft).magnitude(), this._bounds.bottomright.subtract(_newBounds.bottomright).magnitude());
        if (diff.x*this._screenSize.width>1 || diff.y*this._screenSize.height>1){
            this._bounds = _newBounds;
            return true;
        }
        else{
            return false;
        }
    }

    energy(){
        return this._energy;
    }

    bounds(){
        //  TL   -1
        //     -1   1
        //        1   BR
        let bottomright = null;
        let topleft = null;

        // find the true x/y range of the nodes
        forEach(state.nodes, function(node){
            if (!bottomright){
                bottomright = new Point(node._p);
                topleft = new Point(node._p);
                return;
            }
            let point = node._p;
            if (point.x===null || point.y===null) return;
            if (point.x > bottomright.x) bottomright.x = point.x;
            if (point.y > bottomright.y) bottomright.y = point.y;
            if (point.x < topleft.x)   topleft.x = point.x;
            if (point.y < topleft.y)   topleft.y = point.y;
        });

        // return the true range then let to/fromScreen handle the padding
        if (bottomright && topleft){
            return {bottomright: bottomright, topleft: topleft};
        }
        else{
            return {topleft: new Point(-1,-1), bottomright: new Point(1,1)};
        }
    }

    // Find the nearest node to a particular position
    nearest(pos){
        if (this._screenSize!==null) pos = this.fromScreen(pos);
        // if screen size has been specified, presume pos is in screen pixel
        // units and convert it back to the particle system coordinates

        let min = {node: null, point: null, distance: null};
        var t = that;
        
        forEach(state.nodes, function(node){
            let pt = node._p;
            if (pt.x===null || pt.y===null) return;
            let distance = pt.subtract(pos).magnitude();
            if (min.distance === null || distance < min.distance){
                min = {node: node, point: pt, distance: distance};
            if (this._screenSize!==null) min.screenPoint = this.toScreen(pt);
          }
        }.bind(this));

        if (min.node){
            if (this._screenSize!==null) min.distance = this.toScreen(min.node.p).subtract(this.toScreen(pos)).magnitude();
                return min;
        }
        else{
            return null;
        }
    }

    _notify() {
        // pass on graph changes to the physics object in the worker thread
        // (using a short timeout to batch changes)
        if (this._notification===null) this._epoch++;
        else clearTimeout(this._notification);
        
        this._notification = setTimeout(this._synchronize,20);
    }

    _synchronize(){
        if (this._changes.length>0){
            this.state.kernel.graphChanged(this._changes);
            this._changes = [];
            this._notification = null;
        }
    }


}
    
  //   state.kernel = Kernel(that)
  //   state.tween = state.kernel.tween || null
    
  //   // some magic attrs to make the Node objects phone-home their physics-relevant changes
  //   Node.prototype.__defineGetter__("p", function() { 
  //     var self = this
  //     var roboPoint = {}
  //     roboPoint.__defineGetter__('x', function(){ return self._p.x; })
  //     roboPoint.__defineSetter__('x', function(newX){ state.kernel.particleModified(self._id, {x:newX}) })
  //     roboPoint.__defineGetter__('y', function(){ return self._p.y; })
  //     roboPoint.__defineSetter__('y', function(newY){ state.kernel.particleModified(self._id, {y:newY}) })
  //     roboPoint.__proto__ = Point.prototype
  //     return roboPoint
  //   })
  //   Node.prototype.__defineSetter__("p", function(newP) { 
  //     this._p.x = newP.x
  //     this._p.y = newP.y
  //     state.kernel.particleModified(this._id, {x:newP.x, y:newP.y})
  //   })

  //   Node.prototype.__defineGetter__("mass", function() { return this._mass; });
  //   Node.prototype.__defineSetter__("mass", function(newM) { 
  //     this._mass = newM
  //     state.kernel.particleModified(this._id, {m:newM})
  //   })

  //   Node.prototype.__defineSetter__("tempMass", function(newM) { 
  //     state.kernel.particleModified(this._id, {_m:newM})
  //   })
      
  //   Node.prototype.__defineGetter__("fixed", function() { return this._fixed; });
  //   Node.prototype.__defineSetter__("fixed", function(isFixed) { 
  //     this._fixed = isFixed
  //     state.kernel.particleModified(this._id, {f:isFixed?1:0})
  //   })
    
  //   return that
  // }
  