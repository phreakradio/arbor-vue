import Colors from './colors.js';

export default function Graphics(canvas) {
    if (!canvas || typeof canvas.getContext !== 'function') throw new TypeError('Graphics requires a canvas.');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('A 2D canvas context is unavailable.');
    let drawing = { background: null, fill: null, stroke: null, width: 1 };
    let font = { font: 'sans-serif', size: 12, align: 'left', baseline: 'ideographic', color: 'black', alpha: 1 };
    const drawStyles = new Map();
    const textStyles = new Map();
    let lineBuffer = [];

    function color(args) {
        const value = Colors.decode(...args);
        if (!value) throw new TypeError('Invalid color.');
        return value;
    }

    function blended(value, alpha) {
        const result = Colors.blend(value, alpha);
        if (result === null) throw new TypeError('Invalid color.');
        return result;
    }

    function setStyle(current, styles, value, definition) {
        if (typeof value === 'string') {
            if (definition !== undefined) {
                styles.set(value, { ...definition });
                return current;
            }
            if (!styles.has(value)) throw new RangeError(`Unknown style: ${value}`);
            value = styles.get(value);
        }
        if (!value || typeof value !== 'object') throw new TypeError('Style must be an object or a known style name.');
        return { ...current, ...value };
    }

    function paint(style, close = false) {
        const options = { ...drawing, ...style };
        if (close) ctx.closePath();
        if (options.fill != null) {
            ctx.fillStyle = blended(options.fill, options.alpha ?? 1);
            ctx.fill();
        }
        if (options.stroke != null) {
            ctx.strokeStyle = blended(options.stroke, options.alpha ?? 1);
            ctx.lineWidth = options.width;
            ctx.stroke();
        }
    }

    function drawRect(x, y, width, height, radius = 0, style = {}) {
        if (radius && typeof radius === 'object') {
            style = radius;
            radius = 0;
        }
        ctx.save();
        ctx.beginPath();
        const r = Math.max(0, Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2));
        if (r && typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, r);
        else ctx.rect(x, y, width, height);
        paint(style);
        ctx.restore();
    }

    function drawOval(x, y, width, height, style = {}) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
        paint(style);
        ctx.restore();
    }

    function segment(args) {
        if (typeof args[0] === 'number') {
            return [{ x: args[0], y: args[1] }, { x: args[2], y: args[3] }];
        }
        return [args[0], args[1]];
    }

    function drawSegments(segments, style = {}) {
        if (!segments.length) return;
        ctx.save();
        ctx.beginPath();
        for (const [from, to] of segments) {
            ctx.moveTo(from.x, from.y);
            ctx.lineTo(to.x, to.y);
        }
        paint(style, style.closed);
        ctx.restore();
    }

    const api = {
        size(width, height) {
            if (width !== undefined || height !== undefined) {
                if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
                    throw new RangeError('Canvas dimensions must be non-negative finite numbers.');
                }
                canvas.width = width;
                canvas.height = height;
            }
            return { width: canvas.width, height: canvas.height };
        },
        clear(x = 0, y = 0, width = canvas.width, height = canvas.height) {
            ctx.clearRect(x, y, width, height);
            if (drawing.background != null) {
                ctx.save();
                ctx.fillStyle = Colors.encode(drawing.background);
                ctx.fillRect(x, y, width, height);
                ctx.restore();
            }
        },
        background(...args) {
            drawing.background = args[0] == null ? null : color(args);
            if (drawing.background) api.clear();
        },
        fill(...args) {
            if (!args.length) return drawing.fill;
            drawing.fill = color(args);
        },
        noFill() { drawing.fill = null; },
        stroke(...args) {
            if (!args.length) return drawing.stroke;
            drawing.stroke = color(args);
        },
        noStroke() { drawing.stroke = null; },
        strokeWidth(width) {
            if (width === undefined) return drawing.width;
            if (!Number.isFinite(width) || width < 0) throw new RangeError('Stroke width must be non-negative.');
            drawing.width = width;
        },
        Color(...args) {
            const value = color(args);
            return { ...value, toString() { return Colors.encode(this); } };
        },
        drawStyle(style, definition) {
            if (style === undefined) return { ...drawing };
            drawing = setStyle(drawing, drawStyles, style, definition);
        },
        textStyle(style, definition) {
            if (style === undefined) return { ...font };
            font = setStyle(font, textStyles, style, definition);
        },
        text(text, x, y, options = {}) {
            if (x && typeof x === 'object') options = x;
            else options = { ...options, x, y };
            const style = { ...font, ...options };
            ctx.save();
            ctx.font = `${style.size}px ${style.font}`;
            ctx.textAlign = style.align;
            ctx.textBaseline = style.baseline;
            ctx.fillStyle = blended(style.color, style.alpha);
            if (style.width !== undefined) ctx.fillText(text, style.x, style.y, style.width);
            else ctx.fillText(text, style.x, style.y);
            ctx.restore();
        },
        textWidth(text, options = {}) {
            const style = { ...font, ...options };
            ctx.save();
            ctx.font = `${style.size}px ${style.font}`;
            const width = ctx.measureText(text).width;
            ctx.restore();
            return width;
        },
        rect: drawRect,
        oval: drawOval,
        Rect(x, y, width, height, radius = 0, style = {}) {
            if (radius && typeof radius === 'object') { style = radius; radius = 0; }
            return { x, y, w: width, h: height, r: radius, style, draw(override = {}) {
                drawRect(this.x, this.y, this.w, this.h, this.r, { ...this.style, ...override });
            } };
        },
        Oval(x, y, width, height, style = {}) {
            return { x, y, w: width, h: height, style, draw(override = {}) {
                drawOval(this.x, this.y, this.w, this.h, { ...this.style, ...override });
            } };
        },
        line(...args) {
            const style = typeof args[0] === 'number' ? args[4] : args[2];
            drawSegments([segment(args)], style);
        },
        lines(...args) { lineBuffer.push(segment(args)); },
        drawLines(style) {
            drawSegments(lineBuffer, style);
            lineBuffer = [];
        }
    };
    return api;
}
