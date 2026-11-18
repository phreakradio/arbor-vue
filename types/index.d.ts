import type { DefineComponent, Plugin } from 'vue';

export interface PointLike {
    x: number;
    y: number;
}

export class Point implements PointLike {
    constructor(x?: number | PointLike, y?: number);
    x: number;
    y: number;
    exploded(): boolean;
    add(point: PointLike): Point;
    subtract(point: PointLike): Point;
    multiply(value: number): Point;
    divide(value: number): Point;
    magnitude(): number;
    normal(): Point;
    normalize(): Point;
    static random(radius?: number): Point;
}

export interface NodeData {
    x?: number;
    y?: number;
    mass?: number;
    fixed?: boolean;
    color?: string;
    label?: string;
    radius?: number;
    shape?: string;
    alpha?: number;
    link?: string;
    [key: string]: unknown;
}

export interface GraphBranch {
    nodes?: Record<string, NodeData>;
    edges?: Record<string, Record<string, { length?: number; [key: string]: unknown }>>;
}

export interface ParticleSystemOptions {
    repulsion?: number;
    stiffness?: number;
    friction?: number;
    gravity?: boolean;
    fps?: number;
    targetFps?: number;
    dt?: number;
    precision?: number;
    integrator?: 'verlet' | 'euler';
    worker?: boolean | 'auto';
    onError?: (error: Error) => void;
}

export class Node {
    readonly _id: number;
    readonly name: string;
    data: Record<string, unknown>;
    p: Point;
    mass: number;
    fixed: boolean;
    tempMass: number | null;
}

export class Edge {
    readonly _id: number;
    readonly source: Node;
    readonly target: Node;
    length: number;
    data: Record<string, unknown>;
}

export interface ParticleSystem {
    readonly nodes: Record<number, Node>;
    readonly edges: Record<number, Edge>;
    renderer: Renderer | null;
    parameters(): ParticleSystemOptions;
    parameters(update: Partial<ParticleSystemOptions>): ParticleSystemOptions;
    fps(value?: number): number | this;
    start(): this;
    stop(): this;
    destroy(): void;
    addNode(name: string | number, data?: NodeData): Node;
    getNode(value: string | number | Node): Node | undefined;
    pruneNode(value: string | number | Node): Node | undefined;
    addEdge(source: string | number | Node, target: string | number | Node, data?: { length?: number; [key: string]: unknown }): Edge;
    pruneEdge(edge: Edge): Edge | undefined;
    getEdges(source: string | number | Node, target: string | number | Node): Edge[];
    getEdgesFrom(node: string | number | Node): Edge[];
    getEdgesTo(node: string | number | Node): Edge[];
    eachNode(callback: (node: Node, point: Point) => void): void;
    eachEdge(callback: (edge: Edge, from: Point, to: Point) => void): void;
    graft(branch: GraphBranch): { added: { nodes: Node[]; edges: Edge[] } };
    merge(branch: GraphBranch): { added: { nodes: Node[]; edges: Edge[] }; dropped: { nodes: Node[]; edges: Edge[] } };
    prune(callback?: (node: Node, edges: { from: Edge[]; to: Edge[] }) => boolean): { dropped: { nodes: Node[]; edges: Edge[] } };
    screen(options?: { size?: { width: number; height: number }; padding?: number[]; step?: number }): this | { size?: { width: number; height: number }; padding: number[]; step: number };
    screenSize(width: number, height: number): this;
    screenPadding(top: number | number[], right?: number, bottom?: number, left?: number): this;
    screenStep(value?: number): number | this;
    toScreen(point: PointLike): Point | undefined;
    fromScreen(point: PointLike): Point | undefined;
    nearest(point: PointLike): { node: Node; point: Point; distance: number; screenPoint?: Point } | null;
    bounds(): { topleft: Point; bottomright: Point };
    tweenNode(node: string | number | Node, duration: number, target: Record<string, unknown>): this;
    tweenEdge(edge: Edge, duration: number, target: Record<string, unknown>): this;
}

export const ParticleSystem: {
    new(options?: ParticleSystemOptions): ParticleSystem;
    new(repulsion?: number, stiffness?: number, friction?: number, gravity?: boolean, fps?: number, dt?: number, precision?: number, integrator?: 'verlet' | 'euler'): ParticleSystem;
    (options?: ParticleSystemOptions): ParticleSystem;
    (repulsion?: number, stiffness?: number, friction?: number, gravity?: boolean, fps?: number, dt?: number, precision?: number, integrator?: 'verlet' | 'euler'): ParticleSystem;
};

export class Renderer {
    constructor(canvas: HTMLCanvasElement, options?: Record<string, unknown>);
    init(system: ParticleSystem): this;
    resize(): void;
    redraw(): void;
    destroy(): void;
}

export interface ArborVueProps {
    systemParms?: ParticleSystemOptions;
    particleParms?: GraphBranch;
    worker?: boolean | 'auto';
    rendererOptions?: Record<string, unknown>;
    width?: number | string;
    height?: number | string;
    ariaLabel?: string;
}

export const ArborVue: DefineComponent<ArborVueProps, Record<string, unknown>, unknown>;
declare const plugin: Plugin;
export default plugin;
