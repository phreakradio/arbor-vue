import { describe, expect, it } from 'vitest';
import stepPhysics from '../../src/services/physics/physics.js';

const parameters = {
    repulsion: 100,
    stiffness: 10,
    friction: 0,
    gravity: false,
    precision: 0.6,
    integrator: 'verlet',
    dt: 0.01
};

describe('physics step', () => {
    it('repels disconnected particles without producing invalid positions', () => {
        const particles = [
            { id: 1, x: -1, y: 0, vx: 0, vy: 0, mass: 1, fixed: false },
            { id: 2, x: 1, y: 0, vx: 0, vy: 0, mass: 1, fixed: false }
        ];
        const energy = stepPhysics(particles, [], parameters);
        expect(particles[0].x).toBeLessThan(-1);
        expect(particles[1].x).toBeGreaterThan(1);
        expect(energy.mean).toBeGreaterThan(0);
    });

    it('pulls spring-connected particles toward their rest length', () => {
        const particles = [
            { id: 1, x: 0, y: 0, vx: 0, vy: 0, mass: 1, fixed: false },
            { id: 2, x: 2, y: 0, vx: 0, vy: 0, mass: 1, fixed: false }
        ];
        stepPhysics(particles, [{ source: 1, target: 2, length: 1 }], {
            ...parameters,
            repulsion: 0
        });
        expect(particles[0].x).toBeGreaterThan(0);
        expect(particles[1].x).toBeLessThan(2);
    });

    it('holds fixed particles and handles large graphs using the quadtree', () => {
        const particles = Array.from({ length: 150 }, (_, id) => ({
            id,
            x: Math.cos(id) * 10,
            y: Math.sin(id) * 10,
            vx: 0,
            vy: 0,
            mass: 1,
            fixed: id === 0
        }));
        stepPhysics(particles, [], parameters);
        expect(particles[0].x).toBeCloseTo(10);
        expect(particles.every((particle) => Number.isFinite(particle.x) && Number.isFinite(particle.y))).toBe(true);
    });
});
