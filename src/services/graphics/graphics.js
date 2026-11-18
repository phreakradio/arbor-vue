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
import {Rectangle, Oval, Path} from './primitives';

const nano = (template, data) => {
    return template.replace(/\{([\w\-.]*)}/g, function(str, key){
        let keys = key.split("."), value = data[keys.shift()];
        forEach(keys, function(k){ 
            if (value.hasOwnProperty(k)) value = value[k];
            else value = str;
        });
        return value;
    });
};


var Graphics = function(canvas){
    var dom = $(canvas);
    var ctx = $(dom).get(0).getContext('2d');

    var _bounds = null;

    var _colorMode = "rgb"; // vs hsb
    var _coordMode = "origin"; // vs "center"

    var _drawLibrary = {};
    var _drawStyle = {background:null, 
                        fill:null, 
                        stroke:null,
                        width:0};

    var _fontLibrary = {};
    var _fontStyle = {font:"sans-serif",
                       size:12, 
                       align:"left",
                       color:Colors.decode("black"),
                       alpha:1,
                       baseline:"ideographic"};

    var _lineBuffer = []; // calls to .lines sit here until flushed by .drawlines

    ///MACRO:primitives-start
    var primitives = Primitives(ctx, _drawStyle, _fontStyle);
    var _Oval = primitives._Oval;
    var _Rect = primitives._Rect;
    var _Color = primitives._Color;
    var _Path = primitives._Path;
    ///MACRO:primitives-end    


    // drawStyle({background:"color" or {r,g,b,a}, 
    //            fill:"color" or {r,g,b,a}, 
    //            stroke:"color" or {r,g,b,a}, 
    //            alpha:<number>, 
    //            weight:<number>})


    var that = {
        init:function(){
            if (!ctx) return null;
            return that;
        },

        // canvas-wide settings
        size:function(width,height){
            if (!isNaN(width) && !isNaN(height)){
                dom.attr({width:width,height:height});

                // if (_drawStyle.fill!==null) that.fill(_drawStyle.fill)
                // if (_drawStyle.stroke!==null) that.stroke(_drawStyle.stroke)
                // that.textStyle(_fontStyle)

                // trace(_drawStyle,_fontStyle)
            }
            return {width:dom.attr('width'), height:dom.attr('height')};
        },

        clear:function(x,y,w,h){
            if (arguments.length<4){
                x=0; y=0;
                w=dom.attr('width');
                h=dom.attr('height');
            }

            ctx.clearRect(x,y,w,h);
            if (_drawStyle.background!==null){
                ctx.save();
                ctx.fillStyle = Colors.encode(_drawStyle.background)
                ctx.fillRect(x,y,w,h);
                ctx.restore();
            }
        },

        background:function(a,b,c,d){
            if (a==null){
                _drawStyle.background = null;
                return null;
            }

            var fillColor = Colors.decode(a,b,c,d);
            if (fillColor){
                _drawStyle.background = fillColor;
                that.clear();
            }
        },


        // drawing to screen
        noFill:function(){
            _drawStyle.fill = null;
        },

        fill:function(a,b,c,d){
            if (arguments.length==0){
                return _drawStyle.fill;
            }
            else if (arguments.length>0){
                var fillColor = Colors.decode(a,b,c,d);
                _drawStyle.fill = fillColor;
                ctx.fillStyle = Colors.encode(fillColor);
            }
        },

        noStroke:function(){
            _drawStyle.stroke = null;
            ctx.strokeStyle = null;
        },
        
        stroke:function(a,b,c,d){
            if (arguments.length==0 && _drawStyle.stroke!==null){
                return _drawStyle.stroke;
            }
            else if (arguments.length>0){
                var strokeColor = Colors.decode(a,b,c,d);
                _drawStyle.stroke = strokeColor;
                ctx.strokeStyle = Colors.encode(strokeColor);
            }
        },
        strokeWidth:function(ptsize){
            if (ptsize===undefined) return ctx.lineWidth;
            ctx.lineWidth = _drawStyle.width = ptsize;
        },

        Color:function(clr){
            return new _Color(clr);
        },


        // Font:function(fontName, pointSize){
        //   return new _Font(fontName, pointSize)
        // },
        // font:function(fontName, pointSize){
        //   if (fontName!==undefined) _fontStyle.font = fontName
        //   if (pointSize!==undefined) _fontStyle.size = pointSize
        //   ctx.font = nano("{size}px {font}", _fontStyle)
        // },


        drawStyle:function(style){
            // without arguments, show the current state
            if (arguments.length==0) return cloneDeep(_drawStyle);

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
                    forEach('background fill stroke width'.split(' '), (param) => {
                        if (styleDef[param]!==undefined) newStyle[param] = styleDef[param];
                    })
                    if (isEmpty(newStyle)) _drawLibrary[styleName] = newStyle;
                }
                return;
            }

            // if a ("stylename") invocation, load up the selected style
            if (arguments.length==1 && _drawLibrary[arguments[0]]!==undefined){
                style = _drawLibrary[arguments[0]];
            }

            // for each of the properties specified, update the canvas state
            if (style.width!==undefined) _drawStyle.width = style.width;
            ctx.lineWidth = _drawStyle.width;

            forEach('background fill stroke',(color) => {
                if (style[color]!==undefined){
                    if (style[color]===null) _drawStyle[color] = null;
                    else{
                        var useColor = Colors.decode(style[color]);
                        if (useColor) _drawStyle[color] = useColor;
                    }
                }
            })
            ctx.fillStyle = _drawStyle.fill;
            ctx.strokeStyle = _drawStyle.stroke;
        },

        textStyle:function(style){
            // without arguments, show the current state
            if (arguments.length==0) return cloneDeep(_fontStyle);

            // if this is a ("name", {style}) invocation, don't change the current
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
                    forEach('font size align baseline alpha'.split(' '), (param) => {
                        if (styleDef[param]!==undefined) newStyle[param] = styleDef[param];
                    })
                    if (!isEmpty(newStyle)) _fontLibrary[styleName] = newStyle;
                }
                return;
            }

            if (arguments.length==1 && _fontLibrary[arguments[0]]!==undefined){
                style = _fontLibrary[arguments[0]];
            }

            if (style.font!==undefined) _fontStyle.font = style.font;
            if (style.size!==undefined) _fontStyle.size = style.size;
            ctx.font = nano("{size}px {font}", _fontStyle);

            if (style.align!==undefined){
                ctx.textAlign = _fontStyle.align = style.align;
            }
            if (style.baseline!==undefined){
                ctx.textBaseline = _fontStyle.baseline = style.baseline;
            }

            if (style.alpha!==undefined) _fontStyle.alpha = style.alpha;
            if (style.color!==undefined){
                var textColor = Colors.decode(style.color);
                if (textColor) _fontStyle.color = textColor;
            }
            if (_fontStyle.color){
                var textColor = Colors.blend(_fontStyle.color, _fontStyle.alpha);
                if (textColor) ctx.fillStyle = textColor;
            }
            // trace(_fontStyle,opts)
        },

        text:function(textStr, x, y, opts){ // opts: x,y, color, font, align, baseline, width
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

            var style = mergeWith(_fontStyle, opts);

            ctx.save()
            if (style.align!==undefined) ctx.textAlign = style.align;
            if (style.baseline!==undefined) ctx.textBaseline = style.baseline;
            if (style.font!==undefined && !isNaN(style.size)){
                ctx.font = nano("{size}px {font}", style);
            }

            var alpha = (style.alpha!==undefined) ? style.alpha : _fontStyle.alpha;
            var color = (style.color!==undefined) ? style.color : _fontStyle.color;
            ctx.fillStyle = Colors.blend(color, alpha);

            // if (alpha>0) ctx.fillText(textStr, style.x, style.y);        
            if (alpha>0) ctx.fillText(textStr, Math.round(style.x), style.y);
            ctx.restore();
        },

        textWidth:function(textStr, style){ // style: x,y, color, font, align, baseline, width
            style = mergeWith(_fontStyle, style||{});
            ctx.save();
            ctx.font = nano("{size}px {font}", style);
            var width = ctx.measureText(textStr).width;            
            ctx.restore();
            return width;
        },

        // hasFont:function(fontName){
        //   var testTxt = 'H h H a H m H b H u H r H g H e H r H f H o H n H s H t H i H v H'
        //   ctx.save()
        //   ctx.font = '10px sans-serif'
        //   var defaultWidth = ctx.measureText(testTxt).width
        // 
        //   ctx.font = '10px "'+fontName+'"'
        //   var putativeWidth = ctx.measureText(testTxt).width
        //   ctx.restore()
        //   
        //   // var defaultWidth = that.textWidth(testTxt, {font:"Times New Roman", size:120})
        //   // var putativeWidth = that.textWidth(testTxt, {font:fontName, size:120})
        //   trace(defaultWidth,putativeWidth,ctx.font)
        //   // return (putativeWidth!=defaultWidth || fontName=="Times New Roman")
        //   return putativeWidth!=defaultWidth
        // },


        // shape primitives.
        // classes will return an {x,y,w,h, fill(), stroke()} object without drawing
        // functions will draw the shape based on current stroke/fill state
        Rect:function(x,y,w,h,r,style){
            return new _Rect(x,y,w,h,r,style);
        },

        rect:function(x, y, w, h, r, style){
            _Rect.prototype._draw(x,y,w,h,r,style);
        },

        Oval:function(x, y, w, h, style) {
            return new _Oval(x,y,w,h, style);
        },

        oval:function(x, y, w, h, style) {
            style = style || {};
            _Oval.prototype._draw(x,y,w,h, style);
        },

        // draw a line immediately
        line:function(x1, y1, x2, y2, style){
            var p = new _Path(x1,y1,x2,y2);
            p.draw(style);
        },

        // queue up a line segment to be drawn in a batch by .drawLines
        lines:function(x1, y1, x2, y2){
            if (typeof y2=='number'){
                // ƒ( x1, y1, x2, y2)
                _lineBuffer.push( [ {x:x1,y:y1}, {x:x2,y:y2} ] );
            }
            else{
                // ƒ( {x:1, y:1}, {x:2, y:2} )
                _lineBuffer.push( [ x1,y1 ] );
            }
        },

        // flush the buffered .lines to screen
        drawLines:function(style){
            var p = new _Path(_lineBuffer);
            p.draw(style);
            _lineBuffer = [];
        }
    }

    return that.init();
}


