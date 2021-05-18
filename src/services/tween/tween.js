'use strict';
//
// tween.js
//
// interpolator of .data field members for nodes and edges
//

import forEach from 'lodash/forEach';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';

import Easing from './easing';
import Colors from '../graphics/colors';

var lerpNumber = (proportion,from,to) => {
    return from + proportion*(to-from);
};

var lerpRGB = (proportion,from,to) => {
    proportion = Math.max(Math.min(proportion,1),0);
    let mixture = {};
    
    forEach('rgba'.split(""), (c) => {
        mixture[c] = Math.round( from[c] + proportion*(to[c]-from[c]) )
    });
    return mixture;
}

var Tween = function(){
    var _tweens = {};
    var _done = true;

    var that = {
        init:function(){
            return that;
        },

        busy:function(){
            var busy = false;
            for (var k in _tweens){ busy=true; break; }
            return busy;
        },

        to:function(node, dur, to){
            var now = new Date().valueOf();
            var seenFields = {};

            var tween = {from:{}, to:{}, colors:{}, node:node, t0:now, t1:now+dur*1000, dur:dur*1000}
            var easing_fn = "linear";
            for (var k in to){
                if (k=='easing'){
                    // need to do better here. case insensitive and default to linear
                    // also be okay with functions getting passed in
                    var ease = to[k].toLowerCase();
                    if (ease in Easing) easing_fn =ease;
                    continue;
                }
                else if (k=='delay'){
                    var delay = (to[k]||0) * 1000;
                    tween.t0 += delay;
                    tween.t1 += delay;
                    continue;
                }

                if (Colors.validate(to[k])){
                    // it's a hex color string value
                    tween.colors[k] = [Colors.decode(node.data[k]), Colors.decode(to[k]), to[k]];
                    seenFields[k] = true;
                }
                else{
                    tween.from[k] = (node.data[k]!=undefined) ? node.data[k] : to[k];
                    tween.to[k] = to[k];
                    seenFields[k] = true;
                }
            }
            tween.ease = Easing[easing_fn];

            if (_tweens[node._id]===undefined) _tweens[node._id] = [];
            _tweens[node._id].push(tween);

            // look through queued prunes for any redundancies
            if (_tweens.length>1){
                for (var i=_tweens.length-2; i>=0; i++){
                    var tw = _tweens[i];

                    for (var k in tw.to){
                        if (k in seenFields) delete tw.to[k];
                        else seenFields[k] = true;
                    }

                    for (var k in tw.colors){
                        if (k in seenFields) delete tw.colors[k];
                        else seenFields[k] = true;
                    }

                    if (isEmpty(tw.colors) && isEmpty(tw.to)){
                        _tweens.splice(i,1);
                    }                    
                }
            }
            _done = false;
        },

        interpolate:function(pct, src, dst, ease){
            ease = (ease||"").toLowerCase();
            var easing_fn = Easing.linear;
            if (ease in Easing) easing_fn = Easing[ease];

            var proportion = easing_fn( pct, 0,1, 1 );
            if (Colors.validate(src) && Colors.validate(dst)){
                return lerpRGB(proportion, src,dst);
            }
            else if (!isNaN(src)){
                return lerpNumber(proportion, src,dst);
            }
            else if (typeof src=='string'){
                return (proportion<.5) ? src : dst;
            }
        },

        tick:function(){
            var empty = true;
            for (var k in _tweens){ empty=false; break; }
            if (empty) return;

            var now = new Date().valueOf();

            forEach(_tweens, (tweens, id) => {
                let unprunedTweens = false;

                forEach(tweens, (tween) => {
                    let proportion = tween.ease( (now-tween.t0), 0,1, tween.dur );
                    proportion = Math.min(1.0, proportion);
                    let from = tween.from;
                    let to = tween.to;
                    let colors = tween.colors;
                    let nodeData = tween.node.data;

                    let lastTick = (proportion==1.0);

                    for (let k in to){
                        switch (typeof to[k]){
                            case "number":
                                nodeData[k] = lerpNumber(proportion, from[k], to[k]);
                                if (k=='alpha') nodeData[k] = Math.max(0,Math.min(1, nodeData[k]));
                                break;
                            case "string":
                                if (lastTick){
                                    nodeData[k] = to[k];
                                }
                                break;
                        }
                    }

                    for (let k in colors){
                        if (lastTick){
                            nodeData[k] = colors[k][2];
                        }
                        else{
                            let rgb = lerpRGB(proportion, colors[k][0], colors[k][1]);
                            nodeData[k] = Colors.encode(rgb);
                        }
                    }

                    if (lastTick){
                        tween.completed = true;
                        unprunedTweens = true;
                    }
                });

                if (unprunedTweens){
                    _tweens[id] = map(tweens, (t) => { if (!t.completed) return t; });
                    if (_tweens[id].length==0) delete _tweens[id];
                }
            });

            _done = isEmpty(_tweens);
            return _done;
        }
    }

    return that.init();
}

export default Tween;