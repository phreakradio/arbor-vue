import { describe, expect, it } from 'vitest';
import { treePositions } from '../../src/demo/tree-layout.js';

describe('demo tree layout', () => {
    it('places parents above and centered over their children', () => {
        const positions = treePositions('root', {
            root: { a: {}, b: {} },
            a: { c: {}, d: {} },
            b: { e: {}, f: {} }
        });
        expect(positions).toEqual({
            root: { x: 0, y: 0 },
            a: { x: -2, y: 2 },
            b: { x: 2, y: 2 },
            c: { x: -3, y: 4 },
            d: { x: -1, y: 4 },
            e: { x: 1, y: 4 },
            f: { x: 3, y: 4 }
        });
    });

    it('accommodates uneven branches and a single-node tree', () => {
        expect(treePositions('root', {})).toEqual({ root: { x: 0, y: 0 } });
        const positions = treePositions('root', {
            root: { a: {}, b: {} },
            a: { c: {} },
            c: { d: {} }
        });
        expect(positions.d.y).toBe(6);
        expect(positions.a.x).toBe(positions.d.x);
        expect(positions.a.x).toBeLessThan(positions.b.x);
        expect(positions.root.x).toBe((positions.a.x + positions.b.x) / 2);
    });
});
