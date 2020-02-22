'use strict';

import Colors from "./graphics/colors";
import Graphics from "./graphics/graphics";
import {Point} from "./physics/atoms";

import has from 'lodash/has';
import map from 'lodash/map';

class Renderer{
	constructor(canvas){
		this.canvas = canvas;
		this.ctx = this.canvas.getContext("2d");
		this.gfx = new Graphics(this.canvas);

		this.particleSystem = null;
		this.imagepath = './js/graphics/';

		this.selected = null;
		this.nearest = null;
		this._mouseP = null;
	}

	// helpers for figuring out where to draw arrows (thanks springy.js)
	intersect_line_line(p1, p2, p3, p4){
		let denom = ((p4.y - p3.y)*(p2.x - p1.x) - (p4.x - p3.x)*(p2.y - p1.y));
		if (denom === 0) return false // lines are parallel
		let ua = ((p4.x - p3.x)*(p1.y - p3.y) - (p4.y - p3.y)*(p1.x - p3.x)) / denom;
		let ub = ((p2.x - p1.x)*(p1.y - p3.y) - (p2.y - p1.y)*(p1.x - p3.x)) / denom;

		if (ua < 0 || ua > 1 || ub < 0 || ub > 1)  return false;
		return new Point(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
	}

	intersect_line_box(p1, p2, boxTuple){
		let p3 = {x:boxTuple[0], y:boxTuple[1]},
				w = boxTuple[2],
				h = boxTuple[3];

		let tl = {x: p3.x, y: p3.y};
		let tr = {x: p3.x + w, y: p3.y};
		let bl = {x: p3.x, y: p3.y + h};
		let br = {x: p3.x + w, y: p3.y + h};

		return this.intersect_line_line(p1, p2, tl, tr) ||
				this.intersect_line_line(p1, p2, tr, br) ||
				this.intersect_line_line(p1, p2, br, bl) ||
				this.intersect_line_line(p1, p2, bl, tl) ||
				false;
	}

	// Main output section
	init(system){
		this.particleSystem = system;
		this.particleSystem.screenSize(this.canvas.width, this.canvas.height);
		this.particleSystem.screenPadding(25, 50);

		this.initMouseHandling();

		// Preload all images into the node object
		this.particleSystem.eachNode(function(node) {
			if(node.data.image) {
				node.data.imageob = new Image();
				node.data.imageob.src = this.imagepath + node.data.image;
			}
		});
	}

	redraw(){
		if (!this.particleSystem) return;
		let gfx = this.gfx;

		gfx.clear(); // convenience ƒ: clears the whole canvas rect

		// draw the nodes & save their bounds for edge drawing
		let nodeBoxes = {};
		

		// draw the edges
		this.particleSystem.eachEdge(function(edge, pt1, pt2){
			// edge: {source:Node, target:Node, length:#, data:{}}
			// pt1:  {x:#, y:#}  source position in screen coords
			// pt2:  {x:#, y:#}  target position in screen coords

			// Don't draw lines that shouldn't be there
			if (edge.source.data.alpha * edge.target.data.alpha == 0) return;
			gfx.line(edge._id, pt1, pt2, {stroke:Colors.CSS.gray, width:1, alpha:edge.target.data.alpha});
		}.bind(this));
		
		// draw the nodes
		this.particleSystem.eachNode(function(node, pt){
			// node: {mass:#, p:{x,y}, name:"", data:{}}
			// pt:   {x:#, y:#}  node position in screen coords

			// Hide hidden nodes
			if (node.data.alpha===0) return;

			// Load extra info
			let imageob = node.data.imageob;
			let imageH = node.data.image_h;
			let imageW = node.data.image_w;
			let radius = parseInt(node.data.radius);
			// determine the box size and round off the coords if we'll be 
			// drawing a text label (awful alignment jitter otherwise...)
			let label = node.data.label||"";
			let w = this.ctx.measureText(""+label).width + 10;
			if(w < radius) {
				w = radius;
			}
			if (!(""+label).match(/^[ \t]*$/)){
				pt.x = Math.floor(pt.x);
				pt.y = Math.floor(pt.y);
			}
			else{
				label = null;
			}

			// Set colour
			if (node.data.color) this.ctx.fillStyle = node.data.color;
			else this.ctx.fillStyle = "rgba(0,0,0,.2)";

			if (node.data.color=='none') this.ctx.fillStyle = "white";

			// Draw the object
			if (node.data.shape=='dot'){
				// Check if it's a dot
				this.gfx.oval(node._id, pt.x-w/2, pt.y-w/2, w,w, {fill:this.ctx.fillStyle, alpha:node.data.alpha});
				nodeBoxes[node.name] = [pt.x-w/2, pt.y-w/2, w,w];
				// Does it have an image?
				if (imageob){
					// Images are cached 
					this.ctx.drawImage(imageob, pt.x-(imageW/2), pt.y-radius/4, imageW, imageH);
				}
			}
			else {
				// If none of the above, draw a rectangle
				this.gfx.rect(node._id, pt.x-w/2, pt.y-10, w,20, 4, {fill:this.ctx.fillStyle, alpha:node.data.alpha});
				nodeBoxes[node.name] = [pt.x-w/2, pt.y-11, w, 22];
			}

			// Draw the text
			if (label){
				this.ctx.font = "12px Helvetica";
				this.ctx.textAlign = "center";
				this.ctx.fillStyle = "white";
				if (node.data.color=='none') this.ctx.fillStyle = '#333333';
				this.ctx.fillText(label||"", pt.x, pt.y+4);
			}
		}.bind(this));
	}

	// Switch for showing/hiding canvas and start/stopping system respectively
	switchMode(e){
		if (e=='hidden'){
			this.canvas.stop(true).fadeTo(e.dt,0, function(){
				if (this.particleSystem) this.particleSystem.stop();
				this.canvas.hide();
			})
		}
		else if (e=='visible'){
			this.canvas.stop(true).css('opacity',0).show().fadeTo(e.dt,1,function(){
				this.resize();
			})
			if (this.particleSystem) this.particleSystem.start();
		}
	}

	// Allows node 'highlighting' so leaf node can appear on hover of parent
	switchSection(newSection){
		let parent = this.particleSystem.getEdgesFrom(newSection)[0].source;
		let children = map(this.particleSystem.getEdgesFrom(newSection), function(edge){
			return edge.target;
		});
		
		this.particleSystem.eachNode(function(node){
			if (node.data.shape=='dot') return; // skip all but leafnodes
			let nowVisible = (has(node, children));
			let newAlpha = (nowVisible) ? 1 : 0;
			let dt = (nowVisible) ? .5 : .5;
			this.particleSystem.tweenNode(node, dt, {alpha:newAlpha});
			if (newAlpha==1){
				node.p.x = parent.p.x + 3*Math.random() - .025;
				node.p.y = parent.p.y + 3*Math.random() - .025;
				node.tempMass = .001;
			}
		});
	}

	initMouseHandling(){
		// no-nonsense drag and drop (thanks springy.js)
		let selected = null;
		let nearest = null;
		let dragged = null;

		let _section = null;

		let system = this.particleSystem;

		let handler = {
			moved:function(e){
				let pos = {
					left : this.offsetLeft,
					top : this.offsetTop
				}
				let _mouseP = new Point(e.pageX-pos.left, e.pageY-pos.top);
				nearest = system.nearest(_mouseP);

				if (!nearest.node) return false;

				if (nearest.node.data.shape!='dot'){
					selected = (nearest.distance < 50) ? nearest : null;

					if (selected){
						this.classList.add('linkable');
						// Will need to re-enable this for clickable links
						// window.status = selected.node.data.link.replace(/^\//,"http://"+window.location.host+"/").replace(/^#/,'') 
					}
					else{
						this.classList.remove('linkable');
						window.status = '';
					}
				}
				else if (has(nearest.node.name, ['python', 'java','android','web','cplus'])){
					if (nearest.node.name!=_section){
						_section = nearest.node.name;
						this.switchSection(_section);
					}
					this.classList.remove('linkable');
					window.status = ''
				}
				
				return false;
			},

			clicked:function(e){
				let pos = {
					left : this.offsetLeft,
					top: this.offsetTop
				};
				let _mouseP = new Point(e.pageX-pos.left, e.pageY-pos.top);
				nearest = dragged = system.nearest(_mouseP);

				if (nearest && selected && nearest.node===selected.node){
					if (selected.node.data.link) {
						let link = selected.node.data.link;
						// TODO In case we want to navigate internally to another element
						// Figure out considerations here
						// if (link.match(/^#/)){
						// 	$(that).trigger({type:"navigate", path:link.substr(1)})
						// }
						// else{
							window.location = link;
						// }
						return false;
					}
				}

				if (dragged && dragged.node !== null) {
					// while we're dragging, don't let physics move the node
					dragged.node.fixed = true;
				}
				this.removeEventListener('mousemove', handler.moved);
				this.addEventListener('mousemove', handler.dragged);

				return false;
			},

			dragged:function(e){
				let pos = {
					left : this.offsetLeft,
					top: this.offsetTop
				};
				let s = new Point(e.pageX-pos.left, e.pageY-pos.top);

				if (!nearest) return;
				if (dragged !== null && dragged.node !== null){
					let p = system.fromScreen(s);
					dragged.node.p = p;
				}

				return false;
			},

			dropped:function(){
				if (dragged===null || dragged.node===undefined) return;
				if (dragged.node !== null) dragged.node.fixed = false;
				dragged.node.tempMass = 1000;
				dragged = null;
				this.removeEventListener('mousemove', handler.dragged);
				this.addEventListener('mousemove', handler.moved);
				this._mouseP = null;
				return false;
			}
		}

		this.canvas.addEventListener('mousedown', handler.clicked);
		this.canvas.addEventListener('mousemove', handler.moved);
	}
}

export default Renderer;