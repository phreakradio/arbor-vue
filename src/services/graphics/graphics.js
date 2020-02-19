//
//  graphics.js
//
//  Created by Christian Swinehart on 2010-12-07.
//  Copyright (c) 2011 Samizdat Drafting Co. All rights reserved.
//
//  Ported by Dmytro Malaniouk on 2020-01-30.
//
import cloneDeep from 'lodash/cloneDeep';
import forEach from 'lodash/forEach';
import isEmpty from 'lodash/isEmpty';
import mergeWith from 'lodash/mergeWith';

import Colors from './colors';
import Primitives from './primitives';

const nano = (template, data) => {
    return template.replace(/\{([\w\-.]*)}/g, function(str, key){
        var keys = key.split("."), value = data[keys.shift()];
        forEach(keys, function(k){ 
            if (value.hasOwnProperty(k)) value = value[k];
            else value = str;
        });
        return value;
    });
};

class Graphics{
    constructor(canvas){
        this.dom = canvas;
        this.ctx = this.dom.getContext('2d');

        this._bounds = null;

        this._colorMode = "rgb"; // vs hsb
        this._coordMode = "origin"; // vs "center"

        this._drawLibrary = {};
        this._drawStyle = {
            background:null,
            fill:null, 
            stroke:null,
            width:0
        };

        this._fontLibrary = {};
        this._fontStyle = {
            font:"sans-serif",
            size:12,
            align:"left",
            color:Colors.decode("black"),
            alpha:1,
            baseline:"ideographic"
        };

        this._lineBuffer = []; // calls to .lines sit here until flushed by .drawlines

        ///MACRO:primitives-start
        this.primitives = new Primitives(this.ctx, this._drawStyle, this._fontStyle);
        this._Oval = this.primitives.Oval;
        this._Rect = this.primitives.Rect;
        this._Color = this.primitives.Color;
        this._Path = this.primitives.Path;
        ///MACRO:primitives-end            
    }

    // canvas-wide settings
    size(width,height){
        if (!isNaN(width) && !isNaN(height)){
            this.dom.attr({width:width,height:height});
        }
        return { width:this.dom.attr('width'), height:this.dom.attr('height') };
    }

    clear(x,y,w,h){
        if(arguments.length<4){
            x=0; y=0;
            w=this.dom.attr('width');
            h=this.dom.attr('height');
        }

        this.ctx.clearRect(x,y,w,h);
        if (this._drawStyle.background!==null){
            this.ctx.save();
            this.ctx.fillStyle = Colors.encode(this._drawStyle.background);
            this.ctx.fillRect(x,y,w,h);
            this.ctx.restore();
        }
    }

    background(a,b,c,d){
        if (a==null){
            this._drawStyle.background = null;
            return null;
        }

        var fillColor = Colors.decode(a,b,c,d);
        if (fillColor){
            this._drawStyle.background = fillColor;
            this.clear();
        }
    }

    // drawing to screen
    noFill(){
        this._drawStyle.fill = null;
    }

    fill(a,b,c,d){
        if (arguments.length==0){
            return this._drawStyle.fill;
        }
        else if (arguments.length>0){
            let fillColor = Colors.decode(a,b,c,d);
            this._drawStyle.fill = fillColor;
            this.ctx.fillStyle = Colors.encode(fillColor);
        }
    }
    
    noStroke(){
        this._drawStyle.stroke = null;
        this.ctx.strokeStyle = null;
    }

    stroke(a,b,c,d){
        if (arguments.length==0 && this._drawStyle.stroke!==null){
            return this._drawStyle.stroke;
        }
        else if (arguments.length>0){
            var strokeColor = Colors.decode(a,b,c,d);
            this._drawStyle.stroke = strokeColor;
            this.ctx.strokeStyle = Colors.encode(strokeColor);
        }
    }

    strokeWidth(ptsize){
        if (ptsize===undefined) return this.ctx.lineWidth;
        this.ctx.lineWidth = this._drawStyle.width = ptsize;
    }
    
    Color(clr){
        return new this._Color(clr);
    }

    drawStyle(style){
        // without arguments, show the current state
        if (arguments.length==0) return cloneDeep(this._drawStyle);

        // if this is a ("stylename", {style}) invocation, don't change the current
        // state but add it to the library
        if (arguments.length==2){
            var styleName = arguments[0];
            var styleDef = arguments[1];
            if (typeof styleName=='string' && typeof styleDef=='object'){
                var newStyle = {};
                if (styleDef.color!==undefined){
                    var textColor = Colors.decode(styleDef.color);
                    if (textColor) newStyle.color = textColor;
                }

                forEach('background fill stroke width'.split(' '), function(param){
                    if (styleDef[param]!==undefined) newStyle[param] = styleDef[param];
                });
                if (isEmpty(newStyle)) this._drawLibrary[styleName] = newStyle;
            }
            return;
        }

        // if a ("stylename") invocation, load up the selected style
        if (arguments.length==1 && this._drawLibrary[arguments[0]]!==undefined){
            style = this._drawLibrary[arguments[0]];
        }

        // for each of the properties specified, update the canvas state
        if (style.width!==undefined) this._drawStyle.width = style.width;
        this.ctx.lineWidth = this._drawStyle.width;
      
        forEach('background fill stroke'.split(' '),function(color){
            if (style[color]!==undefined){
                if (style[color]===null) this._drawStyle[color] = null;
                else{
                    let useColor = Colors.decode(style[color]);
                    if (useColor) this._drawStyle[color] = useColor;
                }
            }
        });

        this.ctx.fillStyle = this._drawStyle.fill;
        this.ctx.strokeStyle = this._drawStyle.stroke;
    }

