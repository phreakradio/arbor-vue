import { stepPhysics } from './physics.js';

let particles = [];
let springs = [];
let parameters = {};
let interval = null;
let epoch = 0;

function tick() {
    let energy;
    try {
        energy = stepPhysics(particles, springs, parameters);
    } catch (error) {
        stop();
        self.postMessage({ type: 'error', message: error.message || String(error) });
        return;
    }
    const geometry = new Float64Array(particles.length * 3);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    particles.forEach((particle, index) => {
        const offset = index * 3;
        geometry[offset] = particle.id;
        geometry[offset + 1] = particle.x;
        geometry[offset + 2] = particle.y;
        minX = Math.min(minX, particle.x);
        minY = Math.min(minY, particle.y);
        maxX = Math.max(maxX, particle.x);
        maxY = Math.max(maxY, particle.y);
    });
    const bounds = particles.length
        ? { topleft: { x: minX, y: minY }, bottomright: { x: maxX, y: maxY } }
        : { topleft: { x: -1, y: -1 }, bottomright: { x: 1, y: 1 } };
    self.postMessage({ type: 'geometry', geometry, energy, bounds, epoch }, [geometry.buffer]);
}

function stop() {
    if (interval !== null) clearInterval(interval);
    interval = null;
}

self.addEventListener('message', ({ data }) => {
    switch (data.type) {
    case 'init':
        stop();
        particles = data.particles;
        springs = data.springs;
        parameters = data.parameters;
        epoch = data.epoch ?? 0;
        break;
    case 'sync':
        particles = data.particles;
        springs = data.springs;
        epoch = data.epoch ?? epoch;
        break;
    case 'node': {
        const node = particles.find((particle) => particle.id === data.id);
        if (node) Object.assign(node, data.changes);
        epoch = data.epoch ?? epoch;
        break;
    }
    case 'parameters':
        {
            const wasRunning = interval !== null;
            stop();
            parameters = { ...parameters, ...data.parameters };
            epoch = data.epoch ?? epoch;
            if (wasRunning) interval = setInterval(tick, 1000 / Math.max(1, parameters.fps || 50));
        }
        break;
    case 'start':
        if (interval === null) interval = setInterval(tick, 1000 / Math.max(1, parameters.fps || 50));
        break;
    case 'stop':
        stop();
        break;
    case 'destroy':
        stop();
        self.close();
        break;
    default:
        self.postMessage({ type: 'error', message: `Unknown worker message: ${data.type}` });
    }
});
