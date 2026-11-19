import { describe, expect, it, vi } from 'vitest';
import Graphics from '../../src/services/graphics/graphics.js';

function createGraphics() {
    const ctx = {
        save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
        rect: vi.fn(), roundRect: vi.fn(), ellipse: vi.fn(), fill: vi.fn(), stroke: vi.fn(),
        moveTo: vi.fn(), lineTo: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(),
        fillText: vi.fn(), measureText: vi.fn(() => ({ width: 42 }))
    };
    const canvas = { width: 100, height: 80, getContext: () => ctx };
    return { graphics: Graphics(canvas), ctx, canvas };
}

describe('Graphics', () => {
    it('sets styles and draws immediate and reusable shapes', () => {
        const { graphics, ctx, canvas } = createGraphics();
        graphics.size(200, 150);
        expect(canvas.width).toBe(200);
        graphics.fill('red');
        graphics.stroke('blue');
        graphics.strokeWidth(2);
        graphics.rect(1, 2, 20, 10, 3);
        expect(ctx.roundRect).toHaveBeenCalledWith(1, 2, 20, 10, 3);
        expect(ctx.fill).toHaveBeenCalledOnce();
        expect(ctx.stroke).toHaveBeenCalledOnce();
        const oval = graphics.Oval(5, 6, 8, 10, { fill: 'white' });
        oval.draw({ stroke: null });
        expect(ctx.ellipse).toHaveBeenCalledWith(9, 11, 4, 5, 0, 0, Math.PI * 2);
        graphics.background('white');
        expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 200, 150);
    });

    it('supports named styles, buffered lines, and text', () => {
        const { graphics, ctx } = createGraphics();
        graphics.drawStyle('line', { stroke: 'red', width: 3 });
        graphics.drawStyle('line');
        graphics.lines(0, 1, 2, 3);
        graphics.lines({ x: 4, y: 5 }, { x: 6, y: 7 });
        graphics.drawLines();
        expect(ctx.lineTo).toHaveBeenCalledTimes(2);
        graphics.drawLines();
        expect(ctx.lineTo).toHaveBeenCalledTimes(2);
        graphics.textStyle({ size: 20, color: 'blue' });
        graphics.text('hello', { x: 10, y: 20 });
        expect(ctx.fillText).toHaveBeenCalledWith('hello', 10, 20);
        expect(graphics.textWidth('hello')).toBe(42);
        expect(graphics.Color('red').toString()).toBe('#ff0000');
        expect(() => graphics.drawStyle('missing')).toThrow(RangeError);
    });
});
