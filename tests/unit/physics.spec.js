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
    it('applies the requested friction to particle velocity', () => {
        const make = () => [{ id: 1, x: 0, y: 0, vx: 10, vy: 0, mass: 1, fixed: false }];
        const noFriction = make();
        const halfFriction = make();
        const fullFriction = make();
        const options = { ...parameters, repulsion: 0, stiffness: 0 };
        stepPhysics(noFriction, [], { ...options, friction: 0 });
        stepPhysics(halfFriction, [], { ...options, friction: 0.5 });
        stepPhysics(fullFriction, [], { ...options, friction: 1 });
        expect(noFriction[0].vx).toBeCloseTo(10);
        expect(halfFriction[0].vx).toBeCloseTo(5);
        expect(fullFriction[0].vx).toBe(0);
    });

    it('reports movement even when maximum friction eliminates velocity', () => {
        const particles = [
            { id: 1, x: -1, y: 0, vx: 0, vy: 0, mass: 1 },
            { id: 2, x: 1, y: 0, vx: 0, vy: 0, mass: 1 }
        ];
        const energy = stepPhysics(particles, [], { ...parameters, friction: 1 });
        expect(energy.max).toBe(0);
        expect(energy.motion).toBeGreaterThan(0.001);
    });

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

    it.each([
        [25, 'verlet'], [100, 'verlet'], [25, 'euler'], [100, 'euler']
    ])('keeps a %i-node hub stable at maximum demo stiffness with %s', (count, integrator) => {
        const particles = Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            x: index ? Math.cos(index * 2.399) * 1.5 : 0,
            y: index ? Math.sin(index * 2.399) * 1.5 : 0,
            vx: 0, vy: 0, mass: 1, fixed: false
        }));
        const springs = particles.slice(1).map((particle) => ({
            source: 1, target: particle.id, length: 1
        }));
        let lastDisplacement = 0;
        for (let tick = 0; tick < 2000; tick++) {
            const previous = particles.map(({ x, y }) => ({ x, y }));
            stepPhysics(particles, springs, {
                ...parameters, repulsion: 700, stiffness: 1500, friction: 0.5, dt: 0.015, integrator
            });
            lastDisplacement = Math.max(...particles.map((particle, index) =>
                Math.hypot(particle.x - previous[index].x, particle.y - previous[index].y)));
            expect(lastDisplacement).toBeLessThan(2);
            expect(particles.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
        }
        expect(lastDisplacement).toBeLessThan(0.01);
    });

    it('pulls toward the origin with gravity while repulsion pushes particles apart', () => {
        const initial = [
            { id: 1, x: -2, y: 0, vx: 0, vy: 0, mass: 1, fixed: false },
            { id: 2, x: 2, y: 0, vx: 0, vy: 0, mass: 1, fixed: false }
        ];
        const withoutGravity = initial.map((particle) => ({ ...particle }));
        const withGravity = initial.map((particle) => ({ ...particle }));
        const options = { ...parameters, repulsion: 700, stiffness: 0 };
        stepPhysics(withoutGravity, [], options);
        stepPhysics(withGravity, [], { ...options, gravity: true });
        expect(withoutGravity[0].x).toBeLessThan(-2);
        expect(withGravity[0].x).toBeGreaterThan(withoutGravity[0].x);
        expect(withGravity[1].x).toBeLessThan(withoutGravity[1].x);
    });

    it('rejects configurations that require too many spring subdivisions', () => {
        const particles = [
            { id: 1, x: 0, y: 0, vx: 0, vy: 0, mass: 1 },
            { id: 2, x: 1, y: 0, vx: 0, vy: 0, mass: 1 }
        ];
        expect(() => stepPhysics(particles, [{ source: 1, target: 2, length: 1 }], {
            ...parameters, stiffness: 1e12
        })).toThrow(/too many substeps/);
    });
});
