// Flow chart SVG connector drawing
function drawFlowConnectors() {
    const canvas = document.getElementById('flowCanvas');
    if (!canvas) return;

    const steps = document.querySelectorAll('.flow-step');
    if (steps.length < 2) return;

    // Set canvas dimensions to match the flow container
    const flowSection = document.querySelector('.flow-section');
    const flowContainer = document.querySelector('.flow-container');
    
    canvas.setAttribute('width', window.innerWidth);
    canvas.setAttribute('height', flowContainer.offsetHeight + 200);

    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'rgba(200, 59, 16, 0.4)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw curves between consecutive steps
    for (let i = 0; i < steps.length - 1; i++) {
        const currentStep = steps[i];
        const nextStep = steps[i + 1];

        // Get bounding rectangles
        const currentRect = currentStep.getBoundingClientRect();
        const nextRect = nextStep.getBoundingClientRect();
        const flowRect = flowContainer.getBoundingClientRect();

        // Calculate positions relative to canvas
        const currentBottom = currentRect.bottom - flowRect.top;
        const currentCenterX = currentRect.left - flowRect.left + currentRect.width / 2;
        
        const nextTop = nextRect.top - flowRect.top;
        const nextCenterX = nextRect.left - flowRect.left + nextRect.width / 2;

        // Draw smooth curved connector
        const controlPointY = (currentBottom + nextTop) / 2;

        ctx.beginPath();
        ctx.moveTo(currentCenterX, currentBottom);
        
        // Quadratic curve for smooth connection
        ctx.bezierCurveTo(
            currentCenterX, controlPointY - 40,
            nextCenterX, controlPointY + 40,
            nextCenterX, nextTop
        );
        
        ctx.stroke();

        // Draw arrow head
        const arrowSize = 8;
        const angle = Math.atan2(nextTop - currentBottom, nextCenterX - currentCenterX);
        
        ctx.fillStyle = 'rgba(200, 59, 16, 0.5)';
        ctx.beginPath();
        ctx.moveTo(nextCenterX, nextTop);
        ctx.lineTo(
            nextCenterX - arrowSize * Math.cos(angle - Math.PI / 6),
            nextTop - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            nextCenterX - arrowSize * Math.cos(angle + Math.PI / 6),
            nextTop - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }
}

// Initialize on load
window.addEventListener('load', drawFlowConnectors);

// Redraw on resize
window.addEventListener('resize', () => {
    setTimeout(drawFlowConnectors, 100);
});
