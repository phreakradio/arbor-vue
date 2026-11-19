import { Point } from './physics/atoms.js';

function alphaOf(node) {
    const alpha = node.data.alpha;
    return Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1;
}

export default class Renderer {
    constructor(canvas, options = {}) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new TypeError('Renderer requires an HTMLCanvasElement.');
        }
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        if (!this.context) throw new Error('A 2D canvas context is unavailable.');
        this.options = options;
        this.system = null;
        this._observer = null;
        this._drag = null;
        this._destroyed = false;
        this._dpr = 1;
        this._width = 0;
        this._height = 0;
        this._onPointerDown = (event) => this._pointerDown(event);
        this._onPointerMove = (event) => this._pointerMove(event);
        this._onPointerUp = (event) => this._pointerUp(event);
    }

    init(system) {
        this.system = system;
        this.resize();
        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        this.canvas.addEventListener('pointermove', this._onPointerMove);
        this.canvas.addEventListener('pointerup', this._onPointerUp);
        this.canvas.addEventListener('pointercancel', this._onPointerUp);
        if (typeof ResizeObserver !== 'undefined') {
            this._observer = new ResizeObserver(() => this.resize());
            this._observer.observe(this.canvas);
        }
        return this;
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.max(1, rect.width || this.canvas.clientWidth || 300);
        const height = Math.max(1, rect.height || this.canvas.clientHeight || 150);
        this._dpr = Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 3);
        this._width = width;
        this._height = height;
        const backingWidth = Math.round(width * this._dpr);
        const backingHeight = Math.round(height * this._dpr);
        if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
            this.canvas.width = backingWidth;
            this.canvas.height = backingHeight;
        }
        this.context.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        if (this.system) this.system.screenSize(width, height);
        this.redraw();
    }

    redraw() {
        if (!this.system || this._destroyed) return;
        const ctx = this.context;
        ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
        ctx.clearRect(0, 0, this._width, this._height);
        const background = this.options.background;
        if (background) {
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, this._width, this._height);
        }
        this.system.eachEdge((edge, from, to) => this._drawEdge(edge, from, to));
        this.system.eachNode((node, point) => this._drawNode(node, point));
    }

    destroy() {
        this._destroyed = true;
        if (this._observer) this._observer.disconnect();
        this._observer = null;
        this.canvas.removeEventListener('pointerdown', this._onPointerDown);
        this.canvas.removeEventListener('pointermove', this._onPointerMove);
        this.canvas.removeEventListener('pointerup', this._onPointerUp);
        this.canvas.removeEventListener('pointercancel', this._onPointerUp);
        this._releaseDrag();
        this.system = null;
    }

    _drawEdge(edge, from, to) {
        if (!alphaOf(edge.source) || !alphaOf(edge.target) || edge.data.alpha === 0) return;
        const ctx = this.context;
        ctx.save();
        ctx.globalAlpha = Number.isFinite(edge.data.alpha)
            ? Math.min(1, Math.max(0, edge.data.alpha))
            : Math.min(alphaOf(edge.source), alphaOf(edge.target));
        ctx.strokeStyle = edge.data.color || this.options.edgeColor || '#888';
        ctx.lineWidth = Number.isFinite(edge.data.width) ? edge.data.width : (this.options.edgeWidth || 1);
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.restore();
    }

    _drawNode(node, point) {
        const alpha = alphaOf(node);
        if (!alpha) return;
        const ctx = this.context;
        const radius = Math.max(1, Number(node.data.radius) || this.options.nodeRadius || 6);
        const shape = node.data.shape || 'dot';
        const color = node.data.color || this.options.nodeColor || '#526f91';
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color === 'none' ? '#fff' : color;

        if (shape === 'dot') {
            ctx.beginPath();
            ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const label = node.data.label === undefined ? String(node.name) : String(node.data.label);
            ctx.font = this.options.font || '12px sans-serif';
            const width = Math.max(radius * 2, ctx.measureText(label).width + 12);
            const height = Number(node.data.height) || 24;
            const left = point.x - width / 2;
            const top = point.y - height / 2;
            const corner = Math.min(4, height / 2);
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(left, top, width, height, corner);
            } else {
                ctx.rect(left, top, width, height);
            }
            ctx.fill();
        }

        if (node.data.image && typeof Image !== 'undefined') {
            const image = this._image(node);
            if (image && image.complete) {
                const imageWidth = Number(node.data.image_w) || radius * 2;
                const imageHeight = Number(node.data.image_h) || radius * 2;
                ctx.drawImage(image, point.x - imageWidth / 2, point.y - imageHeight / 2, imageWidth, imageHeight);
            }
        }

        const label = node.data.label;
        if (label !== undefined && label !== null && String(label).trim()) {
            ctx.font = this.options.font || '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = node.data.color === 'none' ? '#333' : (node.data.labelColor || '#fff');
            ctx.fillText(String(label), point.x, point.y);
        }
        ctx.restore();
    }

    _image(node) {
        if (node.data.imageob) return node.data.imageob;
        const image = new Image();
        image.src = typeof this.options.resolveImage === 'function'
            ? this.options.resolveImage(node.data.image, node)
            : node.data.image;
        node.data.imageob = image;
        image.addEventListener('load', () => this.redraw(), { once: true });
        return image;
    }

    _localPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        return new Point(event.clientX - rect.left, event.clientY - rect.top);
    }

    _pointerDown(event) {
        if (!this.system || event.button !== 0) return;
        const point = this._localPoint(event);
        const nearest = this.system.nearest(point);
        if (!nearest) return;
        const radius = Math.max(12, Number(nearest.node.data.radius) || 8);
        if (nearest.distance > radius + 8) return;
        this._drag = {
            node: nearest.node,
            pointerId: event.pointerId,
            fixed: nearest.node.fixed,
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        };
        this.system._boundsLocked = true;
        nearest.node.fixed = true;
        this.canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    _pointerMove(event) {
        if (!this._drag || this._drag.pointerId !== event.pointerId) return;
        const point = this._localPoint(event);
        this._drag.moved = this._drag.moved ||
            Math.hypot(event.clientX - this._drag.startX, event.clientY - this._drag.startY) > 3;
        const world = this.system.fromScreen(point);
        this._drag.node.p = world;
        event.preventDefault();
    }

    _pointerUp(event) {
        if (!this._drag || this._drag.pointerId !== event.pointerId) return;
        const { node, moved } = this._drag;
        this._releaseDrag();
        if (!moved && typeof this.options.onNodeClick === 'function') {
            this.options.onNodeClick(node, event);
        }
    }

    _releaseDrag() {
        if (!this._drag) return;
        const { node, fixed } = this._drag;
        this.system._boundsLocked = false;
        node.fixed = fixed;
        node.tempMass = 1000;
        this._drag = null;
    }
}
