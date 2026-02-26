import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import ForceGraph2D to avoid SSR issues
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

const GraphView = ({ initialPackage = 'react' }) => {
  const [centerNode, setCenterNode] = useState(initialPackage);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const fgRef = useRef();

  // Fetch data when centerNode changes
  useEffect(() => {
    fetchGraphData(centerNode);
  }, [centerNode]);

  const fetchGraphData = async (packageName) => {
    try {
      const response = await fetch(`/api/get-graph?name=${encodeURIComponent(packageName)}`);
      const data = await response.json();

      // Transform data for graph
      const nodes = [
        {
          id: data.name,
          name: data.name,
          version: data.version,
          isCenter: true
        }
      ];
      const links = [];

      data.children.forEach((child) => {
        nodes.push({
          id: child.name,
          name: child.name,
          range: child.range,
          isCenter: false
        });
        links.push({ source: data.name, target: child.name });
      });

      setGraphData({ nodes, links });
    } catch (error) {
      console.error('Error fetching graph data:', error);
    }
  };

  const handleNodeClick = (node) => {
    if (!node.isCenter) {
      // Drill-down: Update centerNode to re-center graph
      setCenterNode(node.id);
    }
    // Always open panel for selected node
    setSelectedNode(node);
    setPanelOpen(true);
  };

  const closePanel = () => {
    setPanelOpen(false);
    setSelectedNode(null);
  };

  return (
    <div className="graph-view-container">
      <div className="graph-container">
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          nodeLabel="name"
          nodeColor={(node) => {
            if (selectedNode && node.id === selectedNode.id) {
              return '#1f2937'; // Dark gray-blue for selected
            }
            if (hoveredNode && node.id === hoveredNode.id) {
              return '#1f2937'; // Dark gray-blue for hovered
            }
            return node.isCenter ? '#c83b10' : '#00E5FF';
          }}
          nodeRelSize={12}
          linkDirectionalArrowLength={6}
          linkDirectionalArrowRelPos={1}
          linkColor={() => 'rgba(255, 255, 255, 0.3)'}
          d3Force={(simulation) => {
            simulation.force('charge').strength(-600); // High repulsion
            simulation.force('link').distance(150);
          }}
          onNodeClick={handleNodeClick}
          onNodeHover={(node) => setHoveredNode(node)}
          width={800}
          height={600}
        />
      </div>

      {/* Glassmorphism Side Panel */}
      {panelOpen && selectedNode && (
        <div className="side-panel">
          <div className="panel-header">
            <h3>Package Details</h3>
            <button onClick={closePanel} className="close-btn">&times;</button>
          </div>
          <div className="panel-content">
            <div className="detail-item">
              <strong>Name:</strong> {selectedNode.name}
            </div>
            <div className="detail-item">
              <strong>{selectedNode.isCenter ? 'Version' : 'Required Range'}:</strong>
              {selectedNode.isCenter ? selectedNode.version : selectedNode.range}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GraphView;