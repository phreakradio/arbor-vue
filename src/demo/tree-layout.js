export function treePositions(root, edges) {
    const positions = {};
    let nextLeaf = 0;

    function visit(name, depth) {
        const children = Object.keys(edges[name] || {});
        const childPositions = children.map((child) => visit(child, depth + 1));
        const x = childPositions.length
            ? (childPositions[0] + childPositions[childPositions.length - 1]) / 2
            : nextLeaf++;
        positions[name] = { x, y: depth * 2 };
        return x;
    }

    visit(root, 0);
    const center = (nextLeaf - 1) / 2;
    for (const point of Object.values(positions)) point.x = (point.x - center) * 2;
    return positions;
}
