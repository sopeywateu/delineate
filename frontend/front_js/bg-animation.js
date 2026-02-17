const canvas = document.getElementById('graph-canvas');
const ctx = canvas.getContext('2d');

let width, height;
let particles = [];

// Configuration for the Warm "Magma" Graph
const config = {
    particleCount: 60,        // Number of nodes
    connectionDistance: 150,  // How close to connect lines
    mouseDistance: 200,       // Mouse interaction range
    baseColor: '255, 87, 34', // The Orange color (RGB)
    moveSpeed: 0.5            // Speed of floating
};

// Resize handling
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Particle Class
class Particle {
    constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * config.moveSpeed;
        this.vy = (Math.random() - 0.5) * config.moveSpeed;
        this.size = Math.random() * 2 + 1;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > width) this.vx *= -1;
        if (this.y < 0 || this.y > height) this.vy *= -1;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${config.baseColor}, 0.7)`;
        ctx.fill();
    }
}

// Initialize
for (let i = 0; i < config.particleCount; i++) {
    particles.push(new Particle());
}

// Animation Loop
function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach((p, index) => {
        p.update();
        p.draw();

        // Draw connections (The "Graph" lines)
        for (let j = index + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < config.connectionDistance) {
                const opacity = 1 - (distance / config.connectionDistance);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p2.x, p2.y);
                // Warm orange lines
                ctx.strokeStyle = `rgba(${config.baseColor}, ${opacity * 0.4})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
    });

    requestAnimationFrame(animate);
}

animate();