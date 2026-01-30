// ===== GitHub API Configuration =====
let githubConfig = {
    token: null,
    owner: null,
    repo: null
};

const GITHUB_API_BASE = 'https://api.github.com';
const DATA_FILE_PATH = 'data/content.json';
let DEFAULT_BRANCH = 'main'; // Will be detected from repo

// Detect default branch from repository
async function detectDefaultBranch() {
    try {
        const repoInfo = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}`);
        if (repoInfo && repoInfo.default_branch) {
            DEFAULT_BRANCH = repoInfo.default_branch;
            console.log('Detected default branch:', DEFAULT_BRANCH);
            return DEFAULT_BRANCH;
        }
    } catch (error) {
        console.warn('Could not detect default branch, using "main":', error);
    }
    return DEFAULT_BRANCH;
}

// ===== Utility Functions =====
function showLoading(show = true) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification notification-${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showError(message) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// ===== GitHub API Functions =====
async function githubRequest(endpoint, options = {}) {
    const url = `${GITHUB_API_BASE}${endpoint}`;
    const headers = {
        'Authorization': `token ${githubConfig.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers
    };

    try {
        const response = await fetch(url, {
            ...options,
            headers
        });

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorMessage;
                
                // More specific error messages
                if (response.status === 404) {
                    errorMessage = 'Fajl nije pronađen. Proverite putanju i da li fajl postoji u repozitorijumu.';
                } else if (response.status === 401) {
                    errorMessage = 'Neautorizovan pristup. Proverite da li je token ispravan i ima dozvole.';
                } else if (response.status === 403) {
                    errorMessage = 'Zabranjen pristup. Proverite dozvole tokena (potrebna "repo" dozvola).';
                }
            } catch (e) {
                // If error response is not JSON, use status text
                errorMessage = response.statusText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        return await response.json();
    } catch (error) {
        console.error('GitHub API Error:', error);
        throw error;
    }
}

async function getFileContent(path) {
    try {
        // GitHub API expects path segments to be separated by /, not URL encoded
        // But we need to handle special characters in path segments
        const pathParts = path.split('/');
        const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
        
        console.log('Getting file:', {
            path: encodedPath,
            owner: githubConfig.owner,
            repo: githubConfig.repo,
            branch: DEFAULT_BRANCH
        });
        
        // Include branch in URL to ensure we're working with the correct branch
        const response = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}?ref=${DEFAULT_BRANCH}`);
        
        if (response && response.content) {
            // GitHub API always returns base64 encoded content
            const base64Content = response.content.replace(/\s/g, '');
            const decodedContent = atob(base64Content);
            
            return {
                content: JSON.parse(decodedContent),
                sha: response.sha
            };
        }
        return null;
    } catch (error) {
        // If file doesn't exist (404), return null instead of throwing
        if (error.message && (error.message.includes('404') || error.message.includes('nije pronađen'))) {
            console.log('File does not exist, will be created:', path);
            return null;
        }
        console.error('Error getting file:', error);
        throw error;
    }
}

async function updateFile(path, content, sha, message = 'Update content') {
    // Ensure content is properly formatted JSON string
    const contentString = JSON.stringify(content, null, 2);
    // Encode to base64 - handle UTF-8 characters properly
    const contentBase64 = btoa(unescape(encodeURIComponent(contentString)));
    
    // GitHub API expects path segments to be separated by /, not URL encoded
    const pathParts = path.split('/');
    const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
    
    const body = {
        message: message,
        content: contentBase64,
        branch: DEFAULT_BRANCH
    };
    
    // Only include sha if file exists (for updates)
    if (sha) {
        body.sha = sha;
    }

    try {
        console.log('Updating file:', {
            path: encodedPath,
            hasSha: !!sha,
            sha: sha ? sha.substring(0, 7) + '...' : 'none',
            owner: githubConfig.owner,
            repo: githubConfig.repo,
            branch: DEFAULT_BRANCH
        });
        
        const response = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        
        console.log('File update response:', response);
        return true;
    } catch (error) {
        console.error('Error updating file:', error);
        // If error is 404, it means file doesn't exist
        // If we had SHA, it might be outdated, try without SHA
        if (error.message && (error.message.includes('404') || error.message.includes('nije pronađen'))) {
            if (sha) {
                console.log('File not found with provided SHA, trying to create new file without SHA...');
                // Re-encode path for retry (encodedPath might not be in scope here)
                const retryPathParts = path.split('/');
                const retryEncodedPath = retryPathParts.map(part => encodeURIComponent(part)).join('/');
                
                // Remove SHA and try again
                const newBody = {
                    message: message,
                    content: contentBase64,
                    branch: DEFAULT_BRANCH
                };
                try {
                    await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${retryEncodedPath}`, {
                        method: 'PUT',
                        body: JSON.stringify(newBody)
                    });
                    return true;
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                    throw retryError;
                }
            } else {
                // We're already trying to create, but it failed
                throw new Error('Ne mogu da kreiram fajl. Proverite dozvole tokena i da li repozitorijum postoji.');
            }
        }
        throw error;
    }
}

