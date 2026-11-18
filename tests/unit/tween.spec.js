import { describe, expect, it } from 'vitest';
import Tween from '../../src/services/tween/tween.js';

describe('Tween', () => {
    it('interpolates numeric and color data then marks the animation complete', () => {
        const tween = Tween();
        const node = { _id: 1, data: { alpha: 0, color: '#000000' } };
        tween.to(node, 1, { alpha: 1, color: '#ffffff' });
        const start = Date.now();

        expect(tween.busy()).toBe(true);
        tween.tick(start + 500);
        expect(node.data.alpha).toBeCloseTo(0.5);
        expect(node.data.color).toBe('#808080');
        tween.tick(start + 1000);
        expect(node.data.alpha).toBe(1);
        expect(node.data.color).toBe('#ffffff');
        expect(tween.busy()).toBe(false);
    });

    it('supports delays, easing, and replacing an animation of the same field', () => {
        const tween = Tween();
        const node = { _id: 2, data: { radius: 2 } };
        const start = Date.now();
        tween.to(node, 1, { radius: 10 });
        tween.to(node, 1, { radius: 6, delay: 0.5, easing: 'quadin' });

        tween.tick(start + 250);
        expect(node.data.radius).toBe(2);
        tween.tick(start + 1000);
        expect(node.data.radius).toBeGreaterThan(2);
        expect(node.data.radius).toBeLessThan(6);
        tween.tick(start + 1600);
        expect(node.data.radius).toBe(6);
        expect(tween.busy()).toBe(false);
    });
});
