let nextNodeId = 1;
let nextEdgeId = -1;

export class Point {
    constructor(x = 0, y = 0, onChange = null) {
        if (typeof x === 'object' && x !== null) {
            y = x.y;
            x = x.x;
        }
        this._x = x;
        this._y = y;
        this._onChange = onChange;
    }

    get x() { return this._x; }
    set x(value) {
        this._x = value;
        if (this._onChange) this._onChange(this);
    }
    get y() { return this._y; }
    set y(value) {
        this._y = value;
        if (this._onChange) this._onChange(this);
    }

    exploded() { return !Number.isFinite(this.x) || !Number.isFinite(this.y); }
    add(point) { return new Point(this.x + point.x, this.y + point.y); }
    subtract(point) { return new Point(this.x - point.x, this.y - point.y); }
    multiply(value) { return new Point(this.x * value, this.y * value); }
    divide(value) { return new Point(this.x / value, this.y / value); }
    magnitude() { return Math.hypot(this.x, this.y); }
    normal() { return new Point(-this.y, this.x); }
    normalize() {
        const magnitude = this.magnitude();
        return magnitude ? this.divide(magnitude) : new Point(0, 0);
    }

    static random(radius = 5) {
        return new Point((Math.random() * 2 - 1) * radius, (Math.random() * 2 - 1) * radius);
    }
}

export class Node {
    constructor(name, data = {}, onChange = null) {
        this._id = nextNodeId++;
        this.name = name;
        this.data = { ...data };
        this._mass = Number.isFinite(data.mass) && data.mass > 0 ? data.mass : 1;
        this._fixed = data.fixed === true;
        this._onChange = onChange;
        const x = Number.isFinite(data.x) ? data.x : (Math.random() - 0.5) * 2;
        const y = Number.isFinite(data.y) ? data.y : (Math.random() - 0.5) * 2;
        this._p = new Point(x, y, () => this._changed({ x: this._p.x, y: this._p.y }));
        delete this.data.x;
        delete this.data.y;
        delete this.data.mass;
        delete this.data.fixed;
        this._tempMass = null;
    }

    get p() { return this._p; }
    set p(value) {
        this._p._x = value.x;
        this._p._y = value.y;
        this._changed({ x: value.x, y: value.y });
    }
    get mass() { return this._mass; }
    set mass(value) {
        if (!Number.isFinite(value) || value <= 0) throw new RangeError('Node mass must be a positive number.');
        this._mass = value;
        this._changed({ mass: value });
    }
    get fixed() { return this._fixed; }
    set fixed(value) {
        this._fixed = Boolean(value);
        this._changed({ fixed: this._fixed });
    }
    get tempMass() { return this._tempMass; }
    set tempMass(value) {
        this._tempMass = Number.isFinite(value) && value > 0 ? value : null;
        this._changed({ tempMass: this._tempMass });
    }

    _changed(change) {
        if (this._onChange) this._onChange(this, change);
    }
}

export class Edge {
    constructor(source, target, data = {}) {
        this._id = nextEdgeId--;
        this.source = source;
        this.target = target;
        this.length = Number.isFinite(data.length) && data.length > 0 ? data.length : 1;
        this.data = { ...data };
        delete this.data.length;
    }
}

export class Particle {
    constructor(position, mass = 1) {
        this.p = position;
        this.m = mass;
        this.v = new Point(0, 0);
        this.f = new Point(0, 0);
    }

    applyForce(force) {
        this.f = this.f.add(force.divide(this.m));
    }
}

export class Spring {
    constructor(point1, point2, length = 1, stiffness = 600) {
        this.point1 = point1;
        this.point2 = point2;
        this.length = length;
        this.k = stiffness;
    }
}

export default { Node, Edge, Particle, Spring, Point };
