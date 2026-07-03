document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. Socket.io Live Visitor Telemetry
    // ----------------------------------------------------
    const socket = io();
    const activeCountEl = document.getElementById('active-count');

    socket.on('stats_update', (stats) => {
        if (activeCountEl) {
            // Display active viewers on the main page (default to at least 1)
            activeCountEl.textContent = Math.max(1, stats.activeViewers);
        }
    });

    // ----------------------------------------------------
    // 2. Sticky Navbar & Scroll Spy
    // ----------------------------------------------------
    const header = document.getElementById('header');
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
        // Sticky Header class addition
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }

        // Scroll Spy (Highlight active nav link)
        let currentSectionId = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop - 120;
            const sectionHeight = section.clientHeight;
            if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}` || 
                (currentSectionId === 'home' && link.getAttribute('href') === '#')) {
                link.classList.add('active');
            }
        });
    });

    // ----------------------------------------------------
    // 3. Mobile Navigation Menu Toggle
    // ----------------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const navLinksList = document.getElementById('nav-links');

    if (menuToggle && navLinksList) {
        menuToggle.addEventListener('click', () => {
            navLinksList.classList.toggle('active');
            menuToggle.classList.toggle('open');
        });

        // Close menu when a link is clicked
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                navLinksList.classList.remove('active');
                menuToggle.classList.remove('open');
            });
        });
    }

    // ----------------------------------------------------
    // 4. Menu Filtering System
    // ----------------------------------------------------
    const tabButtons = document.querySelectorAll('.tab-btn');
    const menuItems = document.querySelectorAll('.menu-item');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Toggle active tab class
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const selectedCategory = button.getAttribute('data-category');

            menuItems.forEach(item => {
                const itemCategory = item.getAttribute('data-category');
                
                if (selectedCategory === 'all' || itemCategory === selectedCategory) {
                    // Show item with animation
                    item.style.display = 'flex';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'scale(1)';
                    }, 50);
                } else {
                    // Hide item with animation
                    item.style.opacity = '0';
                    item.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        item.style.display = 'none';
                    }, 300);
                }
            });
        });
    });

    // ----------------------------------------------------
    // 5. Reservation Form Submit (AJAX)
    // ----------------------------------------------------
    const bookingForm = document.getElementById('booking-form');
    const formStatus = document.getElementById('form-status');
    const btnSubmit = document.getElementById('btn-submit-booking');

    // Set minimum date input to today
    const dateInput = document.getElementById('res-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
        dateInput.value = today;
    }

    if (bookingForm) {
        bookingForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Form Fields
            const name = document.getElementById('res-name').value.trim();
            const email = document.getElementById('res-email').value.trim();
            const phone = document.getElementById('res-phone').value.trim();
            const guests = document.getElementById('res-guests').value;
            const date = document.getElementById('res-date').value;
            const time = document.getElementById('res-time').value;
            const notes = document.getElementById('res-notes').value.trim();

            // Disable submit & show spinner representation
            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Processing Reservation...';

            formStatus.style.display = 'none';
            formStatus.className = 'form-status';

            try {
                const response = await fetch('/api/reserve', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ name, email, phone, guests, date, time, notes }),
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    formStatus.textContent = result.message;
                    formStatus.classList.add('success');
                    bookingForm.reset();
                    if (dateInput) dateInput.value = date; // Reset date to today
                } else {
                    formStatus.textContent = result.message || 'An error occurred. Please try again.';
                    formStatus.classList.add('error');
                }
            } catch (error) {
                console.error('Error submitting booking:', error);
                formStatus.textContent = 'Unable to connect to the booking server. Please check your connection.';
                formStatus.classList.add('error');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Confirm Reservation';
                formStatus.style.display = 'block';
            }
        });
    }

    // ----------------------------------------------------
    // 6. Interactive Canvas Motion Background (Steam Particles)
    // ----------------------------------------------------
    const canvas = document.getElementById('canvas-bg');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let particles = [];
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        // Adjust canvas dimensions on window resize
        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        // Particle Class definition
        class Particle {
            constructor() {
                this.reset();
            }

            reset() {
                this.x = Math.random() * width;
                this.y = height + Math.random() * 100; // Start slightly below bottom border
                this.size = Math.random() * 3 + 1; // Size 1 to 4px
                this.speedY = Math.random() * 0.8 + 0.3; // Speed upwards
                this.speedX = Math.random() * 0.4 - 0.2; // Horizontal float speed
                // HSL Coffee Theme Colors: Warm orange, dark bronze gold, cream latte
                const colorHue = Math.random() > 0.4 ? 35 : 25; // Warm hues (orange/brown)
                const colorLightness = Math.random() * 15 + 45; // 45% - 60% lightness
                this.alpha = Math.random() * 0.4 + 0.15; // Soft opacity
                this.color = `hsla(${colorHue}, 65%, ${colorLightness}%, ${this.alpha})`;
                this.waveRange = Math.random() * 40 + 10; // Sine wave amplitude
                this.waveSpeed = Math.random() * 0.01 + 0.005; // Sine wave speed
                this.angle = Math.random() * Math.PI * 2;
            }

            update() {
                this.y -= this.speedY;
                this.angle += this.waveSpeed;
                this.x += Math.sin(this.angle) * 0.35 + this.speedX;

                // Slowly fade out as it reaches top 25% of viewport
                if (this.y < height * 0.3) {
                    this.alpha -= 0.003;
                }

                // If particle goes off screen or transparent, reset to bottom
                if (this.y < 0 || this.alpha <= 0 || this.x < 0 || this.x > width) {
                    this.reset();
                }
            }

            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.shadowColor = 'rgba(198, 155, 109, 0.4)';
                ctx.shadowBlur = this.size * 1.5;
                ctx.fill();
                ctx.shadowBlur = 0; // Reset shadow blur
            }
        }

        // Initialize particles
        const maxParticles = Math.min(60, Math.floor(width / 25)); // Scale particle count to screen size
        for (let i = 0; i < maxParticles; i++) {
            particles.push(new Particle());
            // Pre-distribute particles along the screen height
            particles[i].y = Math.random() * height;
        }

        // Animation Loop
        function animate() {
            ctx.clearRect(0, 0, width, height);
            
            // Draw a subtle dark gold ambient gradient glow
            const gradient = ctx.createRadialGradient(width/2, height/2, 100, width/2, height/2, Math.max(width, height));
            gradient.addColorStop(0, 'rgba(18, 14, 12, 0.1)');
            gradient.addColorStop(1, 'rgba(10, 8, 7, 0.4)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, height);

            particles.forEach(particle => {
                particle.update();
                particle.draw();
            });

            requestAnimationFrame(animate);
        }

        animate();
    }
});
