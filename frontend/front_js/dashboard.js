document.addEventListener('DOMContentLoaded', function () {
    const packageManagerSelect = document.getElementById('package-manager');
    const messageDiv = document.getElementById('message');
    const resultsDiv = document.getElementById('results');
    const packageNameDisplay = document.getElementById('package-name-display');
    const tableToggle = document.getElementById('table-toggle');
    const graphToggle = document.getElementById('graph-toggle');
    const tableView = document.getElementById('tableView');
    const graphView = document.getElementById('graphView');

    let currentData = null;
    let network = null;
    let centerNode = null;
    let navigationHistory = [];
    let currentHistoryIndex = -1;

    // Graph controls
    const graphSearchInput = document.getElementById('graph-search');
    const searchBtn = document.getElementById('search-btn');
    const fitBtn = document.getElementById('fit-btn');
    const resetBtn = document.getElementById('reset-btn');
    const backBtn = document.getElementById('back-btn');

    // Search functionality
    function searchInGraph(searchTerm) {
        if (!network || !searchTerm.trim()) return;

        try {
            const nodes = network.body.data.nodes;
            const foundNode = nodes.get().find(node =>
                node.label && node.label.toLowerCase().includes(searchTerm.toLowerCase())
            );

            if (foundNode) {
                network.focus(foundNode.id, {
                    scale: 1.5,
                    animation: {
                        duration: 1000,
                        easingFunction: 'easeInOutQuad'
                    }
                });
                // Highlight the found node
                network.selectNodes([foundNode.id]);
                // Clear search input after successful search
                graphSearchInput.value = '';
            } else {
                // Show a better notification instead of alert
                showMessage('Package not found in current graph', 'warning');
            }
        } catch (error) {
            console.error('Error during search:', error);
            showMessage('Error searching graph', 'warning');
        }
    }

    searchBtn.addEventListener('click', function () {
        const searchTerm = graphSearchInput.value.trim();
        searchInGraph(searchTerm);
    });

    graphSearchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            const searchTerm = graphSearchInput.value.trim();
            searchInGraph(searchTerm);
        }
    });

    // Graph control buttons
    fitBtn.addEventListener('click', function () {
        if (network) {
            network.fit({
                animation: {
                    duration: 1000,
                    easingFunction: 'easeInOutQuad'
                }
            });
        }
    });

    resetBtn.addEventListener('click', function () {
        if (network) {
            network.fit();
            network.moveTo({ scale: 1 });
        }
    });

    // Toggle between views
    tableToggle.addEventListener('click', function () {
        tableView.classList.remove('hidden');
        graphView.classList.add('hidden');
        tableToggle.classList.add('active');
        graphToggle.classList.remove('active');
    });

    graphToggle.addEventListener('click', function () {
        graphView.classList.remove('hidden');
        tableView.classList.add('hidden');
        graphToggle.classList.add('active');
        tableToggle.classList.remove('active');
        if (currentData) {
            renderGraph(currentData);
        }
    });

    // Analyze button click
    const analyzeBtn = document.getElementById('analyze-btn');
    analyzeBtn.addEventListener('click', async function () {
        const packageName = document.getElementById('package-name').value.trim();
        const ecosystem = packageManagerSelect.value || 'npm'; // Default to npm

        if (!packageName) {
            messageDiv.textContent = 'Please enter a package name.';
            messageDiv.className = 'message warning';
            messageDiv.classList.remove('hidden');
            resultsDiv.classList.add('hidden');
            return;
        }

        // Fetch data from API
        try {
            messageDiv.textContent = 'Analyzing package...';
            messageDiv.className = 'message info';
            messageDiv.classList.remove('hidden');

            const response = await fetch(getApiUrl(`/package/${encodeURIComponent(packageName)}/details?ecosystem=${encodeURIComponent(ecosystem)}`));
            if (!response.ok) {
                throw new Error('Package not found or error occurred');
            }
            const apiData = await response.json();

            // Use the data directly as returned by backend
            currentData = apiData;
            centerNode = packageName;

            // Add to navigation history
            addToHistory(packageName, apiData);

            // Display results
            packageNameDisplay.textContent = packageName;
            renderTable(currentData);
            resultsDiv.classList.remove('hidden');
            messageDiv.classList.add('hidden');

            // If graph view is active, render it
            if (!graphView.classList.contains('hidden')) {
                renderGraph(currentData);
            }
        } catch (error) {
            console.error('Error:', error);
            messageDiv.textContent = 'Error analyzing package. Please try again.';
            messageDiv.className = 'message warning';
            messageDiv.classList.remove('hidden');
            resultsDiv.classList.add('hidden');
        }
    });

    function renderTable(data) {
        if (!data) {
            console.error('No data provided to renderTable');
            return;
        }

        // Update stats with safe fallbacks
        document.getElementById('direct-deps-count').textContent = data.stats?.directDependencies || 0;
        document.getElementById('used-by-count').textContent = data.stats?.directDependents || 0;

        // Add version dropdown if versions exist
        if (data.package?.versions && data.package.versions.length > 0) {
            const versionContainer = document.getElementById('version-dropdown-container');
            if (versionContainer) {
                versionContainer.innerHTML = `
                    <label for="version-select">Version: </label>
                    <select id="version-select">
                        ${data.package.versions.map(v =>
                    `<option value="${v}" ${v === data.package.selectedVersion ? 'selected' : ''}>${v}</option>`
                ).join('')}
                    </select>
                `;

                // Add event listener to version dropdown
                document.getElementById('version-select').addEventListener('change', async function () {
                    const selectedVersion = this.value;
                    const ecosystem = packageManagerSelect.value || 'npm'; // Default to npm
                    console.log(`Version changed to: ${selectedVersion}`);

                    try {
                        const response = await fetch(getApiUrl(`/package/${encodeURIComponent(packageNameDisplay.textContent)}/details?version=${encodeURIComponent(selectedVersion)}&ecosystem=${encodeURIComponent(ecosystem)}`));
                        if (!response.ok) {
                            throw new Error('Failed to fetch data for selected version');
                        }
                        const newData = await response.json();
                        currentData = newData;
                        renderTable(currentData);
                        if (!graphView.classList.contains('hidden')) {
                            renderGraph(currentData);
                        }
                    } catch (error) {
                        console.error('Error fetching version data:', error);
                        showMessage('Error loading selected version', 'warning');
                    }
                });
            }
        }

        // Update dependencies table
        const depsTbody = document.getElementById('dependencies-tbody');
        depsTbody.innerHTML = '';

        const deps = (data.dependencies || []).filter(d => d && d.name);
        if (deps.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="2" style="color: var(--text-secondary); font-style: italic; text-align: left;">This package doesn't have any dependencies.</td>`;
            depsTbody.appendChild(row);
        } else {
            deps.forEach(dep => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${dep.name}</td>
                    <td>${dep.specifier || '—'}</td>
                `;
                depsTbody.appendChild(row);
            });
        }

        // Update dependents table
        const dependentsTbody = document.getElementById('dependents-tbody');
        dependentsTbody.innerHTML = '';

        (data.dependents || []).forEach(dep => {
            if (dep && dep.package) {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${dep.package}</td>
                    <td>${dep.version || 'N/A'}</td>
                    <td>${dep.specifier || '—'}</td>
                `;
                dependentsTbody.appendChild(row);
            }
        });
    }

    async function fetchPackageData(packageName) {
        try {
            const ecosystem = packageManagerSelect.value || 'npm'; // Default to npm
            const response = await fetch(getApiUrl(`/package/${encodeURIComponent(packageName)}/details?ecosystem=${encodeURIComponent(ecosystem)}`));
            if (!response.ok) {
                throw new Error('Package not found or error occurred');
            }
            const apiData = await response.json();
            currentData = apiData;
            packageNameDisplay.textContent = packageName;
            renderTable(currentData);
            if (!graphView.classList.contains('hidden')) {
                renderGraph(currentData);
            }

            // Add to navigation history
            addToHistory(packageName, apiData);
        } catch (error) {
            console.error('Error fetching package data:', error);
            messageDiv.textContent = 'Error fetching package data. Please try again.';
            messageDiv.className = 'message warning';
            messageDiv.classList.remove('hidden');
        }
    }

    // Navigation history management
    const MAX_HISTORY_SIZE = 20; // Limit history to prevent memory issues

    function addToHistory(packageName, data) {
        // Remove any history after current index (for when user goes back then navigates to new package)
        navigationHistory = navigationHistory.slice(0, currentHistoryIndex + 1);

        // Add new entry - store the package name as the center node for this state
        navigationHistory.push({
            packageName: packageName,
            data: data,
            centerNode: packageName // The center node should be the package name for this state
        });

        // Limit history size
        if (navigationHistory.length > MAX_HISTORY_SIZE) {
            navigationHistory.shift();
            currentHistoryIndex--;
        }

        currentHistoryIndex = navigationHistory.length - 1;
        updateBackButton();
    }

    function goBack() {
        if (currentHistoryIndex > 0) {
            currentHistoryIndex--;
            const previousState = navigationHistory[currentHistoryIndex];

            // Restore the previous state
            currentData = previousState.data;
            centerNode = previousState.centerNode;
            packageNameDisplay.textContent = previousState.packageName;

            renderTable(currentData);
            if (!graphView.classList.contains('hidden')) {
                renderGraph(currentData);
            }

            updateBackButton();
        }
    }

    function updateBackButton() {
        backBtn.disabled = currentHistoryIndex <= 0;
    }

    // Utility function for showing messages
    function showMessage(text, type = 'info') {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.classList.remove('hidden');

        // Auto-hide after 3 seconds for non-error messages
        if (type !== 'warning') {
            setTimeout(() => {
                messageDiv.classList.add('hidden');
            }, 3000);
        }
    }

    // Back button event listener
    backBtn.addEventListener('click', goBack);

    // Close side panel event listener
    const closePanelBtn = document.getElementById('close-panel');
    const sidePanel = document.getElementById('side-panel');

    if (closePanelBtn) {
        closePanelBtn.addEventListener('click', function () {
            sidePanel.classList.add('hidden');
        });
    }

    // Close side panel when clicking outside of it
    if (sidePanel) {
        sidePanel.addEventListener('click', function (e) {
            if (e.target === sidePanel) {
                sidePanel.classList.add('hidden');
            }
        });
    }

    function renderGraph(data) {
        if (!data || !data.package) {
            console.error('Invalid data provided to renderGraph');
            return;
        }

        try {
            const container = document.getElementById('graph-container');
            if (!container) {
                console.error('Graph container not found');
                return;
            }

            // Prepare nodes - center node
            const nodes = [
                {
                    id: data.package.name,
                    label: data.package.name,
                    color: { background: '#c83b10', border: '#632109' },
                    size: 25,
                    isCenter: true,
                    version: data.package.selectedVersion,
                    type: 'center',
                    description: data.package.description,
                    license: data.package.license
                }
            ];
            const edges = [];
            const nodeIds = new Set([data.package.name]); // Track node IDs to prevent duplicates

            // Add dependency nodes (packages this one depends on)
            (data.dependencies || []).forEach((dep) => {
                if (dep.name && !nodeIds.has(dep.name)) {
                    nodeIds.add(dep.name);
                    nodes.push({
                        id: dep.name,
                        label: dep.name,
                        color: { background: '#00BCD4', border: '#0097A7' },
                        size: 15,
                        isCenter: false,
                        specifier: dep.specifier,
                        type: 'dependency'
                    });
                    edges.push({
                        from: data.package.name,
                        to: dep.name,
                        color: '#00BCD4',
                        width: 2
                    });
                }
            });

            // Add dependent nodes (packages that depend on this one)
            (data.dependents || []).forEach((dep) => {
                if (dep.package && !nodeIds.has(dep.package)) {
                    nodeIds.add(dep.package);
                    nodes.push({
                        id: dep.package,
                        label: dep.package,
                        color: { background: '#4CAF50', border: '#2E7D32' },
                        size: 15,
                        isCenter: false,
                        version: dep.version,
                        specifier: dep.specifier,
                        type: 'dependent'
                    });
                    edges.push({
                        from: dep.package,
                        to: data.package.name,
                        color: '#4CAF50',
                        width: 2,
                        arrows: { to: { enabled: true, scaleFactor: 0.5 } }
                    });
                }
            });

            const options = {
                nodes: {
                    shape: 'circle',
                    font: { color: '#ffffff', size: 12 },
                    borderWidth: 2,
                    shadow: true
                },
                edges: {
                    width: 2,
                    shadow: true,
                    smooth: {
                        type: 'continuous'
                    }
                },
                physics: {
                    enabled: true,
                    barnesHut: {
                        gravitationalConstant: -3000,
                        centralGravity: 0.1,
                        springLength: 200,
                        springConstant: 0.02,
                        damping: 0.09
                    },
                    stabilization: {
                        enabled: true,
                        iterations: 100
                    }
                },
                interaction: {
                    hover: true,
                    navigationButtons: true,
                    keyboard: true,
                    zoomView: true,
                    dragView: true
                },
                manipulation: {
                    enabled: false
                },
                layout: {
                    hierarchical: {
                        enabled: false
                    }
                }
            };

            if (network) {
                network.destroy();
            }
            network = new vis.Network(container, { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) }, options);

            // Handle node click
            network.on('click', async function (params) {
                if (params.nodes.length > 0) {
                    const nodeId = params.nodes[0];
                    const ecosystem = packageManagerSelect.value || 'npm'; // Default to npm

                    try {
                        const response = await fetch(getApiUrl(`/package/${encodeURIComponent(nodeId)}/details?ecosystem=${encodeURIComponent(ecosystem)}`));
                        if (!response.ok) throw new Error('Failed to fetch metadata');

                        const freshData = await response.json();

                        showSidePanel({
                            label: freshData.package.name,
                            version: freshData.package.selectedVersion,
                            description: freshData.package.description,
                            license: freshData.package.license,
                            type: nodeId === currentData.package.name ? 'center' : 'dependency'
                        });

                    } catch (err) {
                        console.error(err);
                        showMessage('Failed to load package metadata', 'warning');
                    }
                }
            });

            // Handle hover for better UX
            network.on('hoverNode', function (params) {
                const nodeId = params.node;
                const node = nodes.find(n => n.id === nodeId);
                if (node) {
                    container.style.cursor = 'pointer';
                }
            });

            network.on('blurNode', function () {
                container.style.cursor = 'default';
            });

        } catch (error) {
            console.error('Error rendering graph:', error);
            showMessage('Error rendering graph visualization', 'warning');
        }
    }

    function showSidePanel(node) {
        document.getElementById('panel-name').textContent = node.label;
        if (node.type === 'dependency') {
            document.getElementById('panel-version').textContent = node.specifier || '—';
        } else {
            document.getElementById('panel-version').textContent = node.version || 'N/A';
        }

        // Add type information
        const typeElement = document.getElementById('panel-type');
        if (typeElement) {
            let typeText = '';
            if (node.type === 'center') {
                typeText = 'Current Package';
            } else if (node.type === 'dependency') {
                typeText = 'Dependency';
            } else if (node.type === 'dependent') {
                typeText = 'Dependent Package';
            }
            typeElement.textContent = typeText;
        }

        // Add description and license from npm data
        const descriptionElement = document.getElementById('panel-description');
        const licenseElement = document.getElementById('panel-license');

        if (descriptionElement) {
            descriptionElement.textContent = node.description || 'No description available';
        }

        if (licenseElement) {
            licenseElement.textContent = node.license || 'Unknown';
        }

        document.getElementById('side-panel').classList.remove('hidden');
    }
});