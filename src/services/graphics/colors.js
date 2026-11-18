const NAMED_COLORS = {
    aliceblue: '#f0f8ff', aqua: '#00ffff', black: '#000000', blue: '#0000ff',
    brown: '#a52a2a', coral: '#ff7f50', crimson: '#dc143c', cyan: '#00ffff',
    gold: '#ffd700', gray: '#808080', green: '#008000', indigo: '#4b0082',
    ivory: '#fffff0', khaki: '#f0e68c', lime: '#00ff00', magenta: '#ff00ff',
    maroon: '#800000', navy: '#000080', olive: '#808000', orange: '#ffa500',
    pink: '#ffc0cb', plum: '#dda0dd', purple: '#800080', red: '#ff0000',
    salmon: '#fa8072', silver: '#c0c0c0', tan: '#d2b48c', teal: '#008080',
    tomato: '#ff6347', transparent: '#00000000', violet: '#ee82ee',
    white: '#ffffff', yellow: '#ffff00'
};

function parseHex(value) {
    const short = /^#([\da-f])([\da-f])([\da-f])$/i.exec(value);
    if (short) return {
        r: parseInt(short[1] + short[1], 16),
        g: parseInt(short[2] + short[2], 16),
        b: parseInt(short[3] + short[3], 16),
        a: 1
    };
    const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})([\da-f]{2})?$/i.exec(value);
    if (!match) return null;
    return {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
        a: match[4] ? parseInt(match[4], 16) / 255 : 1
    };
}

function parseColor(value) {
    if (typeof value !== 'string') return null;
    const normalized = value.trim().toLowerCase();
    const hex = parseHex(NAMED_COLORS[normalized] || normalized);
    if (hex) return hex;
    const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/.exec(normalized);
    if (rgb) return {
        r: Number(rgb[1]),
        g: Number(rgb[2]),
        b: Number(rgb[3]),
        a: rgb[4] === undefined ? 1 : Number(rgb[4])
    };
    if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
            context.fillStyle = '#010203';
            context.fillStyle = normalized;
            if (context.fillStyle !== '#010203' || normalized === '#010203') return parseHex(context.fillStyle);
        }
    }
    return null;
}

const Colors = {
    CSS: NAMED_COLORS,

    decode(color, green, blue, alpha) {
        if (color && typeof color === 'object' &&
            Number.isFinite(color.r) && Number.isFinite(color.g) && Number.isFinite(color.b)) {
            return { r: color.r, g: color.g, b: color.b, a: color.a === undefined ? 1 : color.a };
        }
        if (typeof color === 'number') {
            if (arguments.length >= 3) {
                return { r: color, g: green, b: blue, a: alpha === undefined ? 1 : alpha };
            }
            return { r: color, g: color, b: color, a: green === undefined ? 1 : green };
        }
        if (arguments.length === 2 && typeof color === 'string') {
            const parsed = parseColor(color);
            if (parsed) parsed.a = green;
            return parsed;
        }
        return parseColor(color);
    },

    validate(value) {
        return Boolean(parseColor(value));
    },

    blend(value, alpha = 1) {
        const color = this.decode(value);
        if (!color) return null;
        color.a *= Math.min(1, Math.max(0, alpha));
        return color.a === 1
            ? this.encode(color)
            : `rgba(${color.r},${color.g},${color.b},${color.a})`;
    },

    encode(value) {
        const color = this.decode(value);
        if (!color) return null;
        if (color.a !== 1) return `rgba(${color.r},${color.g},${color.b},${color.a})`;
        const hex = (component) => Math.round(component).toString(16).padStart(2, '0');
        return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
    }
};

export default Colors;
