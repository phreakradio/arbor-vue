import { describe, expect, it, vi } from 'vitest';
import ParticleSystem from '../../src/services/physics/system.js';
import Renderer from '../../src/services/renderer.js';

describe('renderer dragging', () => {
    it('keeps the viewport fixed while dragging and resumes smooth fitting on release', () => {
        const system = new ParticleSystem({ worker: false });
        const dragged = system.addNode('dragged', { x: 0, y: 0 });
        const neighbor = system.addNode('neighbor', { x: 10, y: 10 });
        system.screenSize(400, 400);
        system.screenPadding(0);
        system._updateBounds();
        const canvas = {
            getContext: () => ({}),
            getBoundingClientRect: () => ({ left: 0, top: 0 }),
            setPointerCapture: vi.fn(),
            removeEventListener: vi.fn()
        };
        const renderer = new Renderer(canvas);
        renderer.system = system;
        const pointer = (x, y) => ({
            button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault: vi.fn()
        });
        const point = system.toScreen(dragged.p);
        renderer._pointerDown(pointer(point.x, point.y));
        expect(dragged.fixed).toBe(true);

        const before = system.toScreen(neighbor.p);
        renderer._pointerMove(pointer(600, 600));
        for (let i = 0; i < 10; i++) system._updateBounds();
        expect(system.toScreen(neighbor.p).x).toBeCloseTo(before.x);
        expect(system.toScreen(neighbor.p).y).toBeCloseTo(before.y);
        expect(system.toScreen(dragged.p).x).toBeCloseTo(600);
        renderer._pointerUp(pointer(600, 600));
        expect(dragged.fixed).toBe(false);
        system._updateBounds();
        expect(system.toScreen(neighbor.p).x).toBeLessThan(before.x);
        expect(system.toScreen(neighbor.p).x).toBeGreaterThan(before.x - 20);
        renderer.destroy();
        system.destroy();
    });

    it('unlocks the viewport when the renderer is destroyed during a drag', () => {
        const system = new ParticleSystem({ worker: false });
        const node = system.addNode('node', { x: 0, y: 0, fixed: true });
        system.screenSize(400, 400);
        const canvas = {
            getContext: () => ({}),
            getBoundingClientRect: () => ({ left: 0, top: 0 }),
            setPointerCapture: vi.fn(),
            removeEventListener: vi.fn()
        };
        const renderer = new Renderer(canvas);
        renderer.system = system;
        const point = system.toScreen(node.p);
        renderer._pointerDown({
            button: 0, pointerId: 1, clientX: point.x, clientY: point.y, preventDefault: vi.fn()
        });
        expect(system._boundsLocked).toBe(true);
        renderer.destroy();
        expect(system._boundsLocked).toBe(false);
        expect(node.fixed).toBe(true);
        system.destroy();
    });
});
