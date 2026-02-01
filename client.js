// ===== GitHub API Configuration =====
// Clients use the same GitHub token as admin (from localStorage)
let githubConfig = {
    token: null,
    owner: null,
    repo: null
};

const GITHUB_API_BASE = 'https://api.github.com';
const DATA_FILE_PATH = 'data/content.json';
const USERS_FILE_PATH = 'data/users.json';
let DEFAULT_BRANCH = 'main';

// ===== Client Authentication =====
let currentUser = null;
let currentData = null;
let currentSha = null;

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
        const response = await fetch(`https://raw.githubusercontent.com/StalniKorisnik89/arhitekta/main/${USERS_FILE_PATH}?v=${Date.now()}`);
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

function showNotification(message, type = 'success') {
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.className = `notification notification-${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function showError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
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
        const pathParts = path.split('/');
        const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
        
        const response = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}?ref=${DEFAULT_BRANCH}`);
        
        if (response && response.content) {
            const base64Content = response.content.replace(/\s/g, '');
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
        if (error.message && (error.message.includes('404') || error.message.includes('nije pronađen'))) {
            return null;
        }
        throw error;
    }
}

async function updateFile(path, content, sha, message = 'Update content') {
    const contentString = JSON.stringify(content, null, 2);
    
    function utf8ToBase64(str) {
        const encoder = new TextEncoder();
        const utf8Bytes = encoder.encode(str);
        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
            const chunk = utf8Bytes.slice(i, Math.min(i + chunkSize, utf8Bytes.length));
            const chunkArray = Array.from(chunk);
            binaryString += String.fromCharCode.apply(null, chunkArray);
        }
        return btoa(binaryString);
    }
    const contentBase64 = utf8ToBase64(contentString);
    
    const pathParts = path.split('/');
    const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
    
    const body = {
        message: message,
        content: contentBase64,
        branch: DEFAULT_BRANCH
    };
    
    if (sha) {
        body.sha = sha;
    }

    try {
        const response = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        return true;
    } catch (error) {
        if (error.message && (error.message.includes('409') || error.message.includes('does not match') || error.message.includes('Conflict'))) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            let retryAttempts = 3;
            for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                try {
                    const freshFileInfo = await getFileContent(path);
                    if (!freshFileInfo || !freshFileInfo.sha) {
                        throw new Error('Ne mogu da dobavim najnoviji SHA fajla.');
                    }
                    
                    const freshSha = freshFileInfo.sha;
                    if (sha && freshSha === sha) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    
                    const retryBody = {
                        message: message,
                        content: contentBase64,
                        branch: DEFAULT_BRANCH,
                        sha: freshSha
                    };
                    
                    await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`, {
                        method: 'PUT',
                        body: JSON.stringify(retryBody)
                    });
                    return true;
                } catch (retryError) {
                    if (attempt < retryAttempts && retryError.message && (retryError.message.includes('409') || retryError.message.includes('does not match'))) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        continue;
                    }
                    throw retryError;
                }
            }
            throw new Error('Fajl je promenjen na serveru. Osvežite stranicu i pokušajte ponovo.');
        }
        throw error;
    }
}

async function createFile(path, content, message = 'Create file') {
    return await updateFile(path, content, null, message);
}

// ===== Image Upload Functions =====
async function uploadImage(file, folder = 'assets/images') {
    showLoading(true);
    try {
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileExtension = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomStr}.${fileExtension}`;
        const filePath = `${folder}/${fileName}`;
        
        const base64 = await fileToBase64(file);
        const pathParts = filePath.split('/');
        const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
        
        const body = {
            message: `Upload image: ${fileName}`,
            content: base64,
            branch: DEFAULT_BRANCH
        };
        
        await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        
        const imageUrl = `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/${DEFAULT_BRANCH}/${filePath}`;
        return imageUrl;
    } catch (error) {
        throw new Error('Greška pri upload-u slike: ' + (error.message || 'Nepoznata greška'));
    } finally {
        showLoading(false);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function removeImagePreview(type) {
    const preview = document.getElementById(`${type}-image-preview`);
    const previewImg = document.getElementById(`${type}-image-preview-img`);
    const input = document.getElementById(`${type}-image`);
    const uploadInput = document.getElementById(`${type}-image-upload`);
    const status = document.getElementById(`${type}-image-upload-status`);
    
    if (preview) preview.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (input) input.value = '';
    if (uploadInput) uploadInput.value = '';
    if (status) {
        status.textContent = '';
        status.className = 'upload-status';
    }
}

// ===== Data Management =====
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

async function loadData() {
    showLoading(true);
    try {
        const result = await getFileContent(DATA_FILE_PATH);
        if (result && result.content) {
            currentData = result.content;
            currentSha = result.sha;
            setTimeout(() => {
                populateForms();
            }, 150);
            setTimeout(() => {
                const aboutTab = document.getElementById('tab-about');
                if (aboutTab && aboutTab.classList.contains('active')) {
                    populateForms();
                }
            }, 400);
            showNotification('Podaci uspešno učitani', 'success');
        } else {
            currentData = getInitialData();
            try {
                await createFile(DATA_FILE_PATH, currentData, 'Initial content file');
                const newResult = await getFileContent(DATA_FILE_PATH);
                if (newResult) {
                    currentSha = newResult.sha;
                }
                setTimeout(() => {
                    populateForms();
                }, 100);
                showNotification('Kreiran novi fajl sa podacima', 'success');
            } catch (createError) {
                console.error('Error creating file:', createError);
                setTimeout(() => {
                    populateForms();
                }, 100);
                showNotification('Kreiran lokalni fajl. Pokušajte ponovo da sačuvate.', 'error');
            }
        }
    } catch (error) {
        console.error('Load data error:', error);
        showNotification('Greška pri učitavanju podataka: ' + error.message, 'error');
        currentData = getInitialData();
        setTimeout(() => {
            populateForms();
        }, 100);
    } finally {
        showLoading(false);
    }
}

async function saveData(commitMessage = 'Update content') {
    showLoading(true);
    try {
        let fileInfo = null;
        let fileExists = false;
        
        try {
            fileInfo = await getFileContent(DATA_FILE_PATH);
            if (fileInfo && fileInfo.sha) {
                fileExists = true;
                currentSha = fileInfo.sha;
            }
        } catch (getError) {
            fileExists = false;
            currentSha = null;
        }
        
        if (fileExists && currentSha) {
            await updateFile(DATA_FILE_PATH, currentData, currentSha, commitMessage);
        } else {
            await updateFile(DATA_FILE_PATH, currentData, null, commitMessage);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let reloadAttempts = 3;
        for (let attempt = 1; attempt <= reloadAttempts; attempt++) {
            try {
                const result = await getFileContent(DATA_FILE_PATH);
                if (result && result.sha) {
                    currentSha = result.sha;
                    break;
                }
            } catch (reloadError) {
                if (attempt < reloadAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        showNotification('Podaci uspešno sačuvani', 'success');
        renderServices();
        renderPortfolio();
    } catch (error) {
        console.error('Save data error:', error);
        const errorMsg = error.message || 'Nepoznata greška';
        
        if (errorMsg.includes('409') || errorMsg.includes('does not match') || errorMsg.includes('Conflict') || errorMsg.includes('promenjen na serveru')) {
            showNotification('Fajl je promenjen na serveru. Osvežite stranicu i pokušajte ponovo.', 'error');
        } else if (errorMsg.includes('404') || errorMsg.includes('nije pronađen')) {
            showNotification('Fajl nije pronađen. Pokušavam da kreiram novi fajl...', 'error');
            try {
                await updateFile(DATA_FILE_PATH, currentData, null, commitMessage);
                showNotification('Fajl uspešno kreiran!', 'success');
                const result = await getFileContent(DATA_FILE_PATH);
                if (result && result.sha) {
                    currentSha = result.sha;
                }
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

// ===== Form Population =====
function populateForms() {
    if (!currentData) {
        console.warn('populateForms: currentData is null');
        return;
    }

    const titleSrEl = document.getElementById('about-title-sr');
    if (!titleSrEl) {
        setTimeout(() => populateForms(), 200);
        return;
    }

    const aboutForm = document.getElementById('about-form');
    if (aboutForm) {
        const firstLangContent = aboutForm.querySelector('.lang-content[data-lang="sr"]');
        if (firstLangContent) {
            firstLangContent.style.display = 'block';
            firstLangContent.classList.add('active');
        }
        const firstLangBtn = aboutForm.querySelector('.lang-tab-btn[data-lang="sr"]');
        if (firstLangBtn) {
            aboutForm.querySelectorAll('.lang-tab-btn').forEach(btn => btn.classList.remove('active'));
            firstLangBtn.classList.add('active');
        }
    }

    if (currentData.about) {
        if (currentData.about.sr || currentData.about.en || currentData.about.ru) {
            const aboutSr = currentData.about.sr || {};
            const aboutEn = currentData.about.en || {};
            const aboutRu = currentData.about.ru || {};
            
            const titleSrEl = document.getElementById('about-title-sr');
            const subtitleSrEl = document.getElementById('about-subtitle-sr');
            const descSrEl = document.getElementById('about-description-sr');
            const titleEnEl = document.getElementById('about-title-en');
            const subtitleEnEl = document.getElementById('about-subtitle-en');
            const descEnEl = document.getElementById('about-description-en');
            const titleRuEl = document.getElementById('about-title-ru');
            const subtitleRuEl = document.getElementById('about-subtitle-ru');
            const descRuEl = document.getElementById('about-description-ru');
            
            if (titleSrEl) titleSrEl.value = aboutSr.title || '';
            if (subtitleSrEl) subtitleSrEl.value = aboutSr.subtitle || '';
            if (descSrEl) descSrEl.value = aboutSr.description || '';
            if (titleEnEl) titleEnEl.value = aboutEn.title || '';
            if (subtitleEnEl) subtitleEnEl.value = aboutEn.subtitle || '';
            if (descEnEl) descEnEl.value = aboutEn.description || '';
            if (titleRuEl) titleRuEl.value = aboutRu.title || '';
            if (subtitleRuEl) subtitleRuEl.value = aboutRu.subtitle || '';
            if (descRuEl) descRuEl.value = aboutRu.description || '';
        } else {
            const titleSrEl = document.getElementById('about-title-sr');
            const subtitleSrEl = document.getElementById('about-subtitle-sr');
            const descSrEl = document.getElementById('about-description-sr');
            const titleEnEl = document.getElementById('about-title-en');
            const subtitleEnEl = document.getElementById('about-subtitle-en');
            const descEnEl = document.getElementById('about-description-en');
            const titleRuEl = document.getElementById('about-title-ru');
            const subtitleRuEl = document.getElementById('about-subtitle-ru');
            const descRuEl = document.getElementById('about-description-ru');
            
            if (titleSrEl) titleSrEl.value = currentData.about.title || '';
            if (subtitleSrEl) subtitleSrEl.value = currentData.about.subtitle || '';
            if (descSrEl) descSrEl.value = currentData.about.description || '';
            if (titleEnEl) titleEnEl.value = '';
            if (subtitleEnEl) subtitleEnEl.value = '';
            if (descEnEl) descEnEl.value = '';
            if (titleRuEl) titleRuEl.value = '';
            if (subtitleRuEl) subtitleRuEl.value = '';
            if (descRuEl) descRuEl.value = '';
        }
        
        const stats = currentData.about.stats || {};
        const expEl = document.getElementById('about-experience');
        const projEl = document.getElementById('about-projects');
        const clientsEl = document.getElementById('about-clients');
        
        if (expEl) expEl.value = stats.experience || '';
        if (projEl) projEl.value = stats.projects || '';
        if (clientsEl) clientsEl.value = stats.clients || '';
    }

    if (currentData.contact) {
        document.getElementById('contact-phone').value = currentData.contact.phone || '';
        document.getElementById('contact-email').value = currentData.contact.email || '';
        document.getElementById('contact-address').value = currentData.contact.address || '';
    }

    renderServices();
    renderPortfolio();
}

// ===== Services Management =====
function renderServices() {
    const container = document.getElementById('services-list');
    if (!container) return;
    
    container.innerHTML = '';

    if (!currentData.services || currentData.services.length === 0) {
        container.innerHTML = '<p class="empty-state">Nema usluga. Dodajte prvu uslugu.</p>';
        return;
    }

    currentData.services.forEach((service) => {
        const item = document.createElement('div');
        item.className = 'item-card';
        const lang = 'sr';
        const serviceData = service[lang] || service.sr || service;
        item.innerHTML = `
            <div class="item-card__content">
                <h3>${serviceData.title || service.title || ''}</h3>
                <p>${serviceData.description || service.description || ''}</p>
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
    
    if (service.sr || service.en || service.ru) {
        document.getElementById('service-title-sr').value = service.sr?.title || '';
        document.getElementById('service-description-sr').value = service.sr?.description || '';
        document.getElementById('service-title-en').value = service.en?.title || '';
        document.getElementById('service-description-en').value = service.en?.description || '';
        document.getElementById('service-title-ru').value = service.ru?.title || '';
        document.getElementById('service-description-ru').value = service.ru?.description || '';
    } else {
        document.getElementById('service-title-sr').value = service.title || '';
        document.getElementById('service-description-sr').value = service.description || '';
        document.getElementById('service-title-en').value = '';
        document.getElementById('service-description-en').value = '';
        document.getElementById('service-title-ru').value = '';
        document.getElementById('service-description-ru').value = '';
    }
    
    document.getElementById('service-modal-title').textContent = 'Izmeni uslugu';
    openModal('service-modal');
    
    setTimeout(() => {
        const form = document.getElementById('service-modal').querySelector('.admin-form');
        if (form) {
            const firstLangContent = form.querySelector('.lang-content[data-lang="sr"]');
            if (firstLangContent) {
                firstLangContent.style.display = 'block';
            }
        }
    }, 50);
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
    
    setTimeout(() => {
        const form = document.getElementById('service-modal').querySelector('.admin-form');
        if (form) {
            const firstLangContent = form.querySelector('.lang-content[data-lang="sr"]');
            if (firstLangContent) {
                firstLangContent.style.display = 'block';
            }
        }
    }, 50);
}

// ===== Portfolio Management =====
function renderPortfolio() {
    const container = document.getElementById('portfolio-list');
    if (!container) return;
    
    container.innerHTML = '';

    if (!currentData.portfolio || currentData.portfolio.length === 0) {
        container.innerHTML = '<p class="empty-state">Nema projekata. Dodajte prvi projekat.</p>';
        return;
    }

    currentData.portfolio.forEach((project) => {
        const item = document.createElement('div');
        item.className = 'item-card';
        const lang = 'sr';
        const projectData = project[lang] || project.sr || project;
        item.innerHTML = `
            <div class="item-card__image">
                <img src="${project.image || ''}" alt="${projectData.title || project.title || ''}" onerror="this.onerror=null; this.style.backgroundColor='#ddd'; this.style.display='flex'; this.style.alignItems='center'; this.style.justifyContent='center'; this.innerHTML='<span style=color:#999;font-size:14px>No Image</span>'">
            </div>
            <div class="item-card__content">
                <h3>${projectData.title || project.title || ''}</h3>
                <p class="item-category">${projectData.category || project.category || ''}</p>
                <p>${projectData.description || project.description || ''}</p>
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
    
    if (project.sr || project.en || project.ru) {
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
    
    setTimeout(() => {
        const form = document.getElementById('portfolio-modal').querySelector('.admin-form');
        if (form) {
            const firstLangContent = form.querySelector('.lang-content[data-lang="sr"]');
            if (firstLangContent) {
                firstLangContent.style.display = 'block';
            }
        }
    }, 50);
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
    
    setTimeout(() => {
        const form = document.getElementById('portfolio-modal').querySelector('.admin-form');
        if (form) {
            const firstLangContent = form.querySelector('.lang-content[data-lang="sr"]');
            if (firstLangContent) {
                firstLangContent.style.display = 'block';
            }
        }
    }, 50);
}

// ===== Modal Functions =====
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    const form = modal.querySelector('.admin-form');
    if (form) {
        const firstLangBtn = form.querySelector('.lang-tab-btn[data-lang="sr"]');
        if (firstLangBtn) {
            form.querySelectorAll('.lang-tab-btn').forEach(b => b.classList.remove('active'));
            firstLangBtn.classList.add('active');
            
            form.querySelectorAll('.lang-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            
            const firstLangContent = form.querySelector('.lang-content[data-lang="sr"]');
            if (firstLangContent) {
                firstLangContent.style.display = 'block';
                firstLangContent.classList.add('active');
            }
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    // Check if already logged in
    const savedUser = localStorage.getItem('clientUser');
    const savedConfig = localStorage.getItem('githubConfig');
    
    if (savedUser && savedConfig) {
        try {
            currentUser = JSON.parse(savedUser);
            githubConfig = JSON.parse(savedConfig);
            
            // Check if githubConfig is valid
            if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
                throw new Error('GitHub config not valid');
            }
            
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('client-dashboard').style.display = 'flex';
            document.getElementById('client-info').textContent = `${currentUser.username} - ${githubConfig.owner}/${githubConfig.repo}`;
            
            detectDefaultBranch().then(() => {
                loadData();
            });
        } catch (error) {
            console.error('Error loading saved user/config:', error);
            localStorage.removeItem('clientUser');
            localStorage.removeItem('githubConfig');
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
                // Check if GitHub config exists (from admin panel)
                const savedConfig = localStorage.getItem('githubConfig');
                if (!savedConfig) {
                    showError('GitHub token nije konfigurisan. Admin mora prvo da se uloguje u admin panel.');
                    return;
                }
                
                try {
                    githubConfig = JSON.parse(savedConfig);
                    if (!githubConfig.token || !githubConfig.owner || !githubConfig.repo) {
                        showError('GitHub token nije validan. Admin mora prvo da se uloguje u admin panel.');
                        return;
                    }
                } catch (configError) {
                    showError('GitHub token nije validan. Admin mora prvo da se uloguje u admin panel.');
                    return;
                }
                
                currentUser = { username: user.username };
                localStorage.setItem('clientUser', JSON.stringify(currentUser));
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('client-dashboard').style.display = 'flex';
                document.getElementById('client-info').textContent = `${user.username} - ${githubConfig.owner}/${githubConfig.repo}`;
                
                await detectDefaultBranch();
                await loadData();
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
            const activeTab = document.getElementById(`tab-${tabName}`);
            if (activeTab) {
                activeTab.classList.add('active');
                
                if (tabName === 'about' && currentData) {
                    setTimeout(() => {
                        populateForms();
                    }, 50);
                }
            }
        });
    });

    // Language tabs navigation
    document.querySelectorAll('.lang-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            const form = btn.closest('.admin-form');
            
            if (!form) return;
            
            form.querySelectorAll('.lang-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            form.querySelectorAll('.lang-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            
            const langContent = form.querySelector(`.lang-content[data-lang="${lang}"]`);
            if (langContent) {
                langContent.style.display = 'block';
                langContent.classList.add('active');
            }
        });
    });

    // About form
    document.getElementById('about-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        if (!currentData.about.sr && !currentData.about.en && !currentData.about.ru) {
            currentData.about = {
                sr: {},
                en: {},
                ru: {},
                stats: currentData.about.stats || {}
            };
        }
        
        currentData.about.sr = {
            title: formData.get('title-sr'),
            subtitle: formData.get('subtitle-sr'),
            description: formData.get('description-sr')
        };
        currentData.about.en = {
            title: formData.get('title-en') || formData.get('title-sr'),
            subtitle: formData.get('subtitle-en') || formData.get('subtitle-sr'),
            description: formData.get('description-en') || formData.get('description-sr')
        };
        currentData.about.ru = {
            title: formData.get('title-ru') || formData.get('title-sr'),
            subtitle: formData.get('subtitle-ru') || formData.get('subtitle-sr'),
            description: formData.get('description-ru') || formData.get('description-sr')
        };
        currentData.about.stats = {
            experience: formData.get('experience'),
            projects: formData.get('projects'),
            clients: formData.get('clients')
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
            image: formData.get('image'),
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
            specs: {
                area: formData.get('area'),
                year: formData.get('year'),
                location: formData.get('location'),
                status: formData.get('status')
            },
            gallery: []
        };
        
        if (id) {
            const oldProject = currentData.portfolio.find(p => p.id === parseInt(id));
            if (oldProject) {
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

    // Image upload handlers
    const portfolioImageUpload = document.getElementById('portfolio-image-upload');
    if (portfolioImageUpload) {
        portfolioImageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!file.type.startsWith('image/')) {
                showNotification('Molimo izaberite sliku (JPG, PNG, GIF, itd.)', 'error');
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Slika je prevelika. Maksimalna veličina je 5MB.', 'error');
                return;
            }
            
            const statusEl = document.getElementById('portfolio-image-upload-status');
            const previewEl = document.getElementById('portfolio-image-preview');
            const previewImgEl = document.getElementById('portfolio-image-preview-img');
            const inputEl = document.getElementById('portfolio-image');
            
            statusEl.textContent = 'Upload-ovanje...';
            statusEl.className = 'upload-status uploading';
            
            try {
                const imageUrl = await uploadImage(file);
                inputEl.value = imageUrl;
                previewImgEl.src = imageUrl;
                previewEl.style.display = 'block';
                statusEl.textContent = 'Upload uspešan!';
                statusEl.className = 'upload-status success';
                showNotification('Slika uspešno upload-ovana', 'success');
            } catch (error) {
                statusEl.textContent = 'Greška pri upload-u';
                statusEl.className = 'upload-status error';
                showNotification(error.message || 'Greška pri upload-u slike', 'error');
                previewEl.style.display = 'none';
            }
        });
    }

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
window.addService = addService;
window.editPortfolio = editPortfolio;
window.addPortfolio = addPortfolio;
window.deleteService = deleteService;
window.deletePortfolio = deletePortfolio;
window.removeImagePreview = removeImagePreview;
