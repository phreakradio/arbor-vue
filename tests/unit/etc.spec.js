import { describe, expect, it } from 'vitest';
import etc from '../../src/services/etc.js';

describe('legacy utilities', () => {
    it('handles paths, values, and unique keys', () => {
        expect(etc.dirname('/a/b')).toBe('/a');
        expect(etc.basename('/a/b/')).toBe('b');
        expect(etc.ordinalize(12000)).toBe('12k');
        expect(etc.uniq(['a', 'b', 'a', 1])).toEqual(['a', 'b', '1']);
        expect(etc.arbor_path()).toBeNull();
    });

    it('copies, merges, and compares nested objects', () => {
        const original = { nested: { n: 1 }, items: [2] };
        const copy = etc.objcopy(original);
        expect(etc.objcmp(original, copy)).toBe(true);
        copy.nested.n = 3;
        expect(original.nested.n).toBe(1);
        expect(etc.objcmp(original, copy)).toBe(false);
        expect(etc.objmerge(original, { more: true })).toEqual({ ...original, more: true });
    });
});