async function createFile(path, content, message = 'Create file') {
    // Use updateFile with no sha to create new file
    return await updateFile(path, content, null, message);
}

// ===== Data Management =====
let currentData = null;
let currentSha = null;

async function loadData() {
    showLoading(true);
    try {
        const result = await getFileContent(DATA_FILE_PATH);
        if (result && result.content) {
            currentData = result.content;
            currentSha = result.sha;
            populateForms();
            showNotification('Podaci uspešno učitani', 'success');
        } else {
            // File doesn't exist, create it
            currentData = getInitialData();
            try {
                await createFile(DATA_FILE_PATH, currentData, 'Initial content file');
                // Reload to get the SHA
                const newResult = await getFileContent(DATA_FILE_PATH);
                if (newResult) {
                    currentSha = newResult.sha;
                }
                populateForms();
                showNotification('Kreiran novi fajl sa podacima', 'success');
            } catch (createError) {
                console.error('Error creating file:', createError);
                // Still populate with initial data so user can work
                populateForms();
                showNotification('Kreiran lokalni fajl. Pokušajte ponovo da sačuvate.', 'error');
            }
        }
    } catch (error) {
        console.error('Load data error:', error);
        showNotification('Greška pri učitavanju podataka: ' + error.message, 'error');
        // Try to use initial data as fallback
        currentData = getInitialData();
        populateForms();
    } finally {
        showLoading(false);
    }
}

async function saveData(commitMessage = 'Update content') {
    showLoading(true);
    try {
        // Always check current file state first
        let fileInfo = null;
        let fileExists = false;
        
        try {
            fileInfo = await getFileContent(DATA_FILE_PATH);
            if (fileInfo && fileInfo.sha) {
                fileExists = true;
                currentSha = fileInfo.sha;
                console.log('File exists with SHA:', currentSha);
            }
        } catch (getError) {
            console.log('File does not exist or error getting file:', getError);
            fileExists = false;
            currentSha = null;
        }
        
        // Update or create file based on existence
        if (fileExists && currentSha) {
            console.log('Updating existing file with SHA:', currentSha);
            await updateFile(DATA_FILE_PATH, currentData, currentSha, commitMessage);
        } else {
            console.log('Creating new file (no SHA)');
            await updateFile(DATA_FILE_PATH, currentData, null, commitMessage);
        }
        
        // Wait a bit for GitHub to process the commit
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Reload to get new SHA for next update
        try {
            const result = await getFileContent(DATA_FILE_PATH);
            if (result && result.sha) {
                currentSha = result.sha;
                console.log('Updated SHA after save:', currentSha);
            }
        } catch (reloadError) {
            console.warn('Could not reload file after save:', reloadError);
            // This is not critical, continue
        }
        
        showNotification('Podaci uspešno sačuvani', 'success');
    } catch (error) {
        console.error('Save data error:', error);
        const errorMsg = error.message || 'Nepoznata greška';
        
        // More helpful error message
        if (errorMsg.includes('404') || errorMsg.includes('nije pronađen')) {
            showNotification('Fajl nije pronađen. Pokušavam da kreiram novi fajl...', 'error');
            // Try to create file without SHA
            try {
                await updateFile(DATA_FILE_PATH, currentData, null, commitMessage);
                showNotification('Fajl uspešno kreiran!', 'success');
                // Reload SHA
                const result = await getFileContent(DATA_FILE_PATH);
                if (result && result.sha) {
                    currentSha = result.sha;
                }
            } catch (createError) {
                showNotification('Greška pri kreiranju fajla: ' + createError.message, 'error');
            }
        } else {
            showNotification('Greška pri čuvanju: ' + errorMsg, 'error');
        }
    } finally {
        showLoading(false);
    }
}

