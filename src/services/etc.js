function objcopy(value) {
    if (value === null || typeof value !== 'object' || value.parentNode) return value;
    if (Array.isArray(value)) return value.map(objcopy);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, objcopy(item)]));
}

function objcmp(a, b, strictOrdering = false) {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
        return false;
    }
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (!strictOrdering) {
        keysA.sort();
        keysB.sort();
    }
    return keysA.length === keysB.length &&
        keysA.every((key, index) => key === keysB[index] && objcmp(a[key], b[key], strictOrdering));
}

const etc = {
    trace(...args) { console.log(...args); },
    dirname(path) {
        const parts = path.replace(/^\/|\/$/g, '').split('/');
        parts.pop();
        return `/${parts.join('/')}`;
    },
    basename(path) {
        const parts = path.replace(/^\/|\/$/g, '').split('/');
        return parts.pop() || null;
    },
    ordinalize(number) {
        if (number < 11000) return String(number).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,');
        if (number < 1000000) return `${Math.floor(number / 1000)}k`;
        if (number < 1000000000) return `${String(Math.floor(number / 1000)).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,')}m`;
        return String(number);
    },
    objcopy,
    objcmp,
    objkeys(value) { return Object.keys(value); },
    objmerge(destination, source) { return { ...objcopy(destination || {}), ...source }; },
    uniq(values) { return [...new Set(values.map(String))]; },
    arbor_path() {
        if (typeof document === 'undefined') return null;
        for (const script of document.querySelectorAll('script[src]')) {
            const src = script.getAttribute('src');
            if (/(?:^|\/)(?:arbor[^/.]*|dev)\.js(?:[?#]|$)/.test(src)) {
                const index = src.lastIndexOf('/');
                return index < 0 ? '/' : src.slice(0, index + 1);
            }
        }
        return null;
    }
};

export default etc;
