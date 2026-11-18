const MIN_DISTANCE = 1;
const MAX_SPEED = 1000;
const DIRECT_REPULSION_LIMIT = 128;

function makeTree(particles) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const particle of particles) {
        minX = Math.min(minX, particle.x);
        minY = Math.min(minY, particle.y);
        maxX = Math.max(maxX, particle.x);
        maxY = Math.max(maxY, particle.y);
    }

    const size = Math.max(maxX - minX, maxY - minY, 1);
    const root = { x: minX, y: minY, size, particles, children: null };

    function subdivide(cell, depth) {
        if (cell.particles.length <= 1 || depth >= 24 || cell.size < 1e-8) return;
        const half = cell.size / 2;
        const buckets = [[], [], [], []];
        for (const particle of cell.particles) {
            const east = particle.x >= cell.x + half ? 1 : 0;
            const south = particle.y >= cell.y + half ? 2 : 0;
            buckets[east + south].push(particle);
        }
        if (buckets.some((bucket) => bucket.length === cell.particles.length)) return;
        cell.children = buckets.map((bucket, index) => {
            const child = {
                x: cell.x + (index % 2 ? half : 0),
                y: cell.y + (index > 1 ? half : 0),
                size: half,
                particles: bucket,
                children: null
            };
            if (bucket.length > 1) subdivide(child, depth + 1);
            return child;
        });
        cell.particles = null;
    }

    subdivide(root, 0);

    function summarize(cell) {
        if (cell.children) {
            cell.mass = 0;
            cell.cx = 0;
            cell.cy = 0;
            for (const child of cell.children) {
                summarize(child);
                cell.mass += child.mass;
                cell.cx += child.cx * child.mass;
                cell.cy += child.cy * child.mass;
            }
        } else {
            cell.mass = 0;
            cell.cx = 0;
            cell.cy = 0;
            for (const particle of cell.particles) {
                cell.mass += particle.mass;
                cell.cx += particle.x * particle.mass;
                cell.cy += particle.y * particle.mass;
            }
        }
        if (cell.mass) {
            cell.cx /= cell.mass;
            cell.cy /= cell.mass;
        }
    }
    summarize(root);
    return root;
}

function addRepulsion(target, sourceX, sourceY, sourceMass, repulsion) {
    let dx = target.x - sourceX;
    let dy = target.y - sourceY;
    let distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < MIN_DISTANCE * MIN_DISTANCE) {
        if (distanceSquared === 0) {
            dx = target.id % 2 ? 0.01 : -0.01;
            dy = target.id % 3 ? 0.01 : -0.01;
        }
        distanceSquared = Math.max(dx * dx + dy * dy, MIN_DISTANCE * MIN_DISTANCE);
    }
    const scale = repulsion * sourceMass / (distanceSquared * Math.sqrt(distanceSquared) * target.mass);
    target.fx += dx * scale;
    target.fy += dy * scale;
}

function contains(cell, particle) {
    return particle.x >= cell.x && particle.x <= cell.x + cell.size &&
        particle.y >= cell.y && particle.y <= cell.y + cell.size;
}

function applyTreeForce(target, cell, repulsion, theta) {
    if (!cell || !cell.mass) return;
    if (!cell.children) {
        for (const other of cell.particles) {
            if (other !== target) addRepulsion(target, other.x, other.y, other.mass, repulsion);
        }
        return;
    }
    const dx = target.x - cell.cx;
    const dy = target.y - cell.cy;
    const distance = Math.max(Math.hypot(dx, dy), MIN_DISTANCE);
    if (!contains(cell, target) && cell.size / distance < theta) {
        addRepulsion(target, cell.cx, cell.cy, cell.mass, repulsion);
        return;
    }
    for (const child of cell.children) applyTreeForce(target, child, repulsion, theta);
}

export function stepPhysics(particles, springs, parameters, dt = parameters.dt) {
    const repulsion = Math.max(0, parameters.repulsion || 0);
    const stiffness = Math.max(0, parameters.stiffness || 0);
    const friction = Math.min(1, Math.max(0, parameters.friction ?? 0.5));
    const theta = Math.max(0.1, 1 - (parameters.precision ?? 0.6));

    for (const particle of particles) {
        particle.fx = 0;
        particle.fy = 0;
    }

    if (repulsion > 0) {
        if (particles.length < DIRECT_REPULSION_LIMIT) {
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const a = particles[i];
                    const b = particles[j];
                    addRepulsion(a, b.x, b.y, b.mass, repulsion);
                    addRepulsion(b, a.x, a.y, a.mass, repulsion);
                }
            }
        } else {
            const tree = makeTree(particles);
            for (const particle of particles) applyTreeForce(particle, tree, repulsion, theta);
        }
    }

    const byId = new Map(particles.map((particle) => [particle.id, particle]));
    for (const spring of springs) {
        const a = byId.get(spring.source);
        const b = byId.get(spring.target);
        if (!a || !b || stiffness === 0) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.max(Math.hypot(dx, dy), 1e-9);
        const force = (distance - spring.length) * stiffness * 0.5;
        const fx = dx / distance * force;
        const fy = dy / distance * force;
        a.fx += fx / a.mass;
        a.fy += fy / a.mass;
        b.fx -= fx / b.mass;
        b.fy -= fy / b.mass;
    }

    if (particles.length) {
        let centerX = 0;
        let centerY = 0;
        for (const particle of particles) {
            centerX += particle.x;
            centerY += particle.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        const gravityStrength = repulsion / 100;
        for (const particle of particles) {
            particle.fx -= centerX / particles.length / particle.mass;
            particle.fy -= centerY / particles.length / particle.mass;
            if (parameters.gravity) {
                particle.fx -= particle.x * gravityStrength / particle.mass;
                particle.fy -= particle.y * gravityStrength / particle.mass;
            }
        }
    }

    let energy = 0;
    let maxEnergy = 0;
    for (const particle of particles) {
        if (particle.fixed) {
            particle.vx = 0;
            particle.vy = 0;
            continue;
        }
        const tempMass = particle.tempMass || particle.mass;
        const accelerationX = particle.fx / tempMass;
        const accelerationY = particle.fy / tempMass;
        particle.vx = (particle.vx + accelerationX * dt) * (1 - friction);
        particle.vy = (particle.vy + accelerationY * dt) * (1 - friction);
        const speed = Math.hypot(particle.vx, particle.vy);
        if (speed > MAX_SPEED) {
            particle.vx = particle.vx / speed * MAX_SPEED;
            particle.vy = particle.vy / speed * MAX_SPEED;
        }
        if (particle.tempMass && Math.abs(particle.mass - particle.tempMass) < 1) {
            particle.tempMass = null;
        } else if (particle.tempMass) {
            particle.tempMass *= 0.98;
        }
        const verletOffset = parameters.integrator === 'euler' ? 0 : 0.5;
        particle.x += particle.vx * dt + accelerationX * dt * dt * verletOffset;
        particle.y += particle.vy * dt + accelerationY * dt * dt * verletOffset;
        const particleEnergy = particle.vx * particle.vx + particle.vy * particle.vy;
        energy += particleEnergy;
        maxEnergy = Math.max(maxEnergy, particleEnergy);
    }

    return {
        mean: particles.length ? energy / particles.length : 0,
        max: maxEnergy,
        sum: energy,
        n: particles.length
    };
}

export default stepPhysics;
