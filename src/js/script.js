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

// --- How-it-works block 01: voice capture listen/compose loop ---
// --- How-it-works block 03: search-and-find loop ---
(function () {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Block 01 — voice capture. Panel B (compose) is a static opaque base
    // layer; only panel A (listen) fades in/out above it.
    const voicePanelA = document.getElementById('voice-panel-a');
    const voiceTimerEl = document.getElementById('voice-timer');

    if (voicePanelA && voiceTimerEl) {
        if (prefersReducedMotion) {
            voicePanelA.classList.add('is-hidden');
        } else {
            let voiceTimers = [];
            const later = (fn, ms) => voiceTimers.push(setTimeout(fn, ms));
            const loopVoice = () => {
                voiceTimers.forEach(clearTimeout);
                voiceTimers = [];
                voicePanelA.classList.remove('is-hidden');
                let sec = 1;
                voiceTimerEl.textContent = '0:0' + sec;
                const tick = () => {
                    sec++;
                    if (sec <= 7) {
                        voiceTimerEl.textContent = '0:0' + Math.min(sec, 9);
                        later(tick, 800);
                    } else {
                        later(() => {
                            voicePanelA.classList.add('is-hidden');
                            later(loopVoice, 5600);
                        }, 300);
                    }
                };
                later(tick, 800);
            };
            loopVoice();
        }
    }

    // Block 03 — search and find
    const searchTypedEl = document.getElementById('search-typed');
    const searchResultCount = document.getElementById('search-result-count');
    const searchList = document.getElementById('search-list');
    const searchMatchCard = document.getElementById('search-match-card');

    if (searchTypedEl && searchResultCount && searchList && searchMatchCard) {
        const query = 'makeover';
        const dimCards = searchList.querySelectorAll('.search-card:not(#search-match-card)');

        const setSearchOn = (on) => {
            searchResultCount.classList.toggle('is-visible', on);
            searchList.classList.toggle('is-searching', on);
            searchMatchCard.classList.toggle('is-match', on);
            dimCards.forEach((card) => card.classList.toggle('is-dim', on));
        };

        if (prefersReducedMotion) {
            searchTypedEl.textContent = query;
            setSearchOn(true);
        } else {
            let searchTimers = [];
            const later = (fn, ms) => searchTimers.push(setTimeout(fn, ms));
            const loopSearch = () => {
                searchTimers.forEach(clearTimeout);
                searchTimers = [];
                searchTypedEl.textContent = '';
                setSearchOn(false);
                let i = 0;
                const tick = () => {
                    i++;
                    searchTypedEl.textContent = query.slice(0, i);
                    if (i < query.length) {
                        later(tick, 130);
                    } else {
                        later(() => {
                            setSearchOn(true);
                            later(loopSearch, 5600);
                        }, 450);
                    }
                };
                later(tick, 1800);
            };
            loopSearch();
        }
    }
})();

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


