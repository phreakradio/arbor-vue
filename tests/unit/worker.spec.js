import { afterEach, describe, expect, it, vi } from 'vitest';

describe('physics worker', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    it('returns geometry tagged with the latest node and parameter updates', async () => {
        vi.useFakeTimers();
        let receive;
        const worker = {
            addEventListener: vi.fn((type, callback) => { receive = callback; }),
            postMessage: vi.fn(),
            close: vi.fn()
        };
        vi.stubGlobal('self', worker);
        await import('../../src/services/physics/worker.js');
        const send = (data) => receive({ data });
        send({
            type: 'init',
            particles: [{ id: 1, x: 0, y: 0, vx: 0, vy: 0, mass: 1, fixed: true }],
            springs: [],
            parameters: { dt: 0.02, fps: 50, repulsion: 0, stiffness: 0 },
            epoch: 1
        });
        send({ type: 'start' });
        send({ type: 'node', id: 1, changes: { x: 4, y: 5 }, epoch: 2 });
        send({ type: 'parameters', parameters: { gravity: true }, epoch: 3 });
        vi.advanceTimersByTime(20);
        const result = worker.postMessage.mock.calls[0][0];
        expect(result.epoch).toBe(3);
        expect(Array.from(result.geometry)).toEqual([1, 4, 5]);
        send({ type: 'destroy' });
        expect(worker.close).toHaveBeenCalledOnce();
    });

    it('reports an unstable configuration and stops its timer', async () => {
        vi.useFakeTimers();
        let receive;
        const worker = {
            addEventListener: vi.fn((type, callback) => { receive = callback; }),
            postMessage: vi.fn(),
            close: vi.fn()
        };
        vi.stubGlobal('self', worker);
        await import('../../src/services/physics/worker.js');
        receive({ data: {
            type: 'init',
            particles: [
                { id: 1, x: 0, y: 0, vx: 0, vy: 0, mass: 1 },
                { id: 2, x: 1, y: 0, vx: 0, vy: 0, mass: 1 }
            ],
            springs: [{ source: 1, target: 2, length: 1 }],
            parameters: { dt: 0.02, fps: 50, stiffness: 1e12 }
        } });
        receive({ data: { type: 'start' } });
        vi.advanceTimersByTime(100);
        expect(worker.postMessage).toHaveBeenCalledOnce();
        expect(worker.postMessage.mock.calls[0][0]).toMatchObject({
            type: 'error', message: expect.stringMatching(/too many substeps/)
        });
    });

    it('applies friction updates to the worker simulation', async () => {
            vi.useFakeTimers();
            let receive;
            const worker = {
                addEventListener: vi.fn((type, callback) => { receive = callback; }),
                postMessage: vi.fn(),
                close: vi.fn()
            };
            vi.stubGlobal('self', worker);
            await import('../../src/services/physics/worker.js');
            receive({ data: {
                type: 'init',
                particles: [{ id: 1, x: 0, y: 0, vx: 10, vy: 0, mass: 1 }],
                springs: [],
                parameters: { dt: 0.01, fps: 50, repulsion: 0, stiffness: 0, friction: 0, integrator: 'euler' }
            } });
            receive({ data: { type: 'start' } });
            vi.advanceTimersByTime(20);
            expect(worker.postMessage.mock.calls[0][0].energy.max).toBeCloseTo(100);
            receive({ data: { type: 'parameters', parameters: { friction: 1 }, epoch: 2 } });
            vi.advanceTimersByTime(20);
            expect(worker.postMessage.mock.calls[1][0].energy.max).toBe(0);
            receive({ data: { type: 'destroy' } });
    });
});
