export interface NodeData {
  id: number;
  labelIndex: number;
  labelName: string;
  degree: number;
}

export interface Hyperedge {
  nodeIndices: number[];
}
