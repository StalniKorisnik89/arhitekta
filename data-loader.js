// ===== Data Loader for Frontend =====
// This file loads content from data/content.json and populates the frontend

let siteContent = null;

async function loadSiteContent() {
    try {
        // Add cache busting to ensure fresh data
        const cacheBuster = '?v=' + new Date().getTime();
        const response = await fetch('data/content.json' + cacheBuster);
        if (!response.ok) {
            throw new Error('Failed to load content');
        }
        siteContent = await response.json();
        console.log('Site content loaded:', siteContent);
        applyContentToPage();
    } catch (error) {
        console.error('Error loading site content:', error);
        // Fallback to default content if file doesn't exist
        siteContent = getDefaultContent();
        applyContentToPage();
    }
}

function getDefaultContent() {
    return {
        about: {
            title: "O nama",
            subtitle: "Studio za arhitekturu i dizajn enterijera",
            description: "Sa više od 15 godina iskustva u arhitektonskom projektovanju i dizajnu enterijera, naš studio kombinuje funkcionalnost, estetiku i inovativne materijale kako bismo kreirali prostore koji nadmašuju očekivanja.",
            stats: {
                experience: "15+",
                projects: "200+",
                clients: "100%"
            }
        },
        services: [],
        portfolio: [],
        contact: {
            phone: "+381 11 123 4567",
            email: "info@studio.rs",
            address: "Beograd, Srbija"
        }
    };
}

function applyContentToPage() {
    if (!siteContent) return;

    // Update About section
    if (siteContent.about) {
        const aboutTitle = document.querySelector('#about .section__title');
        const aboutSubtitle = document.querySelector('#about .section__subtitle');
        const aboutDescription = document.querySelector('.about__description');
        
        if (aboutTitle) aboutTitle.textContent = siteContent.about.title;
        if (aboutSubtitle) aboutSubtitle.textContent = siteContent.about.subtitle;
        if (aboutDescription) aboutDescription.textContent = siteContent.about.description;

        // Update stats
        if (siteContent.about.stats) {
            const statCards = document.querySelectorAll('.stat-card');
            if (statCards.length >= 3) {
                statCards[0].querySelector('.stat-card__number').textContent = siteContent.about.stats.experience;
                statCards[1].querySelector('.stat-card__number').textContent = siteContent.about.stats.projects;
                statCards[2].querySelector('.stat-card__number').textContent = siteContent.about.stats.clients;
            }
        }
    }

    // Update Services
    if (siteContent.services && siteContent.services.length > 0) {
        const servicesGrid = document.querySelector('.services__grid');
        if (servicesGrid) {
            servicesGrid.innerHTML = '';
            siteContent.services.forEach((service, index) => {
                const serviceCard = createServiceCard(service, index);
                servicesGrid.appendChild(serviceCard);
            });
        }
    }

    // Update Portfolio
    if (siteContent.portfolio && siteContent.portfolio.length > 0) {
        const portfolioGrid = document.querySelector('.portfolio__grid');
        if (portfolioGrid) {
            portfolioGrid.innerHTML = '';
            siteContent.portfolio.forEach((project) => {
                const portfolioItem = createPortfolioItem(project);
                portfolioGrid.appendChild(portfolioItem);
            });
        }
    }

    // Update Contact
    if (siteContent.contact) {
        const contactPhone = document.querySelector('.contact-info-item:nth-of-type(1) p');
        const contactEmail = document.querySelector('.contact-info-item:nth-of-type(2) p');
        const contactAddress = document.querySelector('.contact-info-item:nth-of-type(3) p');
        
        if (contactPhone) contactPhone.textContent = siteContent.contact.phone;
        if (contactEmail) contactEmail.textContent = siteContent.contact.email;
        if (contactAddress) contactAddress.textContent = siteContent.contact.address;
    }
}

function createServiceCard(service, index) {
    const card = document.createElement('div');
    card.className = 'service-card';
    
    const icons = [
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>`,
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="3" x2="9" y2="21"></line>
            <line x1="3" y1="9" x2="21" y2="9"></line>
        </svg>`,
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>`,
        `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>`
    ];
    
    card.innerHTML = `
        <div class="service-card__icon">
            ${icons[index % icons.length]}
        </div>
        <h3 class="service-card__title">${service.title}</h3>
        <p class="service-card__description">${service.description}</p>
    `;
    
    return card;
}

function createPortfolioItem(project) {
    const item = document.createElement('div');
    item.className = 'portfolio-item';
    
    item.innerHTML = `
        <div class="portfolio-item__image">
            <img src="${project.image}" alt="${project.title}" loading="lazy">
        </div>
        <div class="portfolio-item__overlay">
            <div class="portfolio-item__content">
                <h3 class="portfolio-item__title">${project.title}</h3>
                <p class="portfolio-item__category">${project.category}</p>
                <a href="portfolio-detail.html?id=${project.id}" class="portfolio-item__link">Pogledaj projekat</a>
            </div>
        </div>
    `;
    
    return item;
}

// Load content when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSiteContent);
} else {
    loadSiteContent();
}

// Export for use in other scripts
window.siteContent = siteContent;
