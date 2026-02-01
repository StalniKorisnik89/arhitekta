// ===== Client Authentication =====
const USERS_FILE_PATH = 'data/users.json';
let currentUser = null;
let siteContent = null;

// Simple hash function (SHA-256)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Load users from GitHub (public access, no auth needed)
async function loadUsers() {
    try {
        // Try to load from GitHub Pages (public)
        const response = await fetch(`https://raw.githubusercontent.com/StalniKorisnik89/arhitekta/main/${USERS_FILE_PATH}`);
        if (!response.ok) {
            throw new Error('Users file not found');
        }
        const users = await response.json();
        return users;
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

// Authenticate user
async function authenticateUser(username, password) {
    const users = await loadUsers();
    const passwordHash = await hashPassword(password);
    
    const user = users.find(u => u.username === username && u.passwordHash === passwordHash);
    return user;
}

// Load site content (public)
async function loadSiteContent() {
    try {
        const response = await fetch('https://raw.githubusercontent.com/StalniKorisnik89/arhitekta/main/data/content.json?v=' + Date.now());
        if (!response.ok) {
            throw new Error('Content file not found');
        }
        const content = await response.json();
        return content;
    } catch (error) {
        console.error('Error loading content:', error);
        return null;
    }
}

// Display content (read-only)
function displayContent(content) {
    if (!content) return;

    // About section
    const aboutContent = document.getElementById('about-content');
    if (aboutContent && content.about) {
        const lang = 'sr'; // Default language
        const about = content.about[lang] || content.about.sr || {};
        const stats = content.about.stats || {};
        
        aboutContent.innerHTML = `
            <div class="read-only-section">
                <h3>${about.title || 'O nama'}</h3>
                <p class="subtitle">${about.subtitle || ''}</p>
                <p>${about.description || ''}</p>
                <div class="stats-grid" style="margin-top: 30px;">
                    <div class="stat-item">
                        <h4>${stats.experience || ''}</h4>
                        <p>Godine iskustva</p>
                    </div>
                    <div class="stat-item">
                        <h4>${stats.projects || ''}</h4>
                        <p>Projekti</p>
                    </div>
                    <div class="stat-item">
                        <h4>${stats.clients || ''}</h4>
                        <p>Klijenti</p>
                    </div>
                </div>
            </div>
        `;
    }

    // Services section
    const servicesContent = document.getElementById('services-content');
    if (servicesContent && content.services) {
        const services = content.services.map(service => {
            const lang = 'sr';
            const serviceData = service[lang] || service.sr || service;
            return `
                <div class="read-only-card">
                    <h3>${serviceData.title || service.title || ''}</h3>
                    <p>${serviceData.description || service.description || ''}</p>
                </div>
            `;
        }).join('');
        servicesContent.innerHTML = services || '<p>Nema usluga.</p>';
    }

    // Portfolio section
    const portfolioContent = document.getElementById('portfolio-content');
    if (portfolioContent && content.portfolio) {
        const portfolio = content.portfolio.map(project => {
            const lang = 'sr';
            const projectData = project[lang] || project.sr || project;
            return `
                <div class="read-only-card">
                    <img src="${project.image || ''}" alt="${projectData.title || project.title || ''}" style="width: 100%; max-width: 400px; border-radius: 8px; margin-bottom: 15px;">
                    <h3>${projectData.title || project.title || ''}</h3>
                    <p class="category">${projectData.category || project.category || ''}</p>
                    <p>${projectData.description || project.description || ''}</p>
                    ${project.specs ? `
                        <div class="specs" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
                            <p><strong>Površina:</strong> ${project.specs.area || ''}</p>
                            <p><strong>Godina:</strong> ${project.specs.year || ''}</p>
                            <p><strong>Lokacija:</strong> ${project.specs.location || ''}</p>
                            <p><strong>Status:</strong> ${project.specs.status || ''}</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        portfolioContent.innerHTML = portfolio || '<p>Nema projekata.</p>';
    }

    // Contact section
    const contactContent = document.getElementById('contact-content');
    if (contactContent && content.contact) {
        contactContent.innerHTML = `
            <div class="read-only-section">
                <p><strong>Telefon:</strong> <a href="tel:${content.contact.phone || ''}">${content.contact.phone || ''}</a></p>
                <p><strong>Email:</strong> <a href="mailto:${content.contact.email || ''}">${content.contact.email || ''}</a></p>
                <p><strong>Adresa:</strong> ${content.contact.address || ''}</p>
            </div>
        `;
    }
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const savedUser = localStorage.getItem('clientUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('client-dashboard').style.display = 'flex';
            document.getElementById('client-info').textContent = currentUser.username;
            loadSiteContent().then(content => {
                siteContent = content;
                displayContent(content);
            });
        } catch (error) {
            console.error('Error loading saved user:', error);
            localStorage.removeItem('clientUser');
        }
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = formData.get('username');
        const password = formData.get('password');

        showLoading(true);
        try {
            const user = await authenticateUser(username, password);
            if (user) {
                currentUser = { username: user.username };
                localStorage.setItem('clientUser', JSON.stringify(currentUser));
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('client-dashboard').style.display = 'flex';
                document.getElementById('client-info').textContent = user.username;
                
                // Load and display content
                const content = await loadSiteContent();
                siteContent = content;
                displayContent(content);
            } else {
                showError('Pogrešno korisničko ime ili lozinka');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Greška pri prijavljivanju. Pokušajte ponovo.');
        } finally {
            showLoading(false);
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('clientUser');
        currentUser = null;
        document.getElementById('client-dashboard').style.display = 'none';
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('login-form').reset();
    });

    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
});

function showLoading(show = true) {
    // Create loading overlay if it doesn't exist
    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner"></div><p>Učitavanje...</p>';
        document.body.appendChild(overlay);
    }
    overlay.style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}
