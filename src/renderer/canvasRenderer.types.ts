import { NodeData, Hyperedge } from '../types/index';

export interface IRenderOptions {
  canvas: HTMLCanvasElement;
  nodes: NodeData[];
  edges: Hyperedge[];
  scale: number;
  offsetX: number;
  offsetY: number;
}