// // helpers for figuring out where to draw arrows
// var intersect_line_line = function(p1, p2, p3, p4)
// {
//  var denom = ((p4.y - p3.y)*(p2.x - p1.x) - (p4.x - p3.x)*(p2.y - p1.y));
// 
//  // lines are parallel
//  if (denom === 0) {
//    return false;
//  }
// 
//  var ua = ((p4.x - p3.x)*(p1.y - p3.y) - (p4.y - p3.y)*(p1.x - p3.x)) / denom;
//  var ub = ((p2.x - p1.x)*(p1.y - p3.y) - (p2.y - p1.y)*(p1.x - p3.x)) / denom;
// 
//  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
//    return false;
//  }
// 
//  return arbor.Point(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
// }
// 
// var intersect_line_box = function(p1, p2, p3, w, h)
// {
//  var tl = {x: p3.x, y: p3.y};
//  var tr = {x: p3.x + w, y: p3.y};
//  var bl = {x: p3.x, y: p3.y + h};
//  var br = {x: p3.x + w, y: p3.y + h};
// 
//  var result;
//  if (result = intersect_line_line(p1, p2, tl, tr)) { return result; } // top
//  if (result = intersect_line_line(p1, p2, tr, br)) { return result; } // right
//  if (result = intersect_line_line(p1, p2, br, bl)) { return result; } // bottom
//  if (result = intersect_line_line(p1, p2, bl, tl)) { return result; } // left
// 
//  return false;
// }


