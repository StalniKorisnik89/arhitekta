// ===== Language Switcher & i18n =====
let currentLanguage = localStorage.getItem('language') || 'sr';
let translations = {};
window.translations = translations; // Export for data-loader
window.currentLanguage = currentLanguage; // Export for data-loader

// Load translations
async function loadTranslations(lang) {
    try {
        const response = await fetch(`translations/${lang}.json`);
        translations = await response.json();
        window.translations = translations; // Update window reference
        applyTranslations();
        
        // Trigger data-loader if it's waiting
        if (window.onTranslationsLoaded) {
            window.onTranslationsLoaded();
        }
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

// Apply translations to all elements with data-i18n attribute
function applyTranslations() {
    // Update all elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const value = getNestedValue(translations, key);
        if (value) {
            element.textContent = value;
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        const value = getNestedValue(translations, key);
        if (value) {
            element.placeholder = value;
        }
    });
    
    // Update HTML lang attribute
    document.documentElement.lang = currentLanguage;
    
    // Update page title and meta description based on language
    updateMetaTags();
}

// Get nested value from object using dot notation
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

// Update meta tags for SEO
function updateMetaTags() {
    const titles = {
        sr: 'Arhitektonski Studio | Arhitektura i Dizajn Enterijera',
        en: 'Architecture Studio | Architecture and Interior Design',
        ru: 'Архитектурная Студия | Архитектура и Дизайн Интерьеров'
    };
    
    const descriptions = {
        sr: 'Studio za arhitekturu i dizajn enterijera - kreiramo funkcionalne i estetski izuzetne prostore',
        en: 'Architecture and interior design studio - we create functional and aesthetically exceptional spaces',
        ru: 'Студия архитектуры и дизайна интерьеров - создаем функциональные и эстетически исключительные пространства'
    };
    
    document.title = titles[currentLanguage] || titles.sr;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        metaDescription.content = descriptions[currentLanguage] || descriptions.sr;
    }
}

// Language switcher event listeners
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        switchLanguage(lang);
    });
});

function switchLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    window.currentLanguage = lang; // Export for data-loader
    
    // Update active button
    document.querySelectorAll('.lang-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-lang') === lang) {
            btn.classList.add('active');
        }
    });
    
    // Load and apply translations
    loadTranslations(lang);
    
    // Trigger language change event for data-loader
    window.dispatchEvent(new CustomEvent('languageChanged'));
}

// Initialize language on page load
// First, remove all active classes to avoid duplicates
document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.remove('active');
});

// Then set the correct active button based on currentLanguage
document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.getAttribute('data-lang') === currentLanguage) {
        btn.classList.add('active');
    }
});

// Load translations after setting active button
loadTranslations(currentLanguage);

// ===== Mobile Menu Toggle =====
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');

if (navToggle) {
    navToggle.addEventListener('click', () => {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    });
}

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav__link').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth < 768) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth < 768) {
        if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
});

// ===== Smooth Scrolling =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;
        
        // Skip mailto: and tel: links - let them work normally
        if (href.startsWith('mailto:') || href.startsWith('tel:')) {
            return;
        }
        
        e.preventDefault();
        const target = document.querySelector(href);
        
        if (target) {
            const headerOffset = 70;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    });
});

// ===== Header Scroll Effect =====
const header = document.getElementById('header');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    } else {
        header.style.boxShadow = 'none';
    }
    
    lastScroll = currentScroll;
});

// ===== Intersection Observer for Animations =====
let animationObserver = null;
let animationInitialized = false;

function initAnimationObserver() {
    // Prevent multiple initializations
    if (animationInitialized) {
        return;
    }
    
    // Destroy existing observer if it exists
    if (animationObserver) {
        animationObserver.disconnect();
    }
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    animationObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            // Only animate if element is intersecting and not already animated
            if (entry.isIntersecting && !entry.target.classList.contains('fade-in')) {
                entry.target.classList.add('fade-in');
                // Stop observing this element to prevent re-animation
                animationObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe elements for animation
    const animateElements = document.querySelectorAll('.service-card, .portfolio-item, .stat-card, .contact-info-item');
    animateElements.forEach(el => {
        // Only observe if not already animated
        if (!el.classList.contains('fade-in')) {
            animationObserver.observe(el);
        }
    });
    
    animationInitialized = true;
}

// Initialize animation observer on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initAnimationObserver();
    });
} else {
    // DOM already loaded
    initAnimationObserver();
}

// ===== Contact Form Handling =====
let contactEmail = 'info@studio.rs'; // Default email, will be updated from data/content.json

// Initialize EmailJS (you'll need to get your public key from EmailJS dashboard)
// For now, we'll use a placeholder - you need to replace this with your actual EmailJS public key
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // Replace with your EmailJS public key
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID'; // Replace with your EmailJS service ID
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // Replace with your EmailJS template ID

// Initialize EmailJS when available
if (typeof emailjs !== 'undefined') {
    emailjs.init(EMAILJS_PUBLIC_KEY);
}