function getInitialData() {
    return {
        about: {
            title: "O nama",
            subtitle: "Studio za arhitekturu i dizajn enterijera",
            description: "",
            stats: {
                experience: "15+",
                projects: "200+",
                clients: "100%"
            }
        },
        services: [],
        portfolio: [],
        contact: {
            phone: "",
            email: "",
            address: ""
        }
    };
}

// ===== Form Population =====
function populateForms() {
    if (!currentData) return;

    // About form
    if (currentData.about) {
        document.getElementById('about-title').value = currentData.about.title || '';
        document.getElementById('about-subtitle').value = currentData.about.subtitle || '';
        document.getElementById('about-description').value = currentData.about.description || '';
        document.getElementById('about-experience').value = currentData.about.stats?.experience || '';
        document.getElementById('about-projects').value = currentData.about.stats?.projects || '';
        document.getElementById('about-clients').value = currentData.about.stats?.clients || '';
    }

    // Contact form
    if (currentData.contact) {
        document.getElementById('contact-phone').value = currentData.contact.phone || '';
        document.getElementById('contact-email').value = currentData.contact.email || '';
        document.getElementById('contact-address').value = currentData.contact.address || '';
    }

    // Services list
    renderServices();
    
    // Portfolio list
    renderPortfolio();
}