export default Graphics;


// class Graphics{
//     constructor(canvas){
//         this.dom = canvas;
//         this.ctx = this.dom.getContext('2d');

//         this._bounds = null;

//         this._colorMode = "rgb"; // vs hsb

//         this._drawLibrary = {};
//         this._drawStyle = {
//             background:null,
//             fill:null, 
//             stroke:null,
//             width:0
//         };

//         this._fontLibrary = {};
//         this._fontStyle = {
//             font:"sans-serif",
//             size:12,
//             align:"left",
//             color:Colors.decode("black"),
//             alpha:1,
//             baseline:"ideographic"
//         };

//         this.ovals = {};
//         this.rects = {};
//         this.paths = {};
//     }

//     // canvas-wide settings
//     size(width,height){
//         if (!isNaN(width) && !isNaN(height)){
//             this.dom.width = width;
//             this.dom.height = height;
//         }
//         return { width:this.dom.width, height:this.dom.height };
//     }

//     clear(x,y,w,h){
//         if(arguments.length<4){
//             x=0; y=0;
//             w=this.dom.width;
//             h=this.dom.height;
//         }

//         this.ctx.clearRect(x,y,w,h);
//         if (this._drawStyle.background!==null){
//             this.ctx.save();
//             this.ctx.fillStyle = Colors.encode(this._drawStyle.background);
//             this.ctx.fillRect(x,y,w,h);
//             this.ctx.restore();
//         }
//     }

