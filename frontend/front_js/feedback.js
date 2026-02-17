document.addEventListener('DOMContentLoaded', function() {
    const form = document.querySelector('.form-card');
    const submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const message = document.getElementById('message').value.trim();

        if (!name || !email || !message) {
            alert('Please fill in all fields.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="ph-fill ph-spinner"></i><span>Sending...</span>';

        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, message }),
            });

            if (response.ok) {
                alert('Thank you for your feedback!');
                form.reset();
            } else {
                const error = await response.json();
                alert('Error: ' + error.error);
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            alert('An error occurred. Please try again.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="ph-fill ph-paper-plane-right"></i><span>Submit Feedback</span>';
        }
    });
});