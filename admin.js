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
                } else if (response.status === 409) {
                    errorMessage = errorData.message || '409 Conflict - Fajl je promenjen. Pokušavam ponovo sa najnovijim SHA.';
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
            // Decode base64 and handle UTF-8 properly using TextDecoder
            const binaryString = atob(base64Content);
            const utf8Bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                utf8Bytes[i] = binaryString.charCodeAt(i);
            }
            const decodedContent = new TextDecoder('utf-8').decode(utf8Bytes);
            
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
    // Use a more reliable method for UTF-8 to base64 conversion
    function utf8ToBase64(str) {
        // Convert string to UTF-8 bytes using TextEncoder
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(str);
        
        // Convert bytes to binary string in chunks to avoid stack overflow
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
            const chunk = utf8Bytes.slice(i, Math.min(i + chunkSize, utf8Bytes.length));
            // Convert Uint8Array chunk to regular array for apply
            const chunkArray = Array.from(chunk);
            binaryString += String.fromCharCode.apply(null, chunkArray);
        }
        // Encode to base64
        return btoa(binaryString);
    }
    const contentBase64 = utf8ToBase64(contentString);
    
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
        
        // Handle 409 Conflict (SHA mismatch) - file was modified by another process
        if (error.message && (error.message.includes('409') || error.message.includes('does not match') || error.message.includes('Conflict'))) {
            console.log('SHA mismatch detected (409 Conflict). File was modified. Retrying with fresh SHA...');
            // Get fresh SHA and retry
            try {
                const freshFileInfo = await getFileContent(path);
                if (freshFileInfo && freshFileInfo.sha) {
                    const freshSha = freshFileInfo.sha;
                    console.log('Retrying with fresh SHA:', freshSha.substring(0, 7) + '...');
                    
                    // Retry with fresh SHA
                    const retryBody = {
                        message: message,
                        content: contentBase64,
                        branch: DEFAULT_BRANCH,
                        sha: freshSha
                    };
                    
                    const retryResponse = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`, {
                        method: 'PUT',
                        body: JSON.stringify(retryBody)
                    });
                    
                    console.log('Retry successful with fresh SHA');
                    return true;
                } else {
                    throw new Error('Ne mogu da dobavim najnoviji SHA fajla. Pokušajte ponovo.');
                }
            } catch (retryError) {
                console.error('Retry with fresh SHA failed:', retryError);
                throw new Error('Fajl je promenjen na serveru. Osvežite stranicu i pokušajte ponovo.');
            }
        }
        
        // If error is 404, it means file doesn't exist
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
        // Always get the latest file state first to ensure we have the most recent SHA
        let fileInfo = null;
        let fileExists = false;
        
        try {
            fileInfo = await getFileContent(DATA_FILE_PATH);
            if (fileInfo && fileInfo.sha) {
                fileExists = true;
                currentSha = fileInfo.sha;
                console.log('Latest file SHA retrieved:', currentSha.substring(0, 7) + '...');
            }
        } catch (getError) {
            console.log('File does not exist or error getting file:', getError);
            fileExists = false;
            currentSha = null;
        }
        
        // Update or create file based on existence
        if (fileExists && currentSha) {
            console.log('Updating existing file with SHA:', currentSha.substring(0, 7) + '...');
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
                console.log('Updated SHA after save:', currentSha.substring(0, 7) + '...');
            }
        } catch (reloadError) {
            console.warn('Could not reload file after save:', reloadError);
            // This is not critical, continue
        }
        
        showNotification('Podaci uspešno sačuvani', 'success');
        
        // Refresh lists to show updated data
        renderServices();
        renderPortfolio();
    } catch (error) {
        console.error('Save data error:', error);
        const errorMsg = error.message || 'Nepoznata greška';
        
        // Handle specific error cases
        if (errorMsg.includes('409') || errorMsg.includes('does not match') || errorMsg.includes('Conflict')) {
            showNotification('Fajl je promenjen. Osvežite stranicu i pokušajte ponovo.', 'error');
        } else if (errorMsg.includes('404') || errorMsg.includes('nije pronađen')) {
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
                // Refresh lists after successful creation
                renderServices();
                renderPortfolio();
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

    // About form - support both old and new format
    if (currentData.about) {
        // Check if new multilingual format
        if (currentData.about.sr || currentData.about.en || currentData.about.ru) {
            // New format
            document.getElementById('about-title-sr').value = currentData.about.sr?.title || '';
            document.getElementById('about-subtitle-sr').value = currentData.about.sr?.subtitle || '';
            document.getElementById('about-description-sr').value = currentData.about.sr?.description || '';
            document.getElementById('about-title-en').value = currentData.about.en?.title || '';
            document.getElementById('about-subtitle-en').value = currentData.about.en?.subtitle || '';
            document.getElementById('about-description-en').value = currentData.about.en?.description || '';
            document.getElementById('about-title-ru').value = currentData.about.ru?.title || '';
            document.getElementById('about-subtitle-ru').value = currentData.about.ru?.subtitle || '';
            document.getElementById('about-description-ru').value = currentData.about.ru?.description || '';
        } else {
            // Old format - migrate on display
            document.getElementById('about-title-sr').value = currentData.about.title || '';
            document.getElementById('about-subtitle-sr').value = currentData.about.subtitle || '';
            document.getElementById('about-description-sr').value = currentData.about.description || '';
            document.getElementById('about-title-en').value = '';
            document.getElementById('about-subtitle-en').value = '';
            document.getElementById('about-description-en').value = '';
            document.getElementById('about-title-ru').value = '';
            document.getElementById('about-subtitle-ru').value = '';
            document.getElementById('about-description-ru').value = '';
        }
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
        
        // Support both old and new format
        const title = (service.sr?.title || service.title || 'Bez naziva');
        const description = (service.sr?.description || service.description || 'Bez opisa');
        
        item.innerHTML = `
            <div class="item-card__content">
                <h3>${title}</h3>
                <p>${description}</p>
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
    
    // Support both old and new format
    if (service.sr || service.en || service.ru) {
        // New multilingual format
        document.getElementById('service-title-sr').value = service.sr?.title || '';
        document.getElementById('service-description-sr').value = service.sr?.description || '';
        document.getElementById('service-title-en').value = service.en?.title || '';
        document.getElementById('service-description-en').value = service.en?.description || '';
        document.getElementById('service-title-ru').value = service.ru?.title || '';
        document.getElementById('service-description-ru').value = service.ru?.description || '';
    } else {
        // Old format
        document.getElementById('service-title-sr').value = service.title || '';
        document.getElementById('service-description-sr').value = service.description || '';
        document.getElementById('service-title-en').value = '';
        document.getElementById('service-description-en').value = '';
        document.getElementById('service-title-ru').value = '';
        document.getElementById('service-description-ru').value = '';
    }
    
    document.getElementById('service-modal-title').textContent = 'Izmeni uslugu';
    
    openModal('service-modal');
}

function deleteService(id) {
    if (!confirm('Da li ste sigurni da želite da obrišete ovu uslugu?')) return;

    currentData.services = currentData.services.filter(s => s.id !== id);
    saveData('Delete service').then(() => {
        renderServices();
    });
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
                <img src="${project.image}" alt="${project.title}" onerror="this.onerror=null; this.style.backgroundColor='#ddd'; this.style.display='flex'; this.style.alignItems='center'; this.style.justifyContent='center'; this.innerHTML='<span style=color:#999;font-size:14px>No Image</span>'">
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
    document.getElementById('portfolio-image').value = project.image || '';
    
    // Support both old and new format
    if (project.sr || project.en || project.ru) {
        // New multilingual format
        document.getElementById('portfolio-title-sr').value = project.sr?.title || '';
        document.getElementById('portfolio-category-sr').value = project.sr?.category || '';
        document.getElementById('portfolio-description-sr').value = project.sr?.description || '';
        document.getElementById('portfolio-title-en').value = project.en?.title || '';
        document.getElementById('portfolio-category-en').value = project.en?.category || '';
        document.getElementById('portfolio-description-en').value = project.en?.description || '';
        document.getElementById('portfolio-title-ru').value = project.ru?.title || '';
        document.getElementById('portfolio-category-ru').value = project.ru?.category || '';
        document.getElementById('portfolio-description-ru').value = project.ru?.description || '';
    } else {
        // Old format
        document.getElementById('portfolio-title-sr').value = project.title || '';
        document.getElementById('portfolio-category-sr').value = project.category || '';
        document.getElementById('portfolio-description-sr').value = project.description || '';
        document.getElementById('portfolio-title-en').value = '';
        document.getElementById('portfolio-category-en').value = '';
        document.getElementById('portfolio-description-en').value = '';
        document.getElementById('portfolio-title-ru').value = '';
        document.getElementById('portfolio-category-ru').value = '';
        document.getElementById('portfolio-description-ru').value = '';
    }
    
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
    saveData('Delete portfolio item').then(() => {
        renderPortfolio();
    });
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
        
        // Migrate old format to new multilingual format if needed
        if (!currentData.about.sr && !currentData.about.en && !currentData.about.ru) {
            // Old format - migrate
            const oldAbout = currentData.about;
            currentData.about = {
                sr: {
                    title: oldAbout.title || formData.get('title-sr'),
                    subtitle: oldAbout.subtitle || formData.get('subtitle-sr'),
                    description: oldAbout.description || formData.get('description-sr')
                },
                en: {
                    title: formData.get('title-en') || oldAbout.title,
                    subtitle: formData.get('subtitle-en') || oldAbout.subtitle,
                    description: formData.get('description-en') || oldAbout.description
                },
                ru: {
                    title: formData.get('title-ru') || oldAbout.title,
                    subtitle: formData.get('subtitle-ru') || oldAbout.subtitle,
                    description: formData.get('description-ru') || oldAbout.description
                },
                stats: oldAbout.stats || {
                    experience: formData.get('experience'),
                    projects: formData.get('projects'),
                    clients: formData.get('clients')
                }
            };
        } else {
            // New format - update
            currentData.about = {
                sr: {
                    title: formData.get('title-sr'),
                    subtitle: formData.get('subtitle-sr'),
                    description: formData.get('description-sr')
                },
                en: {
                    title: formData.get('title-en') || formData.get('title-sr'),
                    subtitle: formData.get('subtitle-en') || formData.get('subtitle-sr'),
                    description: formData.get('description-en') || formData.get('description-sr')
                },
                ru: {
                    title: formData.get('title-ru') || formData.get('title-sr'),
                    subtitle: formData.get('subtitle-ru') || formData.get('subtitle-sr'),
                    description: formData.get('description-ru') || formData.get('description-sr')
                },
                stats: currentData.about.stats || {
                    experience: formData.get('experience'),
                    projects: formData.get('projects'),
                    clients: formData.get('clients')
                }
            };
        }
        
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
            sr: {
                title: formData.get('title-sr'),
                description: formData.get('description-sr')
            },
            en: {
                title: formData.get('title-en') || formData.get('title-sr'),
                description: formData.get('description-en') || formData.get('description-sr')
            },
            ru: {
                title: formData.get('title-ru') || formData.get('title-sr'),
                description: formData.get('description-ru') || formData.get('description-sr')
            }
        };
        
        // Migrate old format if exists
        if (id) {
            const oldService = currentData.services.find(s => s.id === parseInt(id));
            if (oldService && !oldService.sr && !oldService.en && !oldService.ru) {
                // Old format - migrate
                service.sr = {
                    title: oldService.title || service.sr.title,
                    description: oldService.description || service.sr.description
                };
                service.en = {
                    title: service.en.title || oldService.title,
                    description: service.en.description || oldService.description
                };
                service.ru = {
                    title: service.ru.title || oldService.title,
                    description: service.ru.description || oldService.description
                };
            }
        }
        
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
            sr: {
                title: formData.get('title-sr'),
                category: formData.get('category-sr'),
                description: formData.get('description-sr')
            },
            en: {
                title: formData.get('title-en') || formData.get('title-sr'),
                category: formData.get('category-en') || formData.get('category-sr'),
                description: formData.get('description-en') || formData.get('description-sr')
            },
            ru: {
                title: formData.get('title-ru') || formData.get('title-sr'),
                category: formData.get('category-ru') || formData.get('category-sr'),
                description: formData.get('description-ru') || formData.get('description-sr')
            },
            image: formData.get('image'),
            specs: {
                area: formData.get('area'),
                year: formData.get('year'),
                location: formData.get('location'),
                status: formData.get('status')
            },
            gallery: []
        };
        
        // Migrate old format if exists
        if (id) {
            const oldProject = currentData.portfolio.find(p => p.id === parseInt(id));
            if (oldProject && !oldProject.sr && !oldProject.en && !oldProject.ru) {
                // Old format - migrate
                project.sr = {
                    title: oldProject.title || project.sr.title,
                    category: oldProject.category || project.sr.category,
                    description: oldProject.description || project.sr.description
                };
                project.en = {
                    title: project.en.title || oldProject.title,
                    category: project.en.category || oldProject.category,
                    description: project.en.description || oldProject.description
                };
                project.ru = {
                    title: project.ru.title || oldProject.title,
                    category: project.ru.category || oldProject.category,
                    description: project.ru.description || oldProject.description
                };
                project.gallery = oldProject.gallery || [];
            } else if (oldProject) {
                project.gallery = oldProject.gallery || [];
            }
        }
        
        if (id) {
            const index = currentData.portfolio.findIndex(p => p.id === parseInt(id));
            if (index !== -1) {
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