//     background(a,b,c,d){
//         if (a==null){
//             this._drawStyle.background = null;
//             return null;
//         }

//         let fillColor = Colors.decode(a,b,c,d);
//         if (fillColor){
//             this._drawStyle.background = fillColor;
//             this.clear();
//         }
//     }

//     // drawing to screen
//     noFill(){
//         this._drawStyle.fill = null;
//     }

//     fill(a,b,c,d){
//         if (arguments.length==0){
//             return this._drawStyle.fill;
//         }
//         else if (arguments.length>0){
//             let fillColor = Colors.decode(a,b,c,d);
//             this._drawStyle.fill = fillColor;
//             this.ctx.fillStyle = Colors.encode(fillColor);
//         }
//     }
    
//     noStroke(){
//         this._drawStyle.stroke = null;
//         this.ctx.strokeStyle = null;
//     }

//     stroke(a,b,c,d){
//         if (arguments.length==0 && this._drawStyle.stroke!==null){
//             return this._drawStyle.stroke;
//         }
//         else if (arguments.length>0){
//             let strokeColor = Colors.decode(a,b,c,d);
//             this._drawStyle.stroke = strokeColor;
//             this.ctx.strokeStyle = Colors.encode(strokeColor);
//         }
//     }

//     strokeWidth(ptsize){
//         if (ptsize===undefined) return this.ctx.lineWidth;
//         this.ctx.lineWidth = this._drawStyle.width = ptsize;
//     }
    
//     drawStyle(style){
//         // without arguments, show the current state
//         if (arguments.length==0) return cloneDeep(this._drawStyle);

//         // if this is a ("stylename", {style}) invocation, don't change the current
//         // state but add it to the library
//         if (arguments.length==2){
//             let styleName = arguments[0];
//             let styleDef = arguments[1];
//             if (typeof styleName=='string' && typeof styleDef=='object'){
//                 let newStyle = {};
//                 if (styleDef.color!==undefined){
//                     let textColor = Colors.decode(styleDef.color);
//                     if (textColor) newStyle.color = textColor;
//                 }

//                 forEach('background fill stroke width'.split(' '), function(param){
//                     if (styleDef[param]!==undefined) newStyle[param] = styleDef[param];
//                 });
//                 if (isEmpty(newStyle)) this._drawLibrary[styleName] = newStyle;
//             }
//             return;
//         }

//         // if a ("stylename") invocation, load up the selected style
//         if (arguments.length==1 && this._drawLibrary[arguments[0]]!==undefined){
//             style = this._drawLibrary[arguments[0]];
//         }

//         // for each of the properties specified, update the canvas state
//         if (style.width!==undefined) this._drawStyle.width = style.width;
//         this.ctx.lineWidth = this._drawStyle.width;
      
//         forEach('background fill stroke'.split(' '),function(color){
//             if (style[color]!==undefined){
//                 if (style[color]===null) this._drawStyle[color] = null;
//                 else{
//                     let useColor = Colors.decode(style[color]);
//                     if (useColor) this._drawStyle[color] = useColor;
//                 }
//             }
//         });

//         this.ctx.fillStyle = this._drawStyle.fill;
//         this.ctx.strokeStyle = this._drawStyle.stroke;
//     }

//     textStyle(style){
//         // without arguments, show the current state
//         if (arguments.length==0) return cloneDeep(this._fontStyle);

