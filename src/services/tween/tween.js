import Colors from '../graphics/colors.js';
import Easing from './easing.js';

const aliases = {
    bouncein: 'bounceIn',
    bounceout: 'bounceOut',
    bounceinout: 'bounceInOut'
};

function easingFunction(name) {
    const key = aliases[name] || name;
    return Easing[key] || Easing[name] || Easing.linear;
}

function interpolateNumber(progress, from, to) {
    return from + (to - from) * progress;
}

export default function Tween() {
    const active = new Map();
    return {
        busy() {
            return active.size > 0;
        },

        to(target, duration, values) {
            if (!target || !target.data || !Number.isFinite(duration) || duration < 0) {
                throw new TypeError('A tween requires a node/edge, a non-negative duration, and target values.');
            }
            const options = { ...values };
            const easingName = String(options.easing || options.ease || 'linear').toLowerCase();
            const delay = Math.max(0, Number(options.delay) || 0) * 1000;
            delete options.easing;
            delete options.ease;
            delete options.delay;
            const starts = {};
            const colors = {};
            for (const [key, value] of Object.entries(options)) {
                if (Colors.validate(value)) {
                    starts[key] = Colors.decode(target.data[key]) || Colors.decode('#000000');
                    colors[key] = Colors.decode(value);
                } else {
                    starts[key] = target.data[key] === undefined ? value : target.data[key];
                }
            }

            const previous = active.get(target._id) || [];
            const fields = new Set(Object.keys(options));
            const kept = previous.filter((tween) => {
                for (const field of fields) {
                    delete tween.to[field];
                    delete tween.colors[field];
                    delete tween.from[field];
                }
                return Object.keys(tween.to).length || Object.keys(tween.colors).length;
            });
            kept.push({
                target,
                from: starts,
                to: options,
                colors,
                start: Date.now() + delay,
                duration: Math.max(1, duration * 1000),
                ease: easingFunction(easingName)
            });
            active.set(target._id, kept);
        },

        interpolate(progress, from, to, easing = 'linear') {
            const ease = easingFunction(String(easing).toLowerCase());
            const pct = Math.min(1, Math.max(0, ease(progress, 0, 1, 1)));
            if (Colors.validate(from) && Colors.validate(to)) {
                const start = Colors.decode(from);
                const end = Colors.decode(to);
                return Colors.encode({
                    r: interpolateNumber(pct, start.r, end.r),
                    g: interpolateNumber(pct, start.g, end.g),
                    b: interpolateNumber(pct, start.b, end.b),
                    a: interpolateNumber(pct, start.a, end.a)
                });
            }
            if (typeof from === 'number' && typeof to === 'number') return interpolateNumber(pct, from, to);
            return pct < 0.5 ? from : to;
        },

        tick(now = Date.now()) {
            for (const [id, tweens] of active) {
                const remaining = [];
                for (const tween of tweens) {
                    if (now < tween.start) {
                        remaining.push(tween);
                        continue;
                    }
                    const raw = Math.min(1, (now - tween.start) / tween.duration);
                    const progress = Math.min(1, Math.max(0, tween.ease(raw, 0, 1, 1)));
                    for (const [key, value] of Object.entries(tween.to)) {
                        if (tween.colors[key]) {
                            const from = tween.from[key];
                            const to = tween.colors[key];
                            tween.target.data[key] = progress === 1
                                ? Colors.encode(to)
                                : Colors.encode({
                                    r: interpolateNumber(progress, from.r, to.r),
                                    g: interpolateNumber(progress, from.g, to.g),
                                    b: interpolateNumber(progress, from.b, to.b),
                                    a: interpolateNumber(progress, from.a, to.a)
                                });
                        } else if (typeof value === 'number' && typeof tween.from[key] === 'number') {
                            tween.target.data[key] = interpolateNumber(progress, tween.from[key], value);
                            if (key === 'alpha') tween.target.data[key] = Math.min(1, Math.max(0, tween.target.data[key]));
                        } else if (progress === 1) {
                            tween.target.data[key] = value;
                        }
                    }
                    if (raw < 1) remaining.push(tween);
                }
                if (remaining.length) active.set(id, remaining);
                else active.delete(id);
            }
            return active.size === 0;
        }
    };
}
