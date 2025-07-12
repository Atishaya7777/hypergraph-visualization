import { initializeLayout, renderHypergraph, resetLayout } from './renderer/canvasRenderer';
import type { NodeData, Hyperedge } from './types/index';

const container = document.getElementById('graphContainer')!;
const canvas = document.createElement('canvas');
canvas.style.cssText = `
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
`;
container.appendChild(canvas);

// TODO: Refactor this to make it ENUMS and constants
let scale = 1;
let offsetX = 0;
let offsetY = 0;

let isPanning = false;
let lastX = 0;
let lastY = 0;

const MIN_SCALE = 0.1;
const MAX_SCALE = 5;

// Not these dudes tho.
let nodes: NodeData[] = [];
let edges: Hyperedge[] = [];

let resizeTimeout: number | null = null;

function parseLines(text: string): string[] {
  return text.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

async function loadSampleDataset(): Promise<void> {
  try {
    const [nodeLabelsTxt, labelNamesTxt, hyperedgesTxt] = await Promise.all([
      fetch('/data/sample-dataset/node-labels.txt').then(r => r.text()),
      fetch('/data/sample-dataset/label-names.txt').then(r => r.text()),
      fetch('/data/sample-dataset/hyperedges.txt').then(r => r.text()),
    ]);

    const nodeLabels = parseLines(nodeLabelsTxt);
    const labelNames = parseLines(labelNamesTxt);
    const hyperedgesRaw = parseLines(hyperedgesTxt);

    nodes = nodeLabels.map((labelIndexStr, idx) => {
      const labelIndex = parseInt(labelIndexStr, 10);
      const labelName = labelNames[labelIndex] ?? 'unknown';
      return { id: idx, label: labelName };
    });

    edges = hyperedgesRaw.map(line => {
      const nodeIndices = line.split(',')
        .map(s => parseInt(s.trim(), 10))
        .filter(id => !isNaN(id));
      return { nodeIndices };
    }).filter(edge => edge.nodeIndices.length > 0); 

    resetLayout();
    
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    
    draw();
  } catch (e) {
    console.error('% ERROR LOADING SAMPLE DATASET:', e);
    alert('ERROR LOADING SAMPLE DATASET: ' + (e as Error).message);
  }
}

function updateCanvasSize(): void {
  const rect = container.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
}

function draw(): void {
  updateCanvasSize();
  
  if (nodes.length > 0) {
    initializeLayout(nodes, edges, canvas.width, canvas.height);
  }
  
  renderHypergraph({
    canvas,
    nodes,
    edges,
    scale,
    offsetX,
    offsetY,
  });
}

function handleZoom(e: WheelEvent): void {
  e.preventDefault();
  
  const zoomIntensity = 0.1;
  const wheel = e.deltaY < 0 ? 1 : -1;
  const zoom = Math.exp(wheel * zoomIntensity);
  
  const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * zoom));
  
  if (newScale === scale) return;
  
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const scaleChange = newScale / scale;
  offsetX = mouseX - (mouseX - offsetX) * scaleChange;
  offsetY = mouseY - (mouseY - offsetY) * scaleChange;
  
  scale = newScale;
  draw();
}

function handleMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return; 
  
  isPanning = true;
  lastX = e.clientX;
  lastY = e.clientY;
  canvas.style.cursor = 'grabbing';
}

function handleMouseMove(e: MouseEvent): void {
  if (!isPanning) return;
  
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  
  offsetX += dx;
  offsetY += dy;
  
  lastX = e.clientX;
  lastY = e.clientY;
  
  draw();
}

function handleMouseUp(): void {
  if (!isPanning) return;
  
  isPanning = false;
  canvas.style.cursor = 'grab';
}

function handleResize(): void {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  
  resizeTimeout = window.setTimeout(() => {
    draw();
    resizeTimeout = null;
  }, 100);
}

canvas.addEventListener('wheel', handleZoom, { passive: false });
canvas.addEventListener('mousedown', handleMouseDown);
canvas.addEventListener('mousemove', handleMouseMove);
canvas.addEventListener('mouseup', handleMouseUp);
canvas.addEventListener('mouseleave', handleMouseUp);

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    draw();
  }
  
  if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    if (nodes.length > 0) {
      const rect = canvas.getBoundingClientRect();
      
      scale = 1;
      offsetX = rect.width / 2;
      offsetY = rect.height / 2;
      draw();
    }
  }
});

const sampleButton = document.getElementById('loadSampleBtn');
if (sampleButton) {
  sampleButton.addEventListener('click', loadSampleDataset);
}

window.addEventListener('resize', handleResize);

updateCanvasSize();
draw();

// TODO: Convert these dudes into UI elements instead of console.logs
console.log('Hypergraph Visualizer loaded');
console.log('Controls:');
console.log('- Mouse wheel: Zoom in/out');
console.log('- Click and drag: Pan');
console.log('- Ctrl+R: Reset view');
console.log('- Ctrl+F: Fit to view');
console.log('- Hover over nodes/edges for tooltips');
