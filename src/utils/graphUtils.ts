import { NodeData, Hyperedge } from '../types/index';

export function buildNodeData(labels: string[], labelNames: string[], hyperedges: Hyperedge[]): NodeData[] {
  const degrees: number[] = new Array(labels.length).fill(0);

  for (const edge of hyperedges) {
    for (const idx of edge.nodeIndices) {
      degrees[idx]++;
    }
  }

  return labels.map((labelStr, i) => {
    const labelIndex = parseInt(labelStr);
    return {
      id: i,
      labelIndex,
      labelName: labelNames[labelIndex] || `Label ${labelIndex}`,
      degree: degrees[i],
    };
  });
}
