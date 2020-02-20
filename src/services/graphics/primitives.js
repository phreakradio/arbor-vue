//
//  primitives
//
//  Created by Christian Swinehart on 2010-12-08.
//  Copyright (c) 2011 Samizdat Drafting Co. All rights reserved.
//
//  Ported by Dmytro Malaniouk on 2020-01-30.
//

import assign from 'lodash/assign';
import forEach from 'lodash/forEach';
import has from 'lodash/has';
import isArray from 'lodash/isArray';
import mergeWith from'lodash/mergeWith';

import Colors from './colors';

// let Oval;
// let Rectangle;
// let Path;
// let Color;

class Primitives{
    constructor(ctx, _drawStyle, _fontStyle){
        this.ctx = ctx;
        this._drawStyle = _drawStyle;
        this._fontStyle = _fontStyle;
    }

    Oval = class Oval extends Primitives{
        constructor(x,y,w,h,style){
            super();
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.style = (style!==undefined) ? style : {};
        }

        draw(overrideStyle){
            this._draw(overrideStyle);
        }

        _draw(x,y,w,h, style){
            if (has(x, ['stroke', 'fill', 'width'])) style = x;
            if (this.x!==undefined){
                x=this.x, y=this.y, w=this.w, h=this.h;
                style = mergeWith(this.style, style);
            }
            style = mergeWith(this._drawStyle, style);
            if (!style.stroke && !style.fill) return;

            var kappa = .5522848,
                ox = (w / 2) * kappa, // control point offset horizontal
                oy = (h / 2) * kappa, // control point offset vertical
                xe = x + w,           // x-end
                ye = y + h,           // y-end
                xm = x + w / 2,       // x-middle
                ym = y + h / 2;       // y-middle

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(x, ym);
            this.ctx.bezierCurveTo(x, ym - oy, xm - ox, y, xm, y);
            this.ctx.bezierCurveTo(xm + ox, y, xe, ym - oy, xe, ym);
            this.ctx.bezierCurveTo(xe, ym + oy, xm + ox, ye, xm, ye);
            this.ctx.bezierCurveTo(xm - ox, ye, x, ym + oy, x, ym);
            this.ctx.closePath();

            if (style.fill!==null){
                if (style.alpha!==undefined) this.ctx.fillStyle = Colors.blend(style.fill, style.alpha);
                else this.ctx.fillStyle = Colors.encode(style.fill);
                this.ctx.fill();
            }

            if (style.stroke!==null){
                this.ctx.strokeStyle = Colors.encode(style.stroke);
                if (!isNaN(style.width)) this.ctx.lineWidth = style.width;
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
    }

    Rectangle = class Rectangle extends Primitives{
        constructor(x,y,w,h,r,style){
            super();
            if (has(r, ['stroke', 'fill', 'width'])){
                style = r;
                r = 0;
            }
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.r = (r!==undefined) ? r : 0;
            this.style = (style!==undefined) ? style : {};
        }

        draw(overrideStyle){
            this._draw(overrideStyle);
        }

        _draw(x,y,w,h,r,style){
            if (has(r, ['stroke', 'fill', 'width', 'alpha'])){
                style = r; r=0;
            }
            else if (has(x, ['stroke', 'fill', 'width', 'alpha'])){
                style = x;
            }
            if (this.x!==undefined){
                x=this.x, y=this.y, w=this.w, h=this.h;
                style = mergeWith(this.style, style);
            }
            style = mergeWith(this._drawStyle, style);
            if (!style.stroke && !style.fill) return;

            let rounded = (r>0);
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(x+r, y);
            this.ctx.lineTo(x+w-r, y);

            if (rounded) this.ctx.quadraticCurveTo(x+w, y, x+w, y+r);
            this.ctx.lineTo(x+w, y+h-r);
            if (rounded) this.ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
            this.ctx.lineTo(x+r, y+h);
            if (rounded) this.ctx.quadraticCurveTo(x, y+h, x, y+h-r);
            this.ctx.lineTo(x, y+r);
            if (rounded) this.ctx.quadraticCurveTo(x, y, x+r, y);      

            if (style.fill!==null){
                if (style.alpha!==undefined) this.ctx.fillStyle = Colors.blend(style.fill, style.alpha);
                else this.ctx.fillStyle = Colors.encode(style.fill);
                this.ctx.fill();
            }

            if (style.stroke!==null){
                this.ctx.strokeStyle = Colors.encode(style.stroke);
                if (!isNaN(style.width)) this.ctx.lineWidth = style.width;
                this.ctx.stroke();
            }
            this.ctx.restore();
        }
    }

    Path = class Path extends Primitives{
        constructor(x1, y1, x2, y2, style){
            super();
            // calling patterns:
            // ƒ( x1, y1, x2, y2, <style> )
            // ƒ( {x:1, y:1}, {x:2, y:2}, <style> )
            // ƒ( [ {x:1, y:1}, {x:2, y:2}, ...], <style> ) one continuous line
            // ƒ( [ [{x,y}, {x,y}], [{x,y}, {x,y}], ...], <style> ) separate lines

            if (style!==undefined || typeof y2=='number'){
                // ƒ( x1, y1, x2, y2, <style> )
                this.points = [ {x:x1,y:y1}, {x:x2,y:y2} ];
                this.style = style || {};
            }
            else if (isArray(x1)){
                // ƒ( [ {x:1, y:1}, {x:2, y:2}, ...], <style> )
                this.points = x1;
                this.style = y1 || {};
            }
            else{
                // ƒ( {x:1, y:1}, {x:2, y:2}, <style> )
                this.points = [ x1, y1 ];
                this.style = x2 || {};
            }        
        }

        draw(overrideStyle){
            if (this.points.length<2) return;

            var sublines = [];
            if (!isArray(this.points[0])) sublines.push(this.points);
            else sublines = this.points;
            
            this.ctx.save();
            this.ctx.beginPath();
            let tmp = this.ctx;
            forEach(sublines, function(lineseg){
                tmp.moveTo(lineseg[0].x+.5, lineseg[0].y+.5);
                forEach(lineseg, function(pt, i){
                    if (i==0) return;
                    tmp.lineTo(pt.x+.5, pt.y+.5);
                });
            });

            var style = assign(mergeWith(this._drawStyle, this.style), overrideStyle);
            if (style.closed) this.ctx.closePath();

            if (style.fill!==undefined){
                var fillColor = Colors.decode(style.fill, (style.alpha!==undefined) ? style.alpha : 1);
                if (fillColor) this.ctx.fillStyle = Colors.encode(fillColor);
                this.ctx.fill();
            }

            if (style.stroke!==undefined){
                var strokeColor = Colors.decode(style.stroke, (style.alpha!==undefined) ? style.alpha : 1);
                if (strokeColor) this.ctx.strokeStyle = Colors.encode(strokeColor);
                if (!isNaN(style.width)) this.ctx.lineWidth = style.width;
                this.ctx.stroke();
            }
            this.ctx.restore();
        }    
    }

    Color = class Color extends Primitives{
        constructor(a,b,c,d){
            super();
            let rgba = Colors.decode(a,b,c,d);
            if (rgba){
                this.r = rgba.r;
                this.g = rgba.g;
                this.b = rgba.b;
                this.a = rgba.a;
            }
        }
        toString(){
            return Colors.encode(this);
        }
    }
}

export default Primitives;