//         // if this is a ("name", {style}) invocation, don't change the current
//         // state but add it to the library
//         if (arguments.length==2){
//             let styleName = arguments[0];
//             let styleDef = arguments[1];
//             if (typeof styleName=='string' && typeof styleDef=='object'){
//                 let newStyle = {};
//                 if (styleDef.color!==undefined){
//                     let textColor = Colors.decode(styleDef.color);
//                     if (textColor) newStyle.color = textColor;
//                 }
//                 forEach('font size align baseline alpha'.split(' '), function(param){
//                     if (styleDef[param]!==undefined) newStyle[param] = styleDef[param];
//                 });
//                 if (!isEmpty(newStyle)) this._fontLibrary[styleName] = newStyle;
//             }
//             return;
//         }

//         if (arguments.length==1 && this._fontLibrary[arguments[0]]!==undefined){
//             style = this._fontLibrary[arguments[0]];
//         }
            
//         if (style.font!==undefined) this._fontStyle.font = style.font;
//         if (style.size!==undefined) this._fontStyle.size = style.size;
//         this.ctx.font = nano("{size}px {font}", this._fontStyle);

//         if (style.align!==undefined){
//             this.ctx.textAlign = this._fontStyle.align = style.align;
//         }
//         if (style.baseline!==undefined){
//             this.ctx.textBaseline = this._fontStyle.baseline = style.baseline;
//         }

//         if (style.alpha!==undefined) this._fontStyle.alpha = style.alpha;
//         if (style.color!==undefined){
//             let textColor = Colors.decode(style.color);
//             if (textColor) this._fontStyle.color = textColor;
//         }
//         if (this._fontStyle.color){
//             let textColor = Colors.blend(this._fontStyle.color, this._fontStyle.alpha);
//             if (textColor) this.ctx.fillStyle = textColor;
//         }
//     }

//     text(textStr, x, y, opts){
//         if (arguments.length>=3 && !isNaN(x)){
//             opts = opts || {};
//             opts.x = x;
//             opts.y = y;
//         }
//         else if (arguments.length==2 && typeof(x)=='object'){
//             opts = x;
//         }
//         else{
//             opts = opts || {};
//         }

//         let style = mergeWith(this._fontStyle, opts);
//         this.ctx.save();
//         if (style.align!==undefined) this.ctx.textAlign = style.align;
//         if (style.baseline!==undefined) this.ctx.textBaseline = style.baseline;
//         if (style.font!==undefined && !isNaN(style.size)){
//             this.ctx.font = nano("{size}px {font}", style);
//         }

//         let alpha = (style.alpha!==undefined) ? style.alpha : this._fontStyle.alpha;
//         let color = (style.color!==undefined) ? style.color : this._fontStyle.color;
//         this.ctx.fillStyle = Colors.blend(color, alpha);
        
//         if (alpha>0) this.ctx.fillText(textStr, Math.round(style.x), style.y);
//         this.ctx.restore();
//     }

//     textWidth(textStr, style){
//         style = mergeWith(this._fontStyle, style||{});
//         this.ctx.save();
//         this.ctx.font = nano("{size}px {font}", style);
//         let width = this.ctx.measureText(textStr).width;
//         this.ctx.restore();
//         return width;
//     }
    
//     // shape primitives.
//     // classes will return an {x,y,w,h, fill(), stroke()} object without drawing
//     // functions will draw the shape based on current stroke/fill state
//     rect(id, x, y, w, h, r, style){
//         style = style || {};
//         let rec = (this.rects[id]) 
//                 ? this.rects[id].update(x,y,w,h,style) 
//                 : new Rectangle(this.ctx,id,x,y,w,h,r,style);
//         this.rects[id] = rec;
//         rec.draw();
//     }
    
//     oval(id, x, y, w, h, style) {
//         style = style || {};
//         let o = (this.ovals[id]) 
//                 ? this.ovals[id].update(x,y,w,h,style) 
//                 : new Oval(this.ctx,id,x,y,w,h,style);
//         this.ovals[id] = o;
//         o.draw();
//     }

//     // draw a line immediately
//     line(id, s1, s2, style){
//         let p = (this.paths[id]) 
//                 ? this.paths[id].update(s1.x,s1.y,s2.x,s2.y, style) 
//                 : new Path(this.ctx,id,s1.x,s1.y,s2.x,s2.y, style);
//         this.paths[id] = p;
//         p.draw();
//     }  
// }
