const NAMED_COLORS = {
    aliceblue: '#f0f8ff', antiquewhite: '#faebd7', aqua: '#00ffff', aquamarine: '#7fffd4',
    azure: '#f0ffff', beige: '#f5f5dc', bisque: '#ffe4c4', black: '#000000',
    blanchedalmond: '#ffebcd', blue: '#0000ff', blueviolet: '#8a2be2', brown: '#a52a2a',
    burlywood: '#deb887', cadetblue: '#5f9ea0', chartreuse: '#7fff00', chocolate: '#d2691e',
    coral: '#ff7f50', cornflowerblue: '#6495ed', cornsilk: '#fff8dc', crimson: '#dc143c',
    cyan: '#00ffff', darkblue: '#00008b', darkcyan: '#008b8b', darkgoldenrod: '#b8860b',
    darkgray: '#a9a9a9', darkgrey: '#a9a9a9', darkgreen: '#006400', darkkhaki: '#bdb76b',
    darkmagenta: '#8b008b', darkolivegreen: '#556b2f', darkorange: '#ff8c00',
    darkorchid: '#9932cc', darkred: '#8b0000', darksalmon: '#e9967a', darkseagreen: '#8fbc8f',
    darkslateblue: '#483d8b', darkslategray: '#2f4f4f', darkslategrey: '#2f4f4f',
    darkturquoise: '#00ced1', darkviolet: '#9400d3', deeppink: '#ff1493', deepskyblue: '#00bfff',
    dimgray: '#696969', dimgrey: '#696969', dodgerblue: '#1e90ff', firebrick: '#b22222',
    floralwhite: '#fffaf0', forestgreen: '#228b22', fuchsia: '#ff00ff', gainsboro: '#dcdcdc',
    ghostwhite: '#f8f8ff', gold: '#ffd700', goldenrod: '#daa520', gray: '#808080',
    grey: '#808080', green: '#008000', greenyellow: '#adff2f', honeydew: '#f0fff0',
    hotpink: '#ff69b4', indianred: '#cd5c5c', indigo: '#4b0082', ivory: '#fffff0',
    khaki: '#f0e68c', lavender: '#e6e6fa', lavenderblush: '#fff0f5', lawngreen: '#7cfc00',
    lemonchiffon: '#fffacd', lightblue: '#add8e6', lightcoral: '#f08080', lightcyan: '#e0ffff',
    lightgoldenrodyellow: '#fafad2', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
    lightgreen: '#90ee90', lightpink: '#ffb6c1', lightsalmon: '#ffa07a',
    lightseagreen: '#20b2aa', lightskyblue: '#87cefa', lightslategray: '#778899',
    lightslategrey: '#778899', lightsteelblue: '#b0c4de', lightyellow: '#ffffe0',
    lime: '#00ff00', limegreen: '#32cd32', linen: '#faf0e6', magenta: '#ff00ff',
    maroon: '#800000', mediumaquamarine: '#66cdaa', mediumblue: '#0000cd',
    mediumorchid: '#ba55d3', mediumpurple: '#9370d8', mediumseagreen: '#3cb371',
    mediumslateblue: '#7b68ee', mediumspringgreen: '#00fa9a', mediumturquoise: '#48d1cc',
    mediumvioletred: '#c71585', midnightblue: '#191970', mintcream: '#f5fffa',
    mistyrose: '#ffe4e1', moccasin: '#ffe4b5', navajowhite: '#ffdead', navy: '#000080',
    oldlace: '#fdf5e6', olive: '#808000', olivedrab: '#6b8e23', orange: '#ffa500',
    orangered: '#ff4500', orchid: '#da70d6', palegoldenrod: '#eee8aa', palegreen: '#98fb98',
    paleturquoise: '#afeeee', palevioletred: '#d87093', papayawhip: '#ffefd5',
    peachpuff: '#ffdab9', peru: '#cd853f', pink: '#ffc0cb', plum: '#dda0dd',
    powderblue: '#b0e0e6', purple: '#800080', rebeccapurple: '#663399', red: '#ff0000',
    rosybrown: '#bc8f8f', royalblue: '#4169e1', saddlebrown: '#8b4513', salmon: '#fa8072',
    sandybrown: '#f4a460', seagreen: '#2e8b57', seashell: '#fff5ee', sienna: '#a0522d',
    silver: '#c0c0c0', skyblue: '#87ceeb', slateblue: '#6a5acd', slategray: '#708090',
    slategrey: '#708090', snow: '#fffafa', springgreen: '#00ff7f', steelblue: '#4682b4',
    tan: '#d2b48c', teal: '#008080', thistle: '#d8bfd8', tomato: '#ff6347',
    transparent: '#00000000', turquoise: '#40e0d0', violet: '#ee82ee', wheat: '#f5deb3',
    white: '#ffffff', whitesmoke: '#f5f5f5', yellow: '#ffff00', yellowgreen: '#9acd32'
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
