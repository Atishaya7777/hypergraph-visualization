import { NodeData, Hyperedge } from '../types/index';

import { IRenderOptions } from "./canvasRenderer.types";
const vertexRadius = 15;

let ctx: CanvasRenderingContext2D;
let canvas: HTMLCanvasElement;
let currentNodes: NodeData[] = [];
let currentEdges: Hyperedge[] = [];
const nodePositions: Map<number, { x: number; y: number }> = new Map();
let isLayoutInitialized = false;

let hoveredNodeId: number | null = null;
let hoveredEdgeIndex: number | null = null;
let tooltipDiv: HTMLDivElement | null = null;

let canvasTransform = { scale: 1, offsetX: 0, offsetY: 0 };


export function renderHypergraph({ canvas: c, nodes, edges, scale, offsetX, offsetY }: IRenderOptions): void {
  canvas = c;
  ctx = canvas.getContext('2d')!;
  currentNodes = nodes;
  currentEdges = edges;
  
  canvasTransform = { scale, offsetX, offsetY };

  if (!tooltipDiv) {
    tooltipDiv = document.createElement('div');
    tooltipDiv.style.cssText = `
      position: fixed;
      background-color: rgba(0,0,0,0.8);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      pointer-events: none;
      transition: opacity 0.2s;
      opacity: 0;
      z-index: 1000;
      font-family: sans-serif;
      font-size: 12px;
      white-space: nowrap;
    `;
    document.body.appendChild(tooltipDiv);
  }

  drawHypergraph(nodes, edges, scale, offsetX, offsetY);

  if (!canvas.onmousemove) { // This ensures that the event handlers are only instantiated once.
    canvas.onmousemove = (e) => onMouseMove(e);
    canvas.onclick = (e) => onClick(e);
  }
}

export function initializeLayout(nodes: NodeData[], edges: Hyperedge[], width: number, height: number): void {
  if (isLayoutInitialized && nodePositions.size === nodes.length) {
    return;
  }

  const padding = 100;
  const minDistanceBetweenNodes = 80; 
  
  nodePositions.clear();
  
  const effectiveWidth = width - 2 * padding;
  const effectiveHeight = height - 2 * padding;
  
  const hyperedgeCenters = edges.map((_, i) => {
    const angle = (i / edges.length) * 2 * Math.PI;
    const radius = Math.min(effectiveWidth, effectiveHeight) * 0.3;
    return {
      x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 100,
      y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 100,
    };
  });

  const maxAttempts = 1000;
  
  nodes.forEach(node => {
    let placed = false;
    let attempts = 0;
    
    while (!placed && attempts < maxAttempts) {
      const x = padding + Math.random() * effectiveWidth;
      const y = padding + Math.random() * effectiveHeight;
      
      let tooClose = false;
      for (const [_ , pos] of nodePositions) {
        const dx = x - pos.x;
        const dy = y - pos.y;
        if (Math.sqrt(dx * dx + dy * dy) < minDistanceBetweenNodes) {
          tooClose = true;
          break;
        }
      }
      
      if (!tooClose) {
        nodePositions.set(node.id, { x, y });
        placed = true;
      }
      attempts++;
    }
    
    if (!placed) {
      nodePositions.set(node.id, {
        x: padding + Math.random() * effectiveWidth,
        y: padding + Math.random() * effectiveHeight,
      });
    }
  });

  const nodeToHyperedges = new Map<number, number[]>();
  edges.forEach((edge, i) => {
    edge.nodeIndices.forEach(nodeId => {
      if (!nodeToHyperedges.has(nodeId)) {
        nodeToHyperedges.set(nodeId, []);
      }
      nodeToHyperedges.get(nodeId)!.push(i);
    });
  });

  const iterations = 5;
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<number, { x: number; y: number }>();
    
    nodes.forEach(node => {
      forces.set(node.id, { x: 0, y: 0 });
    });
    
    /*
      * Basically, we draw the vertices such that the vertices that share hyperedges are closer to one another, while vertices that do not share hyperedges are 'repulsed'
      * by each other.
      * This is implemented by creating attractive and detractive 'forces' between them.
    */

    nodes.forEach(node => {
      const belongingEdges = nodeToHyperedges.get(node.id);
      if (!belongingEdges || belongingEdges.length === 0) return;
      
      const force = forces.get(node.id)!;
      const currentPos = nodePositions.get(node.id)!;
      
      belongingEdges.forEach(edgeIdx => {
        const center = hyperedgeCenters[edgeIdx];
        const dx = center.x - currentPos.x;
        const dy = center.y - currentPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const strength = 0.1;
          force.x += (dx / distance) * strength;
          force.y += (dy / distance) * strength;
        }
      });
    });
    
    nodes.forEach(nodeA => {
      const forceA = forces.get(nodeA.id)!;
      const posA = nodePositions.get(nodeA.id)!;
      
      nodes.forEach(nodeB => {
        if (nodeA.id === nodeB.id) return;
        
        const posB = nodePositions.get(nodeB.id)!;
        const dx = posA.x - posB.x;
        const dy = posA.y - posB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0 && distance < minDistanceBetweenNodes * 2) {
          const repulsion = (minDistanceBetweenNodes * 2 - distance) / distance;
          const strength = 0.5;
          forceA.x += (dx / distance) * repulsion * strength;
          forceA.y += (dy / distance) * repulsion * strength;
        }
      });
    });
    
    nodes.forEach(node => {
      const force = forces.get(node.id)!;
      const currentPos = nodePositions.get(node.id)!;
      const damping = 0.8;
      
      const newX = Math.max(padding, Math.min(width - padding, 
        currentPos.x + force.x * damping));
      const newY = Math.max(padding, Math.min(height - padding, 
        currentPos.y + force.y * damping));
      
      nodePositions.set(node.id, { x: newX, y: newY });
    });
  }
  
  isLayoutInitialized = true;
}

export function resetLayout(): void {
  isLayoutInitialized = false;
  nodePositions.clear();
}


function drawHypergraph(nodes: NodeData[], edges: Hyperedge[], scale: number, offsetX: number, offsetY: number): void {
  if (!ctx || !canvas) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

  drawHyperedges(edges);
  drawVertices(nodes);
  
  ctx.restore();
}

function drawVertices(nodes: NodeData[]): void {
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  nodes.forEach((node) => {
    const position = nodePositions.get(node.id);
    if (!position) return;
    
    const { x, y } = position;

    ctx.beginPath();
    ctx.arc(x, y, vertexRadius, 0, 2 * Math.PI);
    
    if (hoveredNodeId === node.id) {
      ctx.fillStyle = '#ff6b35';
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = '#2c3e50';
      ctx.shadowBlur = 0;
    }
    
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.fillText(node.id.toString(), x, y);
  });
}

function drawHyperedges(edges: Hyperedge[]): void {
  edges.forEach((edge, index) => {
    const points = edge.nodeIndices
      .map(id => nodePositions.get(id))
      .filter((pos): pos is { x: number; y: number } => pos !== undefined);

    if (points.length === 0) return;

    const isHovered = hoveredEdgeIndex === index;
    const baseHue = (index * 137) % 360; // Use golden angle for better color distribution
    
    if (points.length === 1) {
      const point = points[0];
      ctx.beginPath();
      ctx.arc(point.x, point.y, vertexRadius + 10, 0, 2 * Math.PI);
      ctx.fillStyle = isHovered 
        ? `hsla(${baseHue}, 80%, 60%, 0.4)` 
        : `hsla(${baseHue}, 60%, 70%, 0.25)`;
      ctx.fill();
    } else if (points.length === 2) {
      drawOvalEdge(points, baseHue, isHovered);
    } else {
      drawConvexHull(points, baseHue, isHovered);
    }
  });
}

function drawOvalEdge(points: { x: number; y: number }[], hue: number, highlight: boolean): void {
  const [p1, p2] = points;
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);

  ctx.beginPath();
  ctx.ellipse(
    midX, midY,
    distance / 2 + 25,
    vertexRadius + 10,
    angle,
    0,
    2 * Math.PI
  );
  
  ctx.fillStyle = highlight
    ? `hsla(${hue}, 80%, 60%, 0.4)`
    : `hsla(${hue}, 60%, 70%, 0.25)`;
  ctx.fill();
}

function drawConvexHull(points: { x: number; y: number }[], hue: number, highlight: boolean): void {
  const hull = convexHull(points);
  if (hull.length === 0) return;

  const expandedHull = expandPolygon(hull, 15);

  ctx.beginPath();
  ctx.moveTo(expandedHull[0].x, expandedHull[0].y);
  for (let i = 1; i < expandedHull.length; i++) {
    ctx.lineTo(expandedHull[i].x, expandedHull[i].y);
  }
  ctx.closePath();
  
  ctx.fillStyle = highlight
    ? `hsla(${hue}, 80%, 60%, 0.4)`
    : `hsla(${hue}, 60%, 70%, 0.25)`;
  ctx.fill();
}

function expandPolygon(points: { x: number; y: number }[], distance: number): { x: number; y: number }[] {
  if (points.length < 3) return points;
  
  const center = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  );
  center.x /= points.length;
  center.y /= points.length;
  
  return points.map(p => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return p;
    
    const factor = (length + distance) / length;
    return {
      x: center.x + dx * factor,
      y: center.y + dy * factor
    };
  });
}

