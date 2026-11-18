import Tween from '../tween/tween.js';
import PhysicsWorker from './worker.js?worker&inline';
import stepPhysics from './physics.js';
import { Edge, Node, Point } from './atoms.js';

const DEFAULTS = {
    repulsion: 1000,
    stiffness: 600,
    friction: 0.5,
    gravity: false,
    fps: 50,
    dt: 0.02,
    precision: 0.6,
    integrator: 'verlet',
    worker: 'auto'
};

function isNode(value) {
    return value instanceof Node || (value && Number.isInteger(value._id));
}

function graphData(data = {}) {
    const copy = { ...data };
    delete copy.x;
    delete copy.y;
    delete copy.mass;
    delete copy.fixed;
    delete copy.length;
    return copy;
}

function normalizeParameters(parameters) {
    const result = { ...parameters };
    if (result.targetFps !== undefined && result.fps === undefined) result.fps = result.targetFps;
    if (result.timeout !== undefined && result.fps === undefined) {
        const timeout = Number(result.timeout);
        if (!Number.isFinite(timeout) || timeout <= 0) throw new RangeError('timeout must be a positive number.');
        result.fps = 1000 / timeout;
    }
    delete result.targetFps;
    delete result.timeout;
    for (const key of ['repulsion', 'stiffness', 'friction', 'fps', 'dt', 'precision']) {
        if (result[key] === undefined) continue;
        const value = Number(result[key]);
        if (!Number.isFinite(value)) throw new TypeError(`${key} must be a finite number.`);
        result[key] = value;
    }
    if (result.repulsion < 0 || result.stiffness < 0) {
        throw new RangeError('repulsion and stiffness must not be negative.');
    }
    if (result.fps <= 0 || result.dt <= 0) throw new RangeError('fps and dt must be positive.');
    if (result.friction < 0 || result.friction > 1) {
        throw new RangeError('friction must be between 0 and 1.');
    }
    if (result.precision !== undefined) result.precision = Math.min(1, Math.max(0, result.precision));
    if (result.integrator !== undefined && !['verlet', 'euler'].includes(result.integrator)) {
        throw new RangeError('integrator must be "verlet" or "euler".');
    }
    if (result.worker !== undefined && ![true, false, 'auto'].includes(result.worker)) {
        throw new TypeError('worker must be true, false, or "auto".');
    }
    return result;
}

class ParticleSystemCore {
    constructor(...args) {
        let options = {};
        if (args.length === 1 && args[0] && typeof args[0] === 'object') {
            options = { ...args[0] };
        } else {
            const [repulsion, stiffness, friction, gravity, fps, dt, precision, integrator] = args;
            options = { repulsion, stiffness, friction, gravity, fps, dt, precision, integrator };
        }
        Object.keys(options).forEach((key) => {
            if (options[key] === undefined) delete options[key];
        });
        this._parameters = normalizeParameters({ ...DEFAULTS, ...options });
        this._parameters.fps = Math.max(1, this._parameters.fps);
        this._parameters.dt = Math.max(0.001, this._parameters.dt);
        this._parameters.integrator = ['verlet', 'euler'].includes(this._parameters.integrator)
            ? this._parameters.integrator
            : 'verlet';

        this.nodes = Object.create(null);
        this.edges = Object.create(null);
        this.names = Object.create(null);
        this.adjacency = Object.create(null);
        this.renderer = null;
        this._attachedRenderer = null;
        this.tween = Tween();
        this._particles = [];
        this._springs = [];
        this._screenSize = null;
        this._screenPadding = [20, 20, 20, 20];
        this._screenStep = 0.04;
        this._bounds = null;
        this._boundsTarget = null;
        this._energy = { sum: 0, max: 0, mean: 0, n: 0 };
        this._epoch = 0;
        this._frame = null;
        this._worker = null;
        this._workerFailed = false;
        this._workerGeometry = null;
        this._destroyed = false;
        this._paused = false;
        this._settledAt = null;
        this._frameTimes = [];
        this.onError = typeof options.onError === 'function' ? options.onError : (error) => {
            if (typeof console !== 'undefined' && console.error) console.error(error);
        };
        this._lastFrame = 0;
        this._lastPhysics = 0;
        this._batching = false;
    }