// ===== Services Management =====
function renderServices() {
    const container = document.getElementById('services-list');
    container.innerHTML = '';

    if (!currentData.services || currentData.services.length === 0) {
        container.innerHTML = '<p class="empty-state">Nema usluga. Dodajte prvu uslugu.</p>';
        return;
    }

    currentData.services.forEach((service, index) => {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.innerHTML = `
            <div class="item-card__content">
                <h3>${service.title}</h3>
                <p>${service.description}</p>
            </div>
            <div class="item-card__actions">
                <button class="btn btn-small btn-secondary" onclick="editService(${service.id})">Izmeni</button>
                <button class="btn btn-small btn-danger" onclick="deleteService(${service.id})">Obriši</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function editService(id) {
    const service = currentData.services.find(s => s.id === id);
    if (!service) return;

    document.getElementById('service-id').value = service.id;
    document.getElementById('service-title').value = service.title;
    document.getElementById('service-description').value = service.description;
    document.getElementById('service-modal-title').textContent = 'Izmeni uslugu';
    
    openModal('service-modal');
}

function deleteService(id) {
    if (!confirm('Da li ste sigurni da želite da obrišete ovu uslugu?')) return;

    currentData.services = currentData.services.filter(s => s.id !== id);
    saveData('Delete service');
}

function addService() {
    document.getElementById('service-form').reset();
    document.getElementById('service-id').value = '';
    document.getElementById('service-modal-title').textContent = 'Dodaj uslugu';
    openModal('service-modal');
}

// ===== Portfolio Management =====
function renderPortfolio() {
    const container = document.getElementById('portfolio-list');
    container.innerHTML = '';

    if (!currentData.portfolio || currentData.portfolio.length === 0) {
        container.innerHTML = '<p class="empty-state">Nema projekata. Dodajte prvi projekat.</p>';
        return;
    }

    currentData.portfolio.forEach((project) => {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.innerHTML = `
            <div class="item-card__image">
                <img src="${project.image}" alt="${project.title}" onerror="this.src='https://via.placeholder.com/300x200?text=No+Image'">
            </div>
            <div class="item-card__content">
                <h3>${project.title}</h3>
                <p class="item-category">${project.category}</p>
                <p>${project.description}</p>
            </div>
            <div class="item-card__actions">
                <button class="btn btn-small btn-secondary" onclick="editPortfolio(${project.id})">Izmeni</button>
                <button class="btn btn-small btn-danger" onclick="deletePortfolio(${project.id})">Obriši</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function editPortfolio(id) {
    const project = currentData.portfolio.find(p => p.id === id);
    if (!project) return;

    document.getElementById('portfolio-id').value = project.id;
    document.getElementById('portfolio-title').value = project.title;
    document.getElementById('portfolio-category').value = project.category;
    document.getElementById('portfolio-image').value = project.image;
    document.getElementById('portfolio-description').value = project.description;
    document.getElementById('portfolio-area').value = project.specs?.area || '';
    document.getElementById('portfolio-year').value = project.specs?.year || '';
    document.getElementById('portfolio-location').value = project.specs?.location || '';
    document.getElementById('portfolio-status').value = project.specs?.status || '';
    document.getElementById('portfolio-modal-title').textContent = 'Izmeni projekat';
    
    openModal('portfolio-modal');
}

function deletePortfolio(id) {
    if (!confirm('Da li ste sigurni da želite da obrišete ovaj projekat?')) return;

    currentData.portfolio = currentData.portfolio.filter(p => p.id !== id);
    saveData('Delete portfolio item');
}

function addPortfolio() {
    document.getElementById('portfolio-form').reset();
    document.getElementById('portfolio-id').value = '';
    document.getElementById('portfolio-modal-title').textContent = 'Dodaj projekat';
    openModal('portfolio-modal');
}

// ===== Modal Functions =====
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'flex';
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.style.display = 'none';
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const savedConfig = localStorage.getItem('githubConfig');
    if (savedConfig) {
        try {
            githubConfig = JSON.parse(savedConfig);
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            
            // Detect default branch
            detectDefaultBranch().then(() => {
                document.getElementById('repo-info').textContent = `${githubConfig.owner}/${githubConfig.repo} (${DEFAULT_BRANCH})`;
            });
            
            loadData();
        } catch (error) {
            console.error('Error loading saved config:', error);
            localStorage.removeItem('githubConfig');
        }
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        githubConfig = {
            token: formData.get('token'),
            owner: formData.get('owner'),
            repo: formData.get('repo')
        };

        // Test connection
        showLoading(true);
        try {
            await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}`);
            
            // Detect default branch
            await detectDefaultBranch();
            
            // Save config
            localStorage.setItem('githubConfig', JSON.stringify(githubConfig));
            
            // Show dashboard
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('admin-dashboard').style.display = 'block';
            document.getElementById('repo-info').textContent = `${githubConfig.owner}/${githubConfig.repo} (${DEFAULT_BRANCH})`;
            
            loadData();
        } catch (error) {
            showError('Greška pri povezivanju: ' + error.message);
        } finally {
            showLoading(false);
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('githubConfig');
        location.reload();
    });

    // Tab navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update active tab
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show correct content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });

    // About form
    document.getElementById('about-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        currentData.about = {
            title: formData.get('title'),
            subtitle: formData.get('subtitle'),
            description: formData.get('description'),
            stats: {
                experience: formData.get('experience'),
                projects: formData.get('projects'),
                clients: formData.get('clients')
            }
        };
        
        await saveData('Update about section');
    });

    // Contact form
    document.getElementById('contact-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        currentData.contact = {
            phone: formData.get('phone'),
            email: formData.get('email'),
            address: formData.get('address')
        };
        
        await saveData('Update contact information');
    });

    // Service form
    document.getElementById('service-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');
        
        const service = {
            id: id ? parseInt(id) : (currentData.services.length > 0 ? Math.max(...currentData.services.map(s => s.id)) + 1 : 1),
            title: formData.get('title'),
            description: formData.get('description')
        };
        
        if (id) {
            const index = currentData.services.findIndex(s => s.id === parseInt(id));
            if (index !== -1) {
                currentData.services[index] = service;
            }
        } else {
            currentData.services.push(service);
        }
        
        closeModal('service-modal');
        await saveData(id ? 'Update service' : 'Add service');
    });

    // Portfolio form
    document.getElementById('portfolio-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const id = formData.get('id');
        
        const project = {
            id: id ? parseInt(id) : (currentData.portfolio.length > 0 ? Math.max(...currentData.portfolio.map(p => p.id)) + 1 : 1),
            title: formData.get('title'),
            category: formData.get('category'),
            image: formData.get('image'),
            description: formData.get('description'),
            specs: {
                area: formData.get('area'),
                year: formData.get('year'),
                location: formData.get('location'),
                status: formData.get('status')
            },
            gallery: []
        };
        
        if (id) {
            const index = currentData.portfolio.findIndex(p => p.id === parseInt(id));
            if (index !== -1) {
                // Preserve existing gallery
                project.gallery = currentData.portfolio[index].gallery || [];
                currentData.portfolio[index] = project;
            }
        } else {
            currentData.portfolio.push(project);
        }
        
        closeModal('portfolio-modal');
        await saveData(id ? 'Update portfolio item' : 'Add portfolio item');
    });

    // Add buttons
    document.getElementById('add-service-btn').addEventListener('click', addService);
    document.getElementById('add-portfolio-btn').addEventListener('click', addPortfolio);

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                closeModal(modal.id);
            }
        });
    });

    // Close modal on outside click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });
});

// Make functions globally available
window.editService = editService;
window.deleteService = deleteService;
window.editPortfolio = editPortfolio;
window.deletePortfolio = deletePortfolio;
