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
});
