# Hypergraph Visualizer

An interactive 2D visualization tool for hypergraphs using TypeScript and the Canvas API.

## Dataset Format

1. `node-labels-*.txt`: Line `i` contains the label index of node `i`.
2. `label-names-*.txt`: Line `i` maps label index `i` to its name.
3. `hyperedges-*.txt`: Each line is a comma-separated list of node indices.

##  Getting Started

```bash
npm install
npm run dev
