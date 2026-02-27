let cy = null;

async function loadGraph() {
    const ecosystem = document.getElementById('ecosystemSelect').value;
    const BACKEND_URL = 'https://delineate.onrender.com';

    // Fetch data from backend
    const response = await fetch(`${BACKEND_URL}/api/ecosystem/${ecosystem}`);
    const links = await response.json();

    // Format data for Cytoscape
    const elements = [];
    const addedNodes = new Set();
    const nodeStats = {};

    links.forEach(link => {
        if (!nodeStats[link.source]) nodeStats[link.source] = { in: 0, out: 0, neighbors: [] };
        if (!nodeStats[link.target]) nodeStats[link.target] = { in: 0, out: 0, neighbors: [] };
        
        nodeStats[link.source].out++; // source depends on something
        nodeStats[link.source].neighbors.push({ id: link.target, relationship: 'dependency' }); 
        
        nodeStats[link.target].in++;  // something depends on target
        nodeStats[link.target].neighbors.push({ id: link.source, relationship: 'dependent' }); 
    });

    // Calculate total connections to sort by importance
    Object.keys(nodeStats).forEach(id => {
        nodeStats[id].total = nodeStats[id].in + nodeStats[id].out;
    });

    const sortedNodes = Object.keys(nodeStats).sort((a, b) => nodeStats[b].total - nodeStats[a].total);

    // 2. Generate HSL Colors
    const nodeColors = {};
    const numHubs = Math.min(15, sortedNodes.length); // Top 15 packages get unique base colors
    
    // Assign base colors to Hubs (50% lightness)
    for(let i = 0; i < numHubs; i++) {
        const hue = (i * (360 / numHubs)) % 360; // Spread evenly across the color wheel
        nodeColors[sortedNodes[i]] = `hsl(${hue}, 85%, 50%)`; 
    }

    // Assign shades to the rest of the nodes based on their biggest Hub neighbor
    sortedNodes.slice(numHubs).forEach(id => {
        // Find the most important neighbor that already has a color
        const coloredNeighbor = nodeStats[id].neighbors.find(n => nodeColors[n.id]);
        
        if (coloredNeighbor) {
            // Extract the Hue from the neighbor's color string
            const hueMatch = nodeColors[coloredNeighbor.id].match(/hsl\((\d+)/);
            const hue = hueMatch ? hueMatch[1] : 0;

            if (coloredNeighbor.relationship === 'dependent') {
                // This node is a dependent (Lighter shade)
                nodeColors[id] = `hsl(${hue}, 85%, 75%)`; 
            } else {
                // This node is a dependency (Darker shade)
                nodeColors[id] = `hsl(${hue}, 85%, 25%)`; 
            }
        } else {
            // Fallback for isolated nodes
            nodeColors[id] = `hsl(0, 0%, 50%)`; // Grey
        }
    });

    // 3. Build the graph elements
    links.forEach(link => {
        // Add Source Node
        if (!addedNodes.has(link.source)) {
            elements.push({ 
                data: { id: link.source, label: link.source, bgColor: nodeColors[link.source] } 
            });
            addedNodes.add(link.source);
        }
        // Add Target Node
        if (!addedNodes.has(link.target)) {
            elements.push({ 
                data: { id: link.target, label: link.target, bgColor: nodeColors[link.target] } 
            });
            addedNodes.add(link.target);
        }

        // Add Edge
        elements.push({
            data: {
                id: `${link.source}-${link.target}`,
                source: link.source,
                target: link.target,
                specifier: link.specifier
            }
        });
    });

    //4. Initialize Cytoscape
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,

        // Academic styling
        style: [
            {
                selector: 'node',
                style: {
                    'label': 'data(label)',
                    'color': '#fff',
                    'font-size': '12px',
                    'text-valign': 'center',
                    'text-halign': 'right',
                    'text-margin-x': 6,
                    'background-color': 'data(bgColor)', // Maps directly to the color we generated
                    'width': '25px',
                    'height': '25px'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.5,
                    'line-color': 'rgba(255, 255, 255, 0.15)', // Subtle edges so colors pop
                    'target-arrow-color': 'rgba(255, 255, 255, 0.3)',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier'
                }
            }
        ],
        // The 'cose' layout is a physics simulation designed specifically for network graphs
        layout: {
            name: 'cose',
            idealEdgeLength: 250,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 50,
            randomize: true,
            componentSpacing: 200,
            nodeRepulsion: 1000000,
            edgeElasticity: 50,
            nestingFactor: 5
        }
    });

    // Add click event to show specifier
    cy.on('tap', 'edge', function (evt) {
        let edge = evt.target;
        alert(`Dependency Constraint:\n${edge.data('source')} requires ${edge.data('target')} (${edge.data('specifier')})`);
    });
}

// Load initially
window.onload = loadGraph;