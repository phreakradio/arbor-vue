import type { DefineComponent, Plugin } from 'vue';

export interface PointLike {
    x: number;
    y: number;
}

export interface Point extends PointLike {
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
}

export const Point: {
    new(x?: number | PointLike, y?: number): Point;
    (x?: number | PointLike, y?: number): Point;
    random(radius?: number): Point;
};

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
    timeout?: number;
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
    energy(): { sum: number; max: number; mean: number; n: number };
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

export interface RGBA { r: number; g: number; b: number; a: number }
export type ColorValue = string | { r: number; g: number; b: number; a?: number };
export interface DrawStyle {
    background?: ColorValue | null;
    fill?: ColorValue | null;
    stroke?: ColorValue | null;
    width?: number;
    alpha?: number;
    closed?: boolean;
}
export interface TextStyle {
    font?: string;
    size?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    color?: ColorValue;
    alpha?: number;
    x?: number;
    y?: number;
    width?: number;
}
export interface Shape {
    x: number;
    y: number;
    w: number;
    h: number;
    r?: number;
    style: DrawStyle;
    draw(style?: DrawStyle): void;
}
export interface GraphicsContext {
    size(width?: number, height?: number): { width: number; height: number };
    clear(x?: number, y?: number, width?: number, height?: number): void;
    background(color: ColorValue | null): void;
    background(gray: number, alpha?: number): void;
    background(red: number, green: number, blue: number, alpha?: number): void;
    fill(): RGBA | ColorValue | null;
    fill(color: ColorValue | number, green?: number, blue?: number, alpha?: number): void;
    noFill(): void;
    stroke(): RGBA | ColorValue | null;
    stroke(color: ColorValue | number, green?: number, blue?: number, alpha?: number): void;
    noStroke(): void;
    strokeWidth(): number;
    strokeWidth(width: number): void;
    Color(color: ColorValue | number, green?: number, blue?: number, alpha?: number): RGBA & { toString(): string };
    drawStyle(): DrawStyle;
    drawStyle(style: DrawStyle | string): void;
    drawStyle(name: string, style: DrawStyle): void;
    textStyle(): TextStyle;
    textStyle(style: TextStyle | string): void;
    textStyle(name: string, style: TextStyle): void;
    text(text: string, x: number, y: number, options?: TextStyle): void;
    text(text: string, options: TextStyle): void;
    textWidth(text: string, style?: TextStyle): number;
    rect(x: number, y: number, width: number, height: number, radius?: number | DrawStyle, style?: DrawStyle): void;
    oval(x: number, y: number, width: number, height: number, style?: DrawStyle): void;
    Rect(x: number, y: number, width: number, height: number, radius?: number | DrawStyle, style?: DrawStyle): Shape;
    Oval(x: number, y: number, width: number, height: number, style?: DrawStyle): Shape;
    line(x1: number, y1: number, x2: number, y2: number, style?: DrawStyle): void;
    line(from: PointLike, to: PointLike, style?: DrawStyle): void;
    lines(x1: number, y1: number, x2: number, y2: number): void;
    lines(from: PointLike, to: PointLike): void;
    drawLines(style?: DrawStyle): void;
}
export function Graphics(canvas: HTMLCanvasElement): GraphicsContext;
export const colors: {
    CSS: Record<string, string>;
    validate(value: unknown): boolean;
    decode(color: ColorValue | number, green?: number, blue?: number, alpha?: number): RGBA | null;
    encode(color: ColorValue): string | null;
    blend(color: ColorValue, alpha?: number): string | null;
};
export interface TweenController {
    busy(): boolean;
    to(target: Node | Edge, duration: number, values: Record<string, unknown>): void;
    interpolate(progress: number, from: unknown, to: unknown, easing?: string): unknown;
    tick(now?: number): boolean;
}
export function Tween(): TweenController;
export const etc: {
    trace(...values: unknown[]): void;
    dirname(path: string): string;
    basename(path: string): string | null;
    ordinalize(value: number): string;
    objcopy<T>(value: T): T;
    objcmp(a: unknown, b: unknown, strictOrdering?: boolean): boolean;
    objkeys(value: object): string[];
    objmerge<T extends object, U extends object>(destination: T, source: U): T & U;
    uniq(values: unknown[]): string[];
    arbor_path(): string | null;
};

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