    textStyle(style){
        // without arguments, show the current state
        if (arguments.length==0) return cloneDeep(this._fontStyle);

        // if this is a ("name", {style}) invocation, don't change the current
        // state but add it to the library
        if (arguments.length==2){
            let styleName = arguments[0];
            let styleDef = arguments[1];
            if (typeof styleName=='string' && typeof styleDef=='object'){
                let newStyle = {};
                if (styleDef.color!==undefined){
                    let textColor = Colors.decode(styleDef.color);
                    if (textColor) newStyle.color = textColor;
                }
                forEach('font size align baseline alpha'.split(' '), function(param){
                    if (styleDef[param]!==undefined) newStyle[param] = styleDef[param];
                });
                if (!isEmpty(newStyle)) this._fontLibrary[styleName] = newStyle;
            }
            return;
        }

        if (arguments.length==1 && this._fontLibrary[arguments[0]]!==undefined){
            style = this._fontLibrary[arguments[0]];
        }
            
        if (style.font!==undefined) this._fontStyle.font = style.font;
        if (style.size!==undefined) this._fontStyle.size = style.size;
        this.ctx.font = nano("{size}px {font}", this._fontStyle);

        if (style.align!==undefined){
            this.ctx.textAlign = this._fontStyle.align = style.align;
        }
        if (style.baseline!==undefined){
            this.ctx.textBaseline = this._fontStyle.baseline = style.baseline;
        }

        if (style.alpha!==undefined) this._fontStyle.alpha = style.alpha;
        if (style.color!==undefined){
            let textColor = Colors.decode(style.color);
            if (textColor) this._fontStyle.color = textColor;
        }
        if (this._fontStyle.color){
            let textColor = Colors.blend(this._fontStyle.color, this._fontStyle.alpha);
            if (textColor) this.ctx.fillStyle = textColor;
        }
    }

    text(textStr, x, y, opts){
        if (arguments.length>=3 && !isNaN(x)){
            opts = opts || {};
            opts.x = x;
            opts.y = y;
        }
        else if (arguments.length==2 && typeof(x)=='object'){
            opts = x;
        }
        else{
            opts = opts || {};
        }

        let style = mergeWith(this._fontStyle, opts);
        this.ctx.save();
        if (style.align!==undefined) this.ctx.textAlign = style.align;
        if (style.baseline!==undefined) this.ctx.textBaseline = style.baseline;
        if (style.font!==undefined && !isNaN(style.size)){
            this.ctx.font = nano("{size}px {font}", style);
        }

        var alpha = (style.alpha!==undefined) ? style.alpha : this._fontStyle.alpha;
        var color = (style.color!==undefined) ? style.color : this._fontStyle.color;
        this.ctx.fillStyle = Colors.blend(color, alpha);
        
        if (alpha>0) this.ctx.fillText(textStr, Math.round(style.x), style.y);
        this.ctx.restore();
    }

    textWidth(textStr, style){
        style = mergeWith(this._fontStyle, style||{});
        this.ctx.save();
        this.ctx.font = nano("{size}px {font}", style);
        var width = this.ctx.measureText(textStr).width;
        this.ctx.restore();
        return width;
    }
    
    // shape primitives.
    // classes will return an {x,y,w,h, fill(), stroke()} object without drawing
    // functions will draw the shape based on current stroke/fill state
    Rect(x,y,w,h,r,style){
        return new this._Rect(x,y,w,h,r,style);
    }

    rect(x, y, w, h, r, style){
        this._Rect.prototype._draw(x,y,w,h,r,style)
    }
    
    Oval(x, y, w, h, style) {
        return new this._Oval(x,y,w,h, style);
    }

    oval(x, y, w, h, style) {
        style = style || {};
        this._Oval.prototype._draw(x,y,w,h, style);
    }

    // draw a line immediately
    line(x1, y1, x2, y2, style){
        let p = new this._Path(x1,y1,x2,y2);
        p.draw(style);
    }
    
    // queue up a line segment to be drawn in a batch by .drawLines
    lines(x1, y1, x2, y2){
        if (typeof y2=='number'){
            // ƒ( x1, y1, x2, y2)
            this._lineBuffer.push( [ {x:x1,y:y1}, {x:x2,y:y2} ] );
        }
        else{
            // ƒ( {x:1, y:1}, {x:2, y:2} )
            this._lineBuffer.push( [ x1,y1 ] );
        }
    }
    
    // flush the buffered .lines to screen
    drawLines(style){
        let p = new this._Path(this._lineBuffer);
        p.draw(style);
        this._lineBuffer = [];
    }    
}

export default Graphics;