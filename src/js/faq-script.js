// FAQ Accordion functionality
document.addEventListener('DOMContentLoaded', function() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            // Close all other items
            const wasActive = item.classList.contains('active');
            
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            if (wasActive) {
                item.classList.remove('active');
            } else {
                item.classList.add('active');
            }
        });
    });

    // Open first item by default
    if (faqItems.length > 0) {
        faqItems[0].classList.add('active');
    }

    // Handle URL hash for direct linking to questions
    const hash = window.location.hash;
    if (hash) {
        const questionNumber = hash.replace('#q', '');
        const targetItem = Array.from(faqItems).find(item => {
            const number = item.querySelector('.faq-number').textContent.replace('.', '');
            return number === questionNumber;
        });
        
        if (targetItem) {
            // Close first item if it was auto-opened
            faqItems[0].classList.remove('active');
            
            // Open target item
            targetItem.classList.add('active');
            
            // Scroll to item
            setTimeout(() => {
                targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
        }
    }

    // Add IDs to FAQ items for linking
    faqItems.forEach(item => {
        const number = item.querySelector('.faq-number').textContent.replace('.', '');
        item.id = `q${number}`;
    });
});