    parameters(update) {
        if (update === undefined) return { ...this._parameters, timeout: 1000 / this._parameters.fps };
        const next = normalizeParameters(update);
        if (next.fps !== undefined) next.fps = Math.max(1, next.fps);
        if (next.dt !== undefined) next.dt = Math.max(0.001, next.dt);
        Object.assign(this._parameters, next);
        if (this._worker) this._worker.postMessage({ type: 'parameters', parameters: this._physicsParameters() });
        this._wake();
        return this._parameters;
    }

    fps(value) {
        if (value === undefined) return this._frameTimes.length
            ? Math.round(1000 / (this._frameTimes.reduce((sum, time) => sum + time, 0) / this._frameTimes.length))
            : 0;
        this.parameters({ fps: value });
        return this;
    }

    start() {
        if (this._destroyed) throw new Error('Cannot start a destroyed ParticleSystem.');
        this._paused = false;
        if (!this._worker && !this._workerFailed) this._createWorker();
        if (this._worker) this._worker.postMessage({ type: 'start' });
        if (this._frame === null) this._scheduleFrame();
        return this;
    }

    stop() {
        this._paused = true;
        if (this._worker) this._worker.postMessage({ type: 'stop' });
        if (this._frame !== null) {
            if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._frame);
            else clearTimeout(this._frame);
            this._frame = null;
        }
        return this;
    }

    destroy() {
        this.stop();
        this._destroyed = true;
        if (this._worker) {
            this._worker.postMessage({ type: 'destroy' });
            this._worker.terminate();
            this._worker = null;
        }
        if (this.renderer && typeof this.renderer.destroy === 'function') this.renderer.destroy();
        this.renderer = null;
        this._attachedRenderer = null;
    }

    addNode(name, data = {}) {
        if (name === undefined || name === null) throw new TypeError('A node name is required.');
        const key = String(name);
        const prior = this.names[key];
        if (prior) {
            this._setNodeData(prior, data);
            return prior;
        }
        const node = new Node(key, data, (changedNode, change) => this._nodeChanged(changedNode, change));
        node._particle = {
            id: node._id,
            x: node.p.x,
            y: node.p.y,
            vx: 0,
            vy: 0,
            mass: node.mass,
            fixed: node.fixed,
            tempMass: null
        };
        this.names[key] = node;
        this.nodes[node._id] = node;
        this.adjacency[node._id] = Object.create(null);
        this._particles.push(node._particle);
        this._changedGraph();
        return node;
    }

    getNode(value) {
        if (value === undefined || value === null) return undefined;
        if (isNode(value)) return this.nodes[value._id] ? value : undefined;
        return this.names[String(value)];
    }

    pruneNode(value) {
        return this._batch(() => {
            const node = this.getNode(value);
            if (!node) return undefined;
            for (const edge of Object.values(this.edges)) {
                if (edge.source === node || edge.target === node) this.pruneEdge(edge);
            }
            delete this.nodes[node._id];
            delete this.names[node.name];
            delete this.adjacency[node._id];
            this._particles = this._particles.filter((particle) => particle.id !== node._id);
            this._changedGraph();
            return node;
        });
    }

    addEdge(source, target, data = {}) {
        return this._batch(() => {
            const sourceNode = this.getNode(source) || this.addNode(source);
            const targetNode = this.getNode(target) || this.addNode(target);
            const existing = this.getEdges(sourceNode, targetNode)[0];
            if (existing) {
                existing.data = graphData(data);
                if (Number.isFinite(data.length)) existing.length = data.length;
                this._changedGraph();
                return existing;
            }
            const edge = new Edge(sourceNode, targetNode, data);
            this.edges[edge._id] = edge;
            const outgoing = this.adjacency[sourceNode._id];
            outgoing[targetNode._id] = outgoing[targetNode._id] || [];
            outgoing[targetNode._id].push(edge);
            this._springs.push({
                id: edge._id,
                source: sourceNode._id,
                target: targetNode._id,
                length: edge.length
            });
            this._changedGraph();
            return edge;
        });
    }

    pruneEdge(value) {
        const edge = value && value._id !== undefined ? this.edges[value._id] : undefined;
        if (!edge) return undefined;
        delete this.edges[edge._id];
        const outgoing = this.adjacency[edge.source._id];
        if (outgoing && outgoing[edge.target._id]) {
            outgoing[edge.target._id] = outgoing[edge.target._id].filter((item) => item !== edge);
            if (!outgoing[edge.target._id].length) delete outgoing[edge.target._id];
        }
        this._springs = this._springs.filter((spring) => spring.id !== edge._id);
        this._changedGraph();
        return edge;
    }

    getEdges(source, target) {
        const from = this.getNode(source);
        const to = this.getNode(target);
        if (!from || !to) return [];
        return (this.adjacency[from._id] && this.adjacency[from._id][to._id]) || [];
    }

    getEdgesFrom(value) {
        const node = this.getNode(value);
        if (!node || !this.adjacency[node._id]) return [];
        return Object.values(this.adjacency[node._id]).flat();
    }

    getEdgesTo(value) {
        const node = this.getNode(value);
        if (!node) return [];
        return Object.values(this.edges).filter((edge) => edge.target === node);
    }

    eachNode(callback) {
        for (const node of Object.values(this.nodes)) {
            const point = this._screenSize ? this.toScreen(node.p) : node.p;
            callback.call(this, node, point);
        }
    }

    eachEdge(callback) {
        for (const edge of Object.values(this.edges)) {
            const from = this._screenSize ? this.toScreen(edge.source.p) : edge.source.p;
            const to = this._screenSize ? this.toScreen(edge.target.p) : edge.target.p;
            callback.call(this, edge, from, to);
        }
    }

    graft(branch = {}) {
        return this._batch(() => {
            const added = { nodes: [], edges: [] };
            for (const [name, data] of Object.entries(branch.nodes || {})) {
                const prior = this.getNode(name);
                if (prior) this._setNodeData(prior, data || {});
                else added.nodes.push(this.addNode(name, data || {}));
            }
            for (const [source, targets] of Object.entries(branch.edges || {})) {
                for (const [target, data] of Object.entries(targets || {})) {
                    if (!this.getNode(source)) added.nodes.push(this.addNode(source));
                    if (!this.getNode(target)) added.nodes.push(this.addNode(target));
                    const existed = this.getEdges(source, target).length > 0;
                    const edge = this.addEdge(source, target, data || {});
                    if (!existed) added.edges.push(edge);
                }
            }
            return { added };
        });
    }

    merge(branch = {}) {
        return this._batch(() => {
            const nodes = branch.nodes || {};
            const edges = branch.edges || {};
            const removed = { nodes: [], edges: [] };
            for (const edge of Object.values(this.edges)) {
                if (!edges[edge.source.name] || !Object.hasOwn(edges[edge.source.name], edge.target.name)) {
                    removed.edges.push(this.pruneEdge(edge));
                }
            }
            for (const node of Object.values(this.nodes)) {
                if (!Object.hasOwn(nodes, node.name)) removed.nodes.push(this.pruneNode(node));
            }
            const { added } = this.graft(branch);
            return { added, dropped: removed };
        });
    }

    prune(callback) {
        return this._batch(() => {
            const dropped = { nodes: [], edges: [] };
            const candidates = Object.values(this.nodes);
            for (const node of candidates) {
                const shouldDrop = callback
                    ? callback.call(this, node, { from: this.getEdgesFrom(node), to: this.getEdgesTo(node) })
                    : true;
                if (shouldDrop) {
                    dropped.nodes.push(node);
                    dropped.edges.push(...this.getEdgesFrom(node), ...this.getEdgesTo(node));
                    this.pruneNode(node);
                }
            }
            dropped.edges = [...new Set(dropped.edges)];
            return { dropped };
        });
    }

    screen(options) {
        if (options === undefined) {
            return {
                size: this._screenSize ? { ...this._screenSize } : undefined,
                padding: [...this._screenPadding],
                step: this._screenStep
            };
        }
        if (options.size) this.screenSize(options.size.width, options.size.height);
        if (Number.isFinite(options.step)) this.screenStep(options.step);
        if (options.padding !== undefined) this.screenPadding(options.padding);
        return this;
    }

    screenSize(width, height) {
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) {
            throw new TypeError('Screen dimensions must be non-negative finite numbers.');
        }
        this._screenSize = { width, height };
        this._updateBounds();
        return this;
    }

    screenPadding(top, right, bottom, left) {
        let padding;
        if (Array.isArray(top)) {
            padding = [...top];
            if (padding.length === 1) padding = [padding[0], padding[0], padding[0], padding[0]];
            else if (padding.length === 2) padding = [padding[0], padding[1], padding[0], padding[1]];
            else if (padding.length === 3) padding = [padding[0], padding[1], padding[2], padding[1]];
        } else if (right === undefined) {
            padding = [top, top, top, top];
        } else if (bottom === undefined) {
            padding = [top, right, top, right];
        } else {
            padding = [top, right, bottom, left === undefined ? right : left];
        }
        if (padding.length !== 4 || padding.some((value) => !Number.isFinite(value) || value < 0)) {
            throw new TypeError('Screen padding must contain four non-negative numbers.');
        }
        this._screenPadding = padding;
        return this;
    }

    screenStep(value) {
        if (value === undefined) return this._screenStep;
        const step = Number(value);
        if (!Number.isFinite(step)) throw new TypeError('Screen step must be a finite number.');
        this._screenStep = Math.min(1, Math.max(0, step));
        return this;
    }

    toScreen(point) {
        if (!this._screenSize) return undefined;
        const bounds = this._bounds || this.bounds();
        const [top, right, bottom, left] = this._screenPadding;
        const width = Math.max(bounds.bottomright.x - bounds.topleft.x, 4);
        const height = Math.max(bounds.bottomright.y - bounds.topleft.y, 4);
        return new Point(
            left + (point.x - bounds.topleft.x) / width * Math.max(0, this._screenSize.width - left - right),
            top + (point.y - bounds.topleft.y) / height * Math.max(0, this._screenSize.height - top - bottom)
        );
    }

    fromScreen(point) {
        if (!this._screenSize) return undefined;
        const bounds = this._bounds || this.bounds();
        const [top, right, bottom, left] = this._screenPadding;
        const width = Math.max(bounds.bottomright.x - bounds.topleft.x, 4);
        const height = Math.max(bounds.bottomright.y - bounds.topleft.y, 4);
        const usableWidth = Math.max(1, this._screenSize.width - left - right);
        const usableHeight = Math.max(1, this._screenSize.height - top - bottom);
        return new Point(
            bounds.topleft.x + (point.x - left) / usableWidth * width,
            bounds.topleft.y + (point.y - top) / usableHeight * height
        );
    }

    nearest(point) {
        const target = this._screenSize ? this.fromScreen(point) : point;
        let nearest = null;
        for (const node of Object.values(this.nodes)) {
            const distance = node.p.subtract(target).magnitude();
            if (!nearest || distance < nearest.distance) {
                nearest = { node, point: node.p, distance };
            }
        }
        if (nearest && this._screenSize) {
            nearest.screenPoint = this.toScreen(nearest.point);
            nearest.distance = nearest.screenPoint.subtract(point).magnitude();
        }
        return nearest;
    }

    bounds() {
        const nodes = Object.values(this.nodes);
        if (!nodes.length) {
            return { topleft: new Point(-1, -1), bottomright: new Point(1, 1) };
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const node of nodes) {
            minX = Math.min(minX, node.p.x);
            minY = Math.min(minY, node.p.y);
            maxX = Math.max(maxX, node.p.x);
            maxY = Math.max(maxY, node.p.y);
        }
        return { topleft: new Point(minX, minY), bottomright: new Point(maxX, maxY) };
    }

    tweenNode(value, duration, target) {
        const node = this.getNode(value);
        if (node) this.tween.to(node, duration, target);
        this._wake();
        return this;
    }

    tweenEdge(a, b, c, d) {
        const edges = d === undefined
            ? [a]
            : this.getEdges(a, b);
        for (const edge of edges) if (edge && edge._id !== undefined) {
            this.tween.to(edge, d === undefined ? b : c, d === undefined ? c : d);
        }
        this._wake();
        return this;
    }

    _updateGeometry(message) {
        const geometry = message.geometry || [];
        for (let index = 0; index + 2 < geometry.length; index += 3) {
            const node = this.nodes[geometry[index]];
            if (!node) continue;
            node._p._x = geometry[index + 1];
            node._p._y = geometry[index + 2];
            if (node._particle) {
                node._particle.x = node.p.x;
                node._particle.y = node.p.y;
            }
        }
        if (message.energy) this._energy = message.energy;
        if (message.bounds) this._boundsTarget = message.bounds;
        this._epoch = Math.max(this._epoch, message.epoch || 0);
    }

    _setNodeData(node, data) {
        node.data = graphData(data);
        if (data.mass !== undefined) node.mass = data.mass;
        if (data.fixed !== undefined) node.fixed = data.fixed;
        if (Number.isFinite(data.x) || Number.isFinite(data.y)) {
            node.p = {
                x: Number.isFinite(data.x) ? data.x : node.p.x,
                y: Number.isFinite(data.y) ? data.y : node.p.y
            };
        }
        this._changedGraph();
    }

    _nodeChanged(node, change) {
        const particle = node._particle;
        if (!particle) return;
        if ('x' in change) particle.x = change.x;
        if ('y' in change) particle.y = change.y;
        if ('mass' in change) particle.mass = change.mass;
        if ('fixed' in change) particle.fixed = change.fixed;
        if ('tempMass' in change) particle.tempMass = change.tempMass;
        if (!this._batching) {
            if (this._worker) this._worker.postMessage({ type: 'node', id: node._id, changes: change });
            this._wake();
        }
    }

    _changedGraph() {
        this._epoch++;
        if (this._batching) return;
        if (this._worker) this._syncWorker();
        this._wake();
    }

    _batch(callback) {
        if (this._batching) return callback();
        this._batching = true;
        try {
            return callback();
        } finally {
            this._batching = false;
            if (this._worker) this._syncWorker();
            this._wake();
        }
    }

    _physicsParameters() {
        const { repulsion, stiffness, friction, gravity, fps, dt, precision, integrator } = this._parameters;
        return { repulsion, stiffness, friction, gravity, fps, dt, precision, integrator };
    }

    _workerSnapshot() {
        return {
            particles: this._particles.map((particle) => ({ ...particle })),
            springs: this._springs.map((spring) => ({ ...spring })),
            parameters: this._physicsParameters(),
            epoch: this._epoch
        };
    }

    _syncWorker() {
        if (this._worker) this._worker.postMessage({ type: 'sync', ...this._workerSnapshot() });
    }

    _createWorker() {
        const workerOption = this._parameters.worker;
        if (workerOption === false || this._workerFailed || typeof Worker === 'undefined') return;
        if (typeof window === 'undefined') return;
        try {
            this._worker = new PhysicsWorker({ name: 'arbor-physics' });
            this._worker.addEventListener('message', (event) => {
                if (event.data.type === 'geometry') {
                    this._workerGeometry = event.data;
                } else if (event.data.type === 'error') {
                    this.onError(new Error(event.data.message));
                }
            });
            this._worker.addEventListener('error', (event) => {
                this.onError(event.error || new Error(event.message || 'Arbor physics worker failed.'));
                this._worker.terminate();
                this._worker = null;
                this._workerFailed = true;
                if (!this._paused) this._scheduleFrame();
            });
            this._worker.postMessage({ type: 'init', ...this._workerSnapshot() });
        } catch (error) {
            this.onError(error);
            if (this._worker) this._worker.terminate();
            this._workerFailed = true;
            this._worker = null;
        }
    }

    _wake() {
        this._settledAt = null;
        if (!this._paused && this._frame === null && this.renderer) this.start();
    }

    _scheduleFrame() {
        if (typeof requestAnimationFrame === 'function') {
            this._frame = requestAnimationFrame((time) => this._onFrame(time));
        } else {
            this._frame = setTimeout(() => this._onFrame(Date.now()), 16);
        }
    }

    _onFrame(time) {
        this._frame = null;
        if (this._destroyed || this._paused) return;
        if (this.renderer && this.renderer !== this._attachedRenderer) {
            if (this._attachedRenderer && typeof this._attachedRenderer.destroy === 'function') {
                this._attachedRenderer.destroy();
            }
            this.renderer.init(this);
            this._attachedRenderer = this.renderer;
        }
        const elapsed = this._lastFrame ? Math.min((time - this._lastFrame) / 1000, 0.05) : this._parameters.dt;
        this._lastFrame = time;
        this._frameTimes.push(Math.max(1, elapsed * 1000));
        if (this._frameTimes.length > 50) this._frameTimes.shift();

        if (this._worker) {
            if (this._workerGeometry) {
                this._updateGeometry(this._workerGeometry);
                this._workerGeometry = null;
            }
        } else {
            if (!this._lastPhysics || time - this._lastPhysics >= 1000 / this._parameters.fps) {
                this._energy = stepPhysics(this._particles, this._springs, this._parameters, this._parameters.dt);
                for (const node of Object.values(this.nodes)) {
                    node._p._x = node._particle.x;
                    node._p._y = node._particle.y;
                }
                this._lastPhysics = time;
            }
        }
        this.tween.tick();
        this._updateBounds();
        if (this.renderer) this.renderer.redraw();

        if (this._energy.mean < 0.0005 && this._energy.max < 0.001) {
            if (this._settledAt === null) this._settledAt = time;
            if (time - this._settledAt > 800 && !this.tween.busy()) {
                this.stop();
                this._lastFrame = 0;
                return;
            }
        } else {
            this._settledAt = null;
        }
        this._scheduleFrame();
    }

    _updateBounds() {
        const target = this._boundsTarget || this.bounds();
        if (!this._bounds) {
            this._bounds = {
                topleft: new Point(target.topleft),
                bottomright: new Point(target.bottomright)
            };
            return true;
        }
        const step = this._screenStep;
        let changed = false;
        for (const key of ['topleft', 'bottomright']) {
            const current = this._bounds[key];
            const desired = target[key];
            const x = current.x + (desired.x - current.x) * step;
            const y = current.y + (desired.y - current.y) * step;
            if (Math.abs(x - current.x) > 1e-4 || Math.abs(y - current.y) > 1e-4) changed = true;
            current._x = x;
            current._y = y;
        }
        return changed;
    }
}

function ParticleSystem(...args) {
    return new ParticleSystemCore(...args);
}

ParticleSystem.prototype = ParticleSystemCore.prototype;
ParticleSystem.prototype.constructor = ParticleSystem;

export { Point, Node, Edge, ParticleSystem };
export default ParticleSystem;
