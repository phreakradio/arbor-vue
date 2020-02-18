'use strict';
//
// tween.js
//
// interpolator of .data field members for nodes and edges
//

import forEach from 'lodash/forEach';
import isEmpty from 'lodash/isEmpty';
import map from 'lodash/map';

const Easing = require('./easing');
const Colors = require('../colors');

const lerpNumber = (proportion,from,to) => {
    return from + proportion*(to-from);
};

const lerpRGB = (proportion,from,to) => {
    proportion = Math.max(Math.min(proportion,1),0);
    let mixture = {};
    
    forEach('rgba'.split(""), function(c){
        mixture[c] = Math.round( from[c] + proportion*(to[c]-from[c]) )
    });
    return mixture;
}

class Tween {
    constructor(){
        this._tweens = {};
        this._done = true;
    }

    busy(){
        let busy = false;
        for (let k in this._tweens){ busy=true; break; }
        return busy;
    }

    to(node, dur, to){
        let now = new Date().valueOf();
        let seenFields = {};

        let tween = {from:{}, to:{}, colors:{}, node:node, t0:now, t1:now+dur*1000, dur:dur*1000};
        let easing_fn = "linear";
        for (let k in to){
            if (k=='easing'){
                // need to do better here. case insensitive and default to linear
                // also be okay with functions getting passed in
                let ease = to[k].toLowerCase();
                if (ease in Easing) easing_fn = ease;
                continue;
            }
            else if (k=='delay'){
                let delay = (to[k]||0) * 1000;
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

        if (this._tweens[node._id]===undefined) _tweens[node._id] = [];
        this._tweens[node._id].push(tween);
        
        // look through queued prunes for any redundancies
        if (this._tweens.length>1){
            for (let i=this._tweens.length-2; i>=0; i++){
                let tw = this._tweens[i];

                for (let k in tw.to){
                    if (k in seenFields) delete tw.to[k];
                    else seenFields[k] = true;
                }

                for (let k in tw.colors){
                    if (k in seenFields) delete tw.colors[k];
                    else seenFields[k] = true;
                }

                if (isEmpty(tw.colors) && isEmpty(tw.to)){
                    this._tweens.splice(i,1);
                }
            }
        }
        this._done = false;
    }

    interpolate(pct, src, dst, ease){
        ease = (ease||"").toLowerCase();
        let easing_fn = Easing.linear;
        if (ease in Easing) easing_fn = Easing[ease];

        let proportion = easing_fn( pct, 0,1, 1 );
        if (Colors.validate(src) && Colors.validate(dst)){
            return lerpRGB(proportion, src,dst);
        }
        else if (!isNaN(src)){
            return lerpNumber(proportion, src,dst);
        }
        else if (typeof src=='string'){
            return (proportion<.5) ? src : dst;
        }
    }

    tick(){
        let empty = true;
        for (let k in this._tweens){ empty=false; break; }
        if (empty) return;

        let now = new Date().valueOf();

        forEach(this._tweens, function(tweens){
            let unprunedTweens = false;

            forEach(tweens, function(tween){
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
                            nodeData[k] = lerpNumber(proportion, from[k], to[k])
                            if (k=='alpha') nodeData[k] = Math.max(0,Math.min(1, nodeData[k]))
                            break;
                        case "string":
                            if (lastTick){
                                nodeData[k] = to[k]
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
                this._tweens[id] = map(tweens, function(t){ if (!t.completed) return t; });
                if (this._tweens[id].length==0) delete this._tweens[id];
            }
        }.bind(this));

        this._done = isEmpty(this._tweens);
        
        return this._done;
    }    
}

module.exports = Tween;