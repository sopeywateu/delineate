let cy = null;

async function loadGraph() {
    const ecosystem = document.getElementById('ecosystemSelect').value;

    // Fetch data from backend
    const response = await fetch(`/api/ecosystem/${ecosystem}`);
    const links = await response.json();

    // Format data for Cytoscape
    const elements = [];
    const addedNodes = new Set();

    links.forEach(link => {
        // Add Source Node
        if (!addedNodes.has(link.source)) {
            elements.push({ data: { id: link.source, label: link.source } });
            addedNodes.add(link.source);
        }
        // Add Target Node
        if (!addedNodes.has(link.target)) {
            elements.push({ data: { id: link.target, label: link.target } });
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

    // Initialize Cytoscape
    cy = cytoscape({
        container: document.getElementById('cy'),
        elements: elements,

        // Academic styling
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': '#00f2fe', // Match the delineate button color!
                    'label': 'data(label)',
                    'color': '#fff',
                    // ... rest of the node styles
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 1.5,
                    'line-color': 'rgba(255, 255, 255, 0.2)', // Sleek, semi-transparent white lines
                    'target-arrow-color': 'rgba(255, 255, 255, 0.2)',
                    // ... rest of the edge styles
                }
            }
        ],

        // The 'cose' layout is a physics simulation designed specifically for network graphs
        layout: {
            name: 'cose',
            idealEdgeLength: 100,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
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