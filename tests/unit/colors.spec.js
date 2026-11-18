import { describe, expect, it } from 'vitest';
import Colors from '../../src/services/graphics/colors.js';

describe('Colors', () => {
    it('decodes CSS names, short hex, full hex, and rgba values', () => {
        expect(Colors.decode('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
        expect(Colors.decode('#f00')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
        expect(Colors.decode('#01020380')).toEqual({ r: 1, g: 2, b: 3, a: 128 / 255 });
        expect(Colors.decode('rgba(10,20,30,0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    });

    it('supports numeric and object color arguments', () => {
        expect(Colors.decode(128, 0.7)).toEqual({ r: 128, g: 128, b: 128, a: 0.7 });
        expect(Colors.decode(1, 2, 3, 0.4)).toEqual({ r: 1, g: 2, b: 3, a: 0.4 });
        expect(Colors.decode({ r: 1, g: 2, b: 3 })).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    });

    it('encodes colors and applies alpha', () => {
        expect(Colors.encode('red')).toBe('#ff0000');
        expect(Colors.blend('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
        expect(Colors.validate('not-a-color')).toBe(false);
    });
});