function convexHull(points: { x: number; y: number }[]): { x: number; y: number }[] {
  if (points.length <= 2) return [...points];
  /*
   * We implement Graham scan to find a 2D convex hull. You can read more here: https://en.wikipedia.org/wiki/Graham_scan
   */
  
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[start].y || 
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i;
    }
  }
  
  // Sort points by polar angle with respect to start point
  const startPoint = points[start];
  const sortedPoints = points
    .filter((_, i) => i !== start)
    .sort((a, b) => {
      const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
      const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
      return angleA - angleB;
    });
  
  const hull = [startPoint];
  
  for (const point of sortedPoints) {
    while (hull.length > 1 && 
           cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
}

function cross(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

// This converts mouse coordinates to canvas coordinates to ensure that we don't blow stuff up.
function getCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const x = (clientX - rect.left - canvasTransform.offsetX) / canvasTransform.scale;
  const y = (clientY - rect.top - canvasTransform.offsetY) / canvasTransform.scale;
  return { x, y };
}

function hitTestVertex(canvasX: number, canvasY: number): number | null {
  for (const [id, pos] of nodePositions.entries()) {
    const dx = canvasX - pos.x;
    const dy = canvasY - pos.y;
    if (dx * dx + dy * dy <= vertexRadius * vertexRadius) {
      return id;
    }
  }
  return null;
}

function pointInPolygon(point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
                      (point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function hitTestEdge(canvasX: number, canvasY: number, edges: Hyperedge[]): number | null {
  for (let i = 0; i < edges.length; i++) {
    const points = edges[i].nodeIndices
      .map(id => nodePositions.get(id))
      .filter((pos): pos is { x: number; y: number } => pos !== undefined);
      
    if (points.length === 0) continue;

    if (points.length === 1) {
      const point = points[0];
      const dx = canvasX - point.x;
      const dy = canvasY - point.y;
      if (dx * dx + dy * dy <= (vertexRadius + 10) ** 2) return i;
    } else if (points.length === 2) {
      const [p1, p2] = points;
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      const cos = Math.cos(-angle);
      const sin = Math.sin(-angle);
      const tx = cos * (canvasX - midX) - sin * (canvasY - midY);
      const ty = sin * (canvasX - midX) + cos * (canvasY - midY);
      
      const rx = distance / 2 + 25;
      const ry = vertexRadius + 10;
      
      if ((tx * tx) / (rx * rx) + (ty * ty) / (ry * ry) <= 1) return i;
    } else {
      const hull = convexHull(points);
      const expandedHull = expandPolygon(hull, 15);
      if (pointInPolygon({ x: canvasX, y: canvasY }, expandedHull)) return i;
    }
  }
  return null;
}

function onMouseMove(e: MouseEvent): void {
  const canvasCoords = getCanvasCoordinates(e.clientX, e.clientY);
  
  const prevHoveredNode = hoveredNodeId;
  const prevHoveredEdge = hoveredEdgeIndex;

  hoveredNodeId = hitTestVertex(canvasCoords.x, canvasCoords.y);
  hoveredEdgeIndex = hoveredNodeId === null ? 
    hitTestEdge(canvasCoords.x, canvasCoords.y, currentEdges) : null;

  if (hoveredNodeId !== prevHoveredNode || hoveredEdgeIndex !== prevHoveredEdge) {
    drawHypergraph(currentNodes, currentEdges, canvasTransform.scale, canvasTransform.offsetX, canvasTransform.offsetY);
  }

  if (tooltipDiv) {
    if (hoveredNodeId !== null) {
      const node = currentNodes.find(n => n.id === hoveredNodeId);
      tooltipDiv.style.opacity = '1';
      tooltipDiv.style.left = `${e.clientX + 10}px`;
      tooltipDiv.style.top = `${e.clientY + 10}px`;
      tooltipDiv.textContent = `Node ${hoveredNodeId}${node?.label ? `: ${node.label}` : ''}`;
    } else if (hoveredEdgeIndex !== null) {
      tooltipDiv.style.opacity = '1';
      tooltipDiv.style.left = `${e.clientX + 10}px`;
      tooltipDiv.style.top = `${e.clientY + 10}px`;
      tooltipDiv.textContent = `Hyperedge ${hoveredEdgeIndex} (${currentEdges[hoveredEdgeIndex].nodeIndices.length} nodes)`;
    } else {
      tooltipDiv.style.opacity = '0';
    }
  }
}

function onClick(e: MouseEvent): void {
  if (hoveredNodeId !== null) {
    const node = currentNodes.find(n => n.id === hoveredNodeId);
    console.log(`% CLICKED NODE ${hoveredNodeId}${node?.label ? ` (${node.label})` : ''}`);
  } else if (hoveredEdgeIndex !== null) {
    console.log(`CLICKED HYPEREDGE ${hoveredEdgeIndex} WITH NODES:`, currentEdges[hoveredEdgeIndex].nodeIndices);
  }
}
