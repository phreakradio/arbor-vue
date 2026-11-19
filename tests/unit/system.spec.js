import { describe, expect, it, vi } from 'vitest';
import ParticleSystem, { Point } from '../../src/services/physics/system.js';

describe('ParticleSystem graph API', () => {
    it('supports callable and constructible points', () => {
        const point = Point(2, 3);
        expect(point).toBeInstanceOf(Point);
        expect(new Point(point).add(Point(1, 1))).toMatchObject({ x: 3, y: 4 });
        expect(Point.random(0).magnitude()).toBe(0);
    });

    it('returns energy statistics without exposing mutable internal state', () => {
        const system = new ParticleSystem({ worker: false });
        expect(system.energy()).toEqual({ sum: 0, max: 0, mean: 0, n: 0 });
        system._updateGeometry({ epoch: system._epoch, energy: { sum: 4, max: 3, mean: 2, n: 2 } });
        const energy = system.energy();
        energy.sum = 100;
        expect(system.energy().sum).toBe(4);
        system.destroy();
    });

    it('updates spring lengths after direct edits and branch reconciliation', () => {
        const system = new ParticleSystem({ worker: false });
        const edge = system.addEdge('a', 'b', { length: 1 });
        edge.length = 2;
        expect(system._springs[0].length).toBe(2);
        system.graft({ edges: { a: { b: { length: 3 } } } });
        expect(system._springs[0].length).toBe(3);
        expect(() => { edge.length = 0; }).toThrow(RangeError);
        system.destroy();
    });

    it('returns Arbor-compatible prune results', () => {
        const system = new ParticleSystem({ worker: false });
        const edge = system.addEdge('a', 'b');
        const result = system.prune((node) => node.name === 'a');
        expect(result.dropped.nodes.map((node) => node.name)).toEqual(['a']);
        expect(result.dropped.edges).toEqual([edge]);
        system.destroy();
    });

    it('supports Arbor-style calls as well as construction and validates options', () => {
        const system = ParticleSystem({ worker: false });
        expect(system).toBeInstanceOf(ParticleSystem);
        expect(() => new ParticleSystem({ friction: 2 })).toThrow(RangeError);
        system.destroy();
    });

    it('honors targetFps and timeout aliases at construction', () => {
        const byRate = ParticleSystem({ worker: false, targetFps: 25 });
        const byTimeout = ParticleSystem({ worker: false, timeout: 40 });
        expect(byRate.parameters().fps).toBe(25);
        expect(byTimeout.parameters().fps).toBe(25);
        byRate.destroy();
        byTimeout.destroy();
    });

    it('adds named nodes and edges, then removes incident edges with a node', () => {
        const system = new ParticleSystem({ worker: false });
        const a = system.addNode('a', { x: 0, y: 1, color: 'red' });
        const b = system.addNode('b', { x: 4, y: 5 });
        const edge = system.addEdge(a, b, { length: 2, weight: 3 });

        expect(system.getNode('a')).toBe(a);
        expect(system.getEdges(a, b)).toEqual([edge]);
        expect(system.getEdgesFrom(a)).toEqual([edge]);
        expect(system.getEdgesTo(b)).toEqual([edge]);
        expect(a.data).toEqual({ color: 'red' });
        expect(edge.data).toEqual({ weight: 3 });

        system.pruneNode(a);
        expect(system.getNode('a')).toBeUndefined();
        expect(Object.keys(system.edges)).toHaveLength(0);
    });

    it('grafts and merges graph branches while reporting changes', () => {
        const system = new ParticleSystem({ worker: false });
        const branch = {
            nodes: { a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
            edges: { a: { b: { length: 2 } } }
        };
        expect(system.graft(branch).added.nodes).toHaveLength(2);
        expect(system.graft(branch).added.edges).toHaveLength(0);

        const changes = system.merge({ nodes: { b: { x: 2, y: 0 } }, edges: {} });
        expect(changes.dropped.nodes.map((node) => node.name)).toEqual(['a']);
        expect(system.getNode('b').p.x).toBe(2);
        expect(Object.keys(system.edges)).toHaveLength(0);
    });

    it('creates endpoint nodes when grafting edges without a nodes block', () => {
        const system = new ParticleSystem({ worker: false });
        const changes = system.graft({ edges: { source: { target: {} } } });
        expect(changes.added.nodes.map((node) => node.name)).toEqual(['source', 'target']);
        expect(system.getEdges('source', 'target')).toHaveLength(1);
    });

    it('maps coordinates and finds the nearest node in screen space', () => {
        const system = new ParticleSystem({ worker: false });
        const a = system.addNode('a', { x: 0, y: 0 });
        system.addNode('b', { x: 10, y: 10 });
        system.screenSize(200, 100);
        system.screenPadding(0);

        const screenPoint = system.toScreen(a.p);
        expect(screenPoint.x).toBeCloseTo(0);
        expect(screenPoint.y).toBeCloseTo(0);
        expect(system.fromScreen(screenPoint).x).toBeCloseTo(0);
        expect(system.nearest(screenPoint).node).toBe(a);
    });

    it('chooses the visually nearest node when screen scaling differs by axis', () => {
        const system = new ParticleSystem({ worker: false });
        const a = system.addNode('a', { x: 0, y: 1 });
        const b = system.addNode('b', { x: 1, y: 0 });
        system.screenSize(1000, 100);
        system.screenPadding(0);
        const point = { x: system.toScreen(b.p).x, y: system.toScreen(a.p).y };
        expect(system.nearest(point).node).toBe(b);
        system.destroy();
    });

    it('wakes after settling on parameter and node changes but honors an explicit stop', () => {
        vi.useFakeTimers();
        const system = new ParticleSystem({ worker: false, repulsion: 0, stiffness: 0 });
        const renderer = { init: vi.fn(), redraw: vi.fn(), destroy: vi.fn() };
        try {
            system.renderer = renderer;
            const node = system.addNode('fixed', { x: 0, y: 0, fixed: true });
            system.start();
            vi.advanceTimersByTime(1100);
            expect(system._frame).toBeNull();
            expect(system._paused).toBe(false);

            const redraws = renderer.redraw.mock.calls.length;
            system.parameters({ gravity: true });
            vi.advanceTimersByTime(20);
            expect(renderer.redraw.mock.calls.length).toBeGreaterThan(redraws);

            vi.advanceTimersByTime(1100);
            expect(system._frame).toBeNull();
            node.p = { x: 1, y: 1 };
            expect(system._frame).not.toBeNull();
            vi.advanceTimersByTime(20);
            expect(node.p.x).toBe(1);

            system.stop();
            system.parameters({ gravity: false });
            node.p.x = 2;
            expect(system._frame).toBeNull();
            expect(system._paused).toBe(true);
            system.start();
            expect(system._frame).not.toBeNull();
        } finally {
            system.destroy();
            vi.useRealTimers();
        }
    });

    it('does not auto-settle while maximum-friction particles are still moving', () => {
        vi.useFakeTimers();
        const system = new ParticleSystem({ worker: false, friction: 1, repulsion: 700, stiffness: 0 });
        system.renderer = { init: vi.fn(), redraw: vi.fn(), destroy: vi.fn() };
        try {
            system.addNode('left', { x: -1, y: 0 });
            system.addNode('right', { x: 1, y: 0 });
            system.start();
            vi.advanceTimersByTime(1200);
            expect(system.energy().max).toBe(0);
            expect(system._energy.motion).toBeGreaterThan(0.001);
            expect(system._frame).not.toBeNull();
        } finally {
            system.destroy();
            vi.useRealTimers();
        }
    });

    it('reports and stops an inline simulation that exceeds the substep limit', () => {
        const onError = vi.fn();
        const system = new ParticleSystem({ worker: false, stiffness: 1e12, onError });
        system.renderer = { init: vi.fn(), redraw: vi.fn(), destroy: vi.fn() };
        system.addEdge('a', 'b');
        system._onFrame(1);
        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][0].message).toMatch(/too many substeps/);
        expect(system._paused).toBe(true);
        system.destroy();
    });

    it('ignores worker geometry from before a node or parameter update', () => {
        const system = new ParticleSystem({ worker: false });
        const node = system.addNode('dragged', { x: 0, y: 0 });
        const worker = { postMessage: vi.fn(), terminate: vi.fn() };
        system._worker = worker;
        const oldEpoch = system._epoch;
        node.p = { x: 4, y: 5 };
        expect(worker.postMessage).toHaveBeenLastCalledWith({
            type: 'node', id: node._id, changes: { x: 4, y: 5 }, epoch: system._epoch
        });
        system._updateGeometry({ epoch: oldEpoch, geometry: [node._id, 0, 0] });
        expect(node.p.x).toBe(4);
        expect(node.p.y).toBe(5);
        const beforeParameters = system._epoch;
        system.parameters({ gravity: true });
        system._updateGeometry({ epoch: beforeParameters, geometry: [node._id, 2, 2] });
        expect(node.p.x).toBe(4);
        system._updateGeometry({ epoch: system._epoch, geometry: [node._id, 6, 7] });
        expect(node.p.x).toBe(6);
        system.destroy();
    });

    it('updates other nodes during a stream of stale drag updates without moving the dragged node', () => {
        const system = new ParticleSystem({ worker: false });
        const dragged = system.addNode('dragged', { x: 0, y: 0 });
        const neighbor = system.addNode('neighbor', { x: 1, y: 0 });
        let workerEpoch = system._epoch;
        for (let frame = 1; frame <= 50; frame++) {
            dragged.p = { x: frame, y: 0 };
            system._updateGeometry({
                epoch: workerEpoch,
                geometry: [dragged._id, frame - 1, 0, neighbor._id, 1 + frame * 0.1, 0],
                bounds: { topleft: { x: -100, y: 0 }, bottomright: { x: 100, y: 0 } }
            });
            expect(dragged.p.x).toBe(frame);
            expect(neighbor.p.x).toBeCloseTo(1 + frame * 0.1);
            expect(system._boundsTarget.bottomright.x).toBe(Math.max(frame, neighbor.p.x));
            workerEpoch = system._epoch;
        }
        system._updateGeometry({
            epoch: workerEpoch,
            geometry: [dragged._id, 50, 0, neighbor._id, 6.1, 0]
        });
        expect(neighbor.p.x).toBeCloseTo(6.1);
        system.destroy();
    });

    it('rejects geometry from before a graph change even for retained nodes', () => {
        const system = new ParticleSystem({ worker: false });
        const node = system.addNode('retained', { x: 0, y: 0 });
        const oldEpoch = system._epoch;
        system.addNode('new');
        system._updateGeometry({ epoch: oldEpoch, geometry: [node._id, 9, 9] });
        expect(node.p.x).toBe(0);
        system.destroy();
    });

    it('supports direct position/fixed updates and safe lookups', () => {
        const system = new ParticleSystem({ worker: false });
        const node = system.addNode('moving');
        expect(system.getNode(undefined)).toBeUndefined();
        node.p.x = 3;
        node.fixed = true;
        expect(node.p.x).toBe(3);
        expect(node.fixed).toBe(true);
        expect(system.pruneEdge({ _id: -123 })).toBeUndefined();
    });

    it('attaches and redraws an assigned renderer from the system run loop', async () => {
        const system = new ParticleSystem({ worker: false });
        const renderer = { init: vi.fn(), redraw: vi.fn(), destroy: vi.fn() };
        system.renderer = renderer;
        system.addNode('visible');
        system.start();
        await new Promise((resolve) => setTimeout(resolve, 40));
        system.destroy();

        expect(renderer.init).toHaveBeenCalledWith(system);
        expect(renderer.redraw).toHaveBeenCalled();
        expect(renderer.destroy).toHaveBeenCalled();
    });
});