function updateContactLinks() {
    // Get contact info from page
    const phoneElement = document.getElementById('contact-phone-link');
    const emailElement = document.getElementById('contact-email-link');
    
    if (phoneElement) {
        const phone = phoneElement.textContent.trim();
        phoneElement.href = `tel:${phone}`;
    }
    
    if (emailElement) {
        const email = emailElement.textContent.trim();
        contactEmail = email;
        emailElement.href = `mailto:${email}`;
    }
}

// Update contact links when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(updateContactLinks, 500);
    });
} else {
    setTimeout(updateContactLinks, 500);
}

const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form data
        const formData = new FormData(contactForm);
        const data = Object.fromEntries(formData);
        
        // Get email from contact info (updated from admin)
        const emailLink = document.getElementById('contact-email-link');
        const recipientEmail = emailLink ? emailLink.textContent.trim() : contactEmail;
        
        // Validate form
        if (!data.name || !data.email || !data.message) {
            showFormMessage('Molimo popunite sva obavezna polja.', 'error');
            return;
        }
        
        // Show loading state
        const submitBtn = document.getElementById('submit-btn');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = getNestedValue(translations, 'contact.form.sending') || 'Šalje se...';
        
        // Try to send email using EmailJS if configured, otherwise fallback to mailto
        if (typeof emailjs !== 'undefined' && EMAILJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
            try {
                // Send email using EmailJS
                await emailjs.send(
                    EMAILJS_SERVICE_ID,
                    EMAILJS_TEMPLATE_ID,
                    {
                        to_email: recipientEmail,
                        from_name: data.name,
                        from_email: data.email,
                        phone: data.phone || 'Nije naveden',
                        message: data.message,
                        subject: `Kontakt forma: ${data.name}`
                    }
                );
                
                // Show success message
                showFormMessage(
                    getNestedValue(translations, 'contact.form.success') || 'Hvala vam! Vaša poruka je uspešno poslata.',
                    'success'
                );
                
                // Reset form
                contactForm.reset();
                
                // Reset button
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            } catch (error) {
                console.error('EmailJS Error:', error);
                // Fallback to mailto if EmailJS fails
                sendViaMailto(data, recipientEmail, submitBtn, originalText);
            }
        } else {
            // Fallback to mailto if EmailJS is not configured
            sendViaMailto(data, recipientEmail, submitBtn, originalText);
        }
    });
}

function sendViaMailto(data, recipientEmail, submitBtn, originalText) {
    // Create mailto link with subject and body
    const subject = encodeURIComponent(`Kontakt forma: ${data.name}`);
    const body = encodeURIComponent(
        `Ime: ${data.name}\n` +
        `Email: ${data.email}\n` +
        (data.phone ? `Telefon: ${data.phone}\n` : '') +
        `\nPoruka:\n${data.message}`
    );
    
    const mailtoLink = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    
    try {
        window.location.href = mailtoLink;
        
        // Show success message
        showFormMessage(
            getNestedValue(translations, 'contact.form.success') || 'Hvala vam! Email klijent je otvoren.',
            'success'
        );
        
        // Reset form
        document.getElementById('contact-form').reset();
        
        // Reset button after 3 seconds
        setTimeout(() => {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 3000);
    } catch (error) {
        console.error('Error opening email client:', error);
        showFormMessage(
            getNestedValue(translations, 'contact.form.error') || 'Greška pri slanju poruke. Molimo pokušajte ponovo.',
            'error'
        );
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function showFormMessage(message, type = 'success') {
    const messageDiv = document.getElementById('form-message');
    if (messageDiv) {
        messageDiv.textContent = message;
        messageDiv.className = `form-message ${type}`;
        messageDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Export function to update email from data loader
window.updateContactEmail = function(email) {
    contactEmail = email;
    updateContactLinks();
};

// ===== Portfolio Item Click Handler =====
document.querySelectorAll('.portfolio-item').forEach(item => {
    item.addEventListener('click', () => {
        // Here you can add functionality to open project details
        // For now, it's just a placeholder
        console.log('Portfolio item clicked');
    });
});

// ===== Lazy Loading for Images (if you add real images later) =====
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                }
                imageObserver.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// ===== Window Resize Handler =====
let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        // Close mobile menu on resize to desktop
        if (window.innerWidth >= 768) {
            navToggle.classList.remove('active');
            navMenu.classList.remove('active');
            document.body.style.overflow = '';
        }
    }, 250);
});

// ===== Initialize on DOM Load =====
document.addEventListener('DOMContentLoaded', () => {
    // Add fade-in animation to hero content
    const heroContent = document.querySelector('.hero__content');
    if (heroContent) {
        heroContent.style.opacity = '0';
        heroContent.style.animation = 'fadeInUp 0.8s ease-out forwards';
    }
    
    // Set initial header state
    if (window.pageYOffset > 100) {
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    }
});
