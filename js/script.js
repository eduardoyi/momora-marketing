// Smooth scroll for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Floating memory cards parallax effect
document.addEventListener('DOMContentLoaded', function() {
    const floatingCards = document.querySelectorAll('.floating-memory');
    const heroSection = document.querySelector('.hero');
    
    if (floatingCards.length > 0 && heroSection) {
        let ticking = false;
        
        function updateParallax() {
            const scrolled = window.pageYOffset;
            const heroBottom = heroSection.offsetTop + heroSection.offsetHeight;
            
            // Only apply parallax when hero section is in view
            if (scrolled < heroBottom) {
                floatingCards.forEach(card => {
                    const speed = parseFloat(card.getAttribute('data-speed')) || 0.2;
                    const yPos = scrolled * speed;
                    card.style.transform = `translateY(${yPos}px)`;
                });
            }
            
            ticking = false;
        }
        
        function requestTick() {
            if (!ticking) {
                window.requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }
        
        window.addEventListener('scroll', requestTick);
    }
});

// Track download button clicks (optional analytics)
document.querySelectorAll('.store-button').forEach(button => {
    button.addEventListener('click', function() {
        const storeName = this.querySelector('.store-name').textContent;
        console.log(`Download clicked: ${storeName}`);
        
        // TODO: Add analytics tracking here
        // Example:
        // gtag('event', 'download_click', {
        //     'store': storeName
        // });
    });
});

// Add subtle parallax effect to hero visual (disabled while carousel is active)
// window.addEventListener('scroll', () => {
//     const scrolled = window.pageYOffset;
//     const phoneVisual = document.querySelector('.hero-visual');
//     
//     if (phoneVisual && scrolled < window.innerHeight) {
//         phoneVisual.style.transform = `translateY(${scrolled * 0.3}px)`;
//     }
// });

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe sections for fade-in effect
document.addEventListener('DOMContentLoaded', () => {
    const sections = document.querySelectorAll('.problem, .solution, .how-it-works, .benefits, .testimonial, .cta');
    
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(section);
    });
});

// Add active state to nav links on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.pageYOffset;
    
    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        
        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${sectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
});


