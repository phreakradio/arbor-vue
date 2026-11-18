import { describe, expect, it, vi } from 'vitest';
import ParticleSystem from '../../src/services/physics/system.js';

describe('ParticleSystem graph API', () => {
    it('supports Arbor-style calls as well as construction and validates options', () => {
        const system = ParticleSystem({ worker: false });
        expect(system).toBeInstanceOf(ParticleSystem);
        expect(() => new ParticleSystem({ friction: 2 })).toThrow(RangeError);
        system.destroy();
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
