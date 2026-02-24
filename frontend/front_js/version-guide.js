/**
 * Version Guide Panel - Modular Help Panel Component
 * Lightweight vanilla JS for slide-out version specifier guide
 */

class VersionGuidePanel {
    constructor() {
        this.panel = document.getElementById('version-guide-panel');
        this.overlay = document.getElementById('guide-overlay');
        this.openBtn = document.getElementById('version-guide-btn');
        this.closeBtn = document.getElementById('close-guide-btn');
        
        if (!this.panel || !this.overlay || !this.openBtn || !this.closeBtn) {
            console.warn('Version Guide Panel: Required DOM elements not found');
            return;
        }
        
        this.isOpen = false;
        this.init();
    }
    
    init() {
        // Toggle button click handler
        this.openBtn.addEventListener('click', () => this.toggle());
        
        // Close button click handler
        this.closeBtn.addEventListener('click', () => this.close());
        
        // Overlay click handler (click outside to close)
        this.overlay.addEventListener('click', () => this.close());
        
        // Prevent panel clicks from closing when clicking inside panel
        this.panel.addEventListener('click', (e) => e.stopPropagation());
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.panel.classList.add('open');
        this.overlay.classList.add('visible');
        this.openBtn.classList.add('active');
        this.isOpen = true;
    }
    
    close() {
        this.panel.classList.remove('open');
        this.overlay.classList.remove('visible');
        this.openBtn.classList.remove('active');
        this.isOpen = false;
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new VersionGuidePanel();
    // Add package name autocomplete and inject search instructions into the guide panel
    setupPackageAutocomplete();
});


// Debounce helper
function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

function setupPackageAutocomplete() {
    const input = document.getElementById('package-name');
    const ecosystemSelect = document.getElementById('package-manager');
    const analyzeBtn = document.getElementById('analyze-btn');
    const guideContent = document.querySelector('.guide-panel-content');

    if (!input) return;

    // Inject a short instruction section about using the search box
    if (guideContent) {
        const introHTML = `
            <div class="guide-item">
                <h4>Using the Search Box</h4>
                <p>Start typing a package name in the <strong>Package Name</strong> field. Delineate will show a live list of matching packages from the Neo4j database. Click a suggestion or press <strong>Enter</strong> to select it, then click <strong>Analyze →</strong> to load the package data.</p>
                <p>Only packages actually present in the Neo4j graph are suggested.</p>
            </div>
        `;
        guideContent.insertAdjacentHTML('afterbegin', introHTML);
    }

    // Create suggestions container
    const container = document.createElement('div');
    container.id = 'package-suggestions';
    container.className = 'autocomplete-suggestions hidden';
    // Ensure positioned relative to the input parent
    const parent = input.parentElement;
    parent.style.position = parent.style.position || 'relative';
    parent.appendChild(container);

    let suggestions = [];
    let selectedIndex = -1;

    const render = (items) => {
        suggestions = items || [];
        selectedIndex = -1;
        if (!suggestions || suggestions.length === 0) {
            container.innerHTML = '<div class="autocomplete-empty">No matches</div>';
            container.classList.remove('hidden');
            return;
        }
        container.innerHTML = suggestions.map((s, i) => `<div class="autocomplete-item" data-index="${i}">${s}</div>`).join('');
        container.classList.remove('hidden');
    };

    const hide = () => {
        container.classList.add('hidden');
    };

    const choose = (value) => {
        input.value = value;
        hide();
        input.focus();
    };

    // Fetch suggestions from backend
    const fetchSuggestions = debounce(async () => {
        const q = input.value.trim();
        if (!q) {
            hide();
            return;
        }
        try {
            const ecosystem = ecosystemSelect ? ecosystemSelect.value : 'npm';
            const resp = await fetch(getApiUrl(`/package/search?query=${encodeURIComponent(q)}&ecosystem=${encodeURIComponent(ecosystem)}`));
            if (!resp.ok) {
                render([]);
                return;
            }
            const data = await resp.json();
            render(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Autocomplete error', err);
            hide();
        }
    }, 220);

    input.addEventListener('input', fetchSuggestions);

    // Click selection
    container.addEventListener('click', (e) => {
        const it = e.target.closest('.autocomplete-item');
        if (!it) return;
        const idx = Number(it.dataset.index);
        if (!Number.isNaN(idx) && suggestions[idx]) {
            choose(suggestions[idx]);
        }
    });

    // Keyboard navigation
    input.addEventListener('keydown', (e) => {
        if (container.classList.contains('hidden')) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, suggestions.length - 1);
            updateActive();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateActive();
        } else if (e.key === 'Enter') {
            if (selectedIndex >= 0 && suggestions[selectedIndex]) {
                e.preventDefault();
                choose(suggestions[selectedIndex]);
            } else {
                // allow form analyze
                hide();
            }
        } else if (e.key === 'Escape') {
            hide();
        }
    });

    function updateActive() {
        const items = container.querySelectorAll('.autocomplete-item');
        items.forEach((el) => el.classList.remove('active'));
        if (selectedIndex >= 0 && items[selectedIndex]) {
            items[selectedIndex].classList.add('active');
            // Ensure visible
            items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
    }

    // Hide when clicking outside
    document.addEventListener('click', (e) => {
        if (!parent.contains(e.target)) hide();
    });

    // If analyze button is clicked and input matches a suggestion, keep as-is. Otherwise proceed normally.
    if (analyzeBtn) {
        analyzeBtn.addEventListener('click', () => hide());
    }
}
