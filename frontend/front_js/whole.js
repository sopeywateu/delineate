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
    // Show notification when clicking an edge
    cy.on('tap', 'edge', function (evt) {
        let edge = evt.target;
        const msg = `${edge.data('source')} requires ${edge.data('target')} (${edge.data('specifier')})`;
        
        // Update text and slide in
        document.getElementById('edge-notification-text').innerText = msg;
        document.getElementById('edge-notification').classList.add('show');
    });

    // Hide notification when clicking empty canvas space or a node
    cy.on('tap', function(evt) {
        if (evt.target === cy || evt.target.isNode()) {
            document.getElementById('edge-notification').classList.remove('show');
        }
    });
}
// Hide notification when clicking outside the graph (like the nav bar or controls)
document.addEventListener('click', function(e) {
    const notif = document.getElementById('edge-notification');
    // If the click is NOT on the canvas (Cytoscape) and the notification is showing
    if (e.target.tagName !== 'CANVAS' && notif.classList.contains('show')) {
        notif.classList.remove('show');
    }
});

// Function to find and focus on a specific node
function searchNode() {
    if (!cy) return; // Do nothing if the graph hasn't been generated yet

    const searchTerm = document.getElementById('nodeSearch').value.trim().toLowerCase();
    
    if (!searchTerm) {
        resetSearch();
        return;
    }

    // Find nodes where the label contains the search term (case-insensitive)
    const matchedNodes = cy.nodes(`[label @*= "${searchTerm}"]`);

    if (matchedNodes.length > 0) {
        // 1. Dim all nodes and edges in the graph
        cy.nodes().style({ 'opacity': 0.1, 'border-width': 0 });
        cy.edges().style({ 'opacity': 0.05 });

        // 2. Highlight the matched node(s)
        matchedNodes.style({
            'opacity': 1,
            'border-width': 4,
            'border-color': '#ffffff' // White border makes it stand out
        });

        // 3. Highlight its immediate neighbors and the edges connecting them
        const neighborhood = matchedNodes.neighborhood();
        neighborhood.style({ 'opacity': 0.9 });
        
        // 4. Animate camera to zoom in on the node and its neighbors
        cy.animate({
            fit: {
                eles: matchedNodes.union(neighborhood),
                padding: 50 // Keep some breathing room around the edges
            },
            duration: 750, // 750ms animation
            easing: 'ease-in-out'
        });
    } else {
        alert(`Package "${searchTerm}" was not found in the current graph view.`);
    }
}

// Function to reset the graph visual state
function resetSearch() {
    if (!cy) return;
    
    // Clear the input field
    document.getElementById('nodeSearch').value = '';

    // Restore original opacities and remove borders
    cy.nodes().style({ 'opacity': 1, 'border-width': 0 });
    cy.edges().style({ 'opacity': 1 });

    // Zoom back out to fit the whole graph
    cy.animate({
        fit: {
            padding: 50
        },
        duration: 750,
        easing: 'ease-in-out'
    });
}

// Optional: Trigger search when the user presses "Enter" in the input field
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('nodeSearch');
    if(searchInput) {
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                searchNode();
            }
        });
    }
});

// Load initially
window.onload = loadGraph;