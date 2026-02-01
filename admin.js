// ===== GitHub API Configuration =====
let githubConfig = {
    token: null,
    owner: null,
    repo: null
};

const GITHUB_API_BASE = 'https://api.github.com';
const DATA_FILE_PATH = 'data/content.json';
const USERS_FILE_PATH = 'data/users.json';
let DEFAULT_BRANCH = 'main'; // Will be detected from repo
let currentUsers = [];
let currentUsersSha = null;

// Detect default branch from repository
async function detectDefaultBranch() {
    try {
        // First verify token by checking user info
        const userInfo = await githubRequest('/user');
        console.log('Token verified for user:', userInfo.login);
        
        // Then get repo info
        const repoInfo = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}`);
        if (repoInfo && repoInfo.default_branch) {
            DEFAULT_BRANCH = repoInfo.default_branch;
            console.log('Detected default branch:', DEFAULT_BRANCH);
            return DEFAULT_BRANCH;
        }
    } catch (error) {
        console.error('Error detecting default branch:', error);
        // Re-throw to show proper error message
        throw error;
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
                    errorMessage = 'Neautorizovan pristup. Proverite:\n' +
                        '1. Da li je token ispravno kopiran (bez razmaka)\n' +
                        '2. Da li token ima "repo" dozvolu\n' +
                        '3. Da li je token istekao (proverite na GitHub Settings)\n' +
                        '4. Da li je token obrisan\n' +
                        '5. Pokušajte da kreirate novi token';
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
            
            // Wait a bit for GitHub to process any pending commits
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Get fresh SHA and retry (with multiple attempts if needed)
            let retryAttempts = 3;
            let lastError = null;
            
            for (let attempt = 1; attempt <= retryAttempts; attempt++) {
                try {
                    console.log(`Retry attempt ${attempt}/${retryAttempts}...`);
                    
                    // Get fresh file info
                    const freshFileInfo = await getFileContent(path);
                    if (!freshFileInfo || !freshFileInfo.sha) {
                        throw new Error('Ne mogu da dobavim najnoviji SHA fajla.');
                    }
                    
                    const freshSha = freshFileInfo.sha;
                    
                    // Check if SHA is different from original
                    if (sha && freshSha === sha) {
                        console.log('SHA is still the same, waiting a bit more...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                    
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
                } catch (retryError) {
                    console.error(`Retry attempt ${attempt} failed:`, retryError);
                    lastError = retryError;
                    
                    // If it's still a 409, wait and try again
                    if (retryError.message && (retryError.message.includes('409') || retryError.message.includes('does not match'))) {
                        if (attempt < retryAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            continue;
                        }
                    }
                }
            }
            
            // All retry attempts failed
            console.error('All retry attempts failed');
            throw new Error('Fajl je promenjen na serveru. Osvežite stranicu i pokušajte ponovo.');
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

// ===== Image Upload Functions =====
async function uploadImage(file, folder = 'assets/images') {
    showLoading(true);
    try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileExtension = file.name.split('.').pop();
        const fileName = `${timestamp}-${randomStr}.${fileExtension}`;
        const filePath = `${folder}/${fileName}`;
        
        // Convert file to base64
        const base64 = await fileToBase64(file);
        
        // Upload to GitHub
        const pathParts = filePath.split('/');
        const encodedPath = pathParts.map(part => encodeURIComponent(part)).join('/');
        
        const body = {
            message: `Upload image: ${fileName}`,
            content: base64,
            branch: DEFAULT_BRANCH
        };
        
        const response = await githubRequest(`/repos/${githubConfig.owner}/${githubConfig.repo}/contents/${encodedPath}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        
        // Generate URL for the uploaded image
        // For GitHub Pages, use raw.githubusercontent.com or the Pages URL
        const imageUrl = `https://raw.githubusercontent.com/${githubConfig.owner}/${githubConfig.repo}/${DEFAULT_BRANCH}/${filePath}`;
        // Alternative: use GitHub Pages URL if available
        // const imageUrl = `https://${githubConfig.owner}.github.io/${githubConfig.repo}/${filePath}`;
        
        console.log('Image uploaded successfully:', imageUrl);
        return imageUrl;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw new Error('Greška pri upload-u slike: ' + (error.message || 'Nepoznata greška'));
    } finally {
        showLoading(false);
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Remove data:image/...;base64, prefix
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
let currentData = null;
let currentSha = null;

async function loadData() {
    showLoading(true);
    try {
        const result = await getFileContent(DATA_FILE_PATH);
        if (result && result.content) {
            currentData = result.content;
            currentSha = result.sha;
            console.log('Data loaded successfully, populating forms...');
            // Wait a bit to ensure DOM is ready, then populate multiple times to ensure it works
            setTimeout(() => {
                populateForms();
            }, 150);
            
            // Additional populate after longer delay to ensure everything is ready
            setTimeout(() => {
                const aboutTab = document.getElementById('tab-about');
                if (aboutTab && aboutTab.classList.contains('active')) {
                    populateForms();
                }
            }, 400);
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
                setTimeout(() => {
                    populateForms();
                }, 100);
                showNotification('Kreiran novi fajl sa podacima', 'success');
            } catch (createError) {
                console.error('Error creating file:', createError);
                // Still populate with initial data so user can work
                setTimeout(() => {
                    populateForms();
                }, 100);
                showNotification('Kreiran lokalni fajl. Pokušajte ponovo da sačuvate.', 'error');
            }
        }
    } catch (error) {
        console.error('Load data error:', error);
        showNotification('Greška pri učitavanju podataka: ' + error.message, 'error');
        // Try to use initial data as fallback
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
        
        // Reload to get new SHA for next update (with retries)
        let reloadAttempts = 3;
        for (let attempt = 1; attempt <= reloadAttempts; attempt++) {
            try {
                const result = await getFileContent(DATA_FILE_PATH);
                if (result && result.sha) {
                    currentSha = result.sha;
                    console.log('Updated SHA after save:', currentSha.substring(0, 7) + '...');
                    break;
                }
            } catch (reloadError) {
                console.warn(`Reload attempt ${attempt}/${reloadAttempts} failed:`, reloadError);
                if (attempt < reloadAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }
        
        showNotification('Podaci uspešno sačuvani', 'success');
        
        // Refresh lists to show updated data
        renderServices();
        renderPortfolio();
    } catch (error) {
        console.error('Save data error:', error);
        const errorMsg = error.message || 'Nepoznata greška';
        
        // Handle specific error cases
        if (errorMsg.includes('409') || errorMsg.includes('does not match') || errorMsg.includes('Conflict') || errorMsg.includes('promenjen na serveru')) {
            showNotification('Fajl je promenjen na serveru. Osvežite stranicu i pokušajte ponovo.', 'error');
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
        hero: {
            sr: {
                headline: "Arhitektura koja oživljava prostor",
                subtitle: "Kreiramo funkcionalne i estetski izuzetne prostore koji odražavaju vašu viziju i potrebe",
                ctaContact: "Kontaktirajte nas",
                ctaPortfolio: "Portfolio"
            },
            en: {
                headline: "",
                subtitle: "",
                ctaContact: "",
                ctaPortfolio: ""
            },
            ru: {
                headline: "",
                subtitle: "",
                ctaContact: "",
                ctaPortfolio: ""
            },
            backgroundImage: ""
        },
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
    if (!currentData) {
        console.warn('populateForms: currentData is null');
        return;
    }

    // Ensure DOM is ready
    const titleSrEl = document.getElementById('about-title-sr');
    if (!titleSrEl) {
        console.warn('populateForms: DOM elements not ready yet, retrying...');
        setTimeout(() => populateForms(), 200);
        return;
    }

    // Ensure first language tab (sr) is visible
    const aboutForm = document.getElementById('about-form');
    if (aboutForm) {
        const firstLangContent = aboutForm.querySelector('.lang-content[data-lang="sr"]');
        if (firstLangContent) {
            firstLangContent.style.display = 'block';
            firstLangContent.classList.add('active');
        }
        // Ensure first tab button is active
        const firstLangBtn = aboutForm.querySelector('.lang-tab-btn[data-lang="sr"]');
        if (firstLangBtn) {
            aboutForm.querySelectorAll('.lang-tab-btn').forEach(btn => btn.classList.remove('active'));
            firstLangBtn.classList.add('active');
        }
    }

    console.log('Populating forms with data:', currentData);

    // Hero form
    if (currentData.hero) {
        const hero = currentData.hero;
        const heroSr = hero.sr || {};
        const heroEn = hero.en || {};
        const heroRu = hero.ru || {};
        
        const headlineSrEl = document.getElementById('hero-headline-sr');
        const subtitleSrEl = document.getElementById('hero-subtitle-sr');
        const ctaContactSrEl = document.getElementById('hero-cta-contact-sr');
        const ctaPortfolioSrEl = document.getElementById('hero-cta-portfolio-sr');
        const headlineEnEl = document.getElementById('hero-headline-en');
        const subtitleEnEl = document.getElementById('hero-subtitle-en');
        const ctaContactEnEl = document.getElementById('hero-cta-contact-en');
        const ctaPortfolioEnEl = document.getElementById('hero-cta-portfolio-en');
        const headlineRuEl = document.getElementById('hero-headline-ru');
        const subtitleRuEl = document.getElementById('hero-subtitle-ru');
        const ctaContactRuEl = document.getElementById('hero-cta-contact-ru');
        const ctaPortfolioRuEl = document.getElementById('hero-cta-portfolio-ru');
        const backgroundImageEl = document.getElementById('hero-background-image');
        
        if (headlineSrEl) headlineSrEl.value = heroSr.headline || '';
        if (subtitleSrEl) subtitleSrEl.value = heroSr.subtitle || '';
        if (ctaContactSrEl) ctaContactSrEl.value = heroSr.ctaContact || '';
        if (ctaPortfolioSrEl) ctaPortfolioSrEl.value = heroSr.ctaPortfolio || '';
        if (headlineEnEl) headlineEnEl.value = heroEn.headline || '';
        if (subtitleEnEl) subtitleEnEl.value = heroEn.subtitle || '';
        if (ctaContactEnEl) ctaContactEnEl.value = heroEn.ctaContact || '';
        if (ctaPortfolioEnEl) ctaPortfolioEnEl.value = heroEn.ctaPortfolio || '';
        if (headlineRuEl) headlineRuEl.value = heroRu.headline || '';
        if (subtitleRuEl) subtitleRuEl.value = heroRu.subtitle || '';
        if (ctaContactRuEl) ctaContactRuEl.value = heroRu.ctaContact || '';
        if (ctaPortfolioRuEl) ctaPortfolioRuEl.value = heroRu.ctaPortfolio || '';
        if (backgroundImageEl) backgroundImageEl.value = hero.backgroundImage || '';
    }

    // About form - support both old and new format
    if (currentData.about) {
        console.log('Loading about data:', currentData.about);
        
        // Check if new multilingual format
        if (currentData.about.sr || currentData.about.en || currentData.about.ru) {
            // New format - load all languages immediately
            const aboutSr = currentData.about.sr || {};
            const aboutEn = currentData.about.en || {};
            const aboutRu = currentData.about.ru || {};
            
            console.log('Loading multilingual format:', { sr: aboutSr, en: aboutEn, ru: aboutRu });
            
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
            // Old format - migrate on display
            console.log('Loading old format, migrating...');
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
        
        // Always load stats (they are language-independent)
        const stats = currentData.about.stats || {};
        console.log('Loading stats:', stats);
        
        const expEl = document.getElementById('about-experience');
        const projEl = document.getElementById('about-projects');
        const clientsEl = document.getElementById('about-clients');
        
        if (expEl) {
            expEl.value = stats.experience || '';
            console.log('Set experience to:', stats.experience);
        } else {
            console.error('about-experience element not found!');
        }
        if (projEl) {
            projEl.value = stats.projects || '';
            console.log('Set projects to:', stats.projects);
        } else {
            console.error('about-projects element not found!');
        }
        if (clientsEl) {
            clientsEl.value = stats.clients || '';
            console.log('Set clients to:', stats.clients);
        } else {
            console.error('about-clients element not found!');
        }
    } else {
        console.warn('No about data found in currentData');
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
    
    // Users list
    renderUsers();
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
    
    // Open modal first, then ensure tabs are reset
    openModal('service-modal');
    
    // Small delay to ensure DOM is ready, then ensure first tab is visible
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
    
    // Open modal first, then ensure tabs are reset
    openModal('service-modal');
    
    // Small delay to ensure DOM is ready, then ensure first tab is visible
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
    
    // Open modal first, then ensure tabs are reset
    openModal('portfolio-modal');
    
    // Small delay to ensure DOM is ready, then ensure first tab is visible
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
}

// ===== Modal Functions =====
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.style.display = 'flex';
    
    // Reset language tabs to first tab (sr) when opening modal
    const form = modal.querySelector('.admin-form');
    if (form) {
        // Find first language tab button (sr)
        const firstLangBtn = form.querySelector('.lang-tab-btn[data-lang="sr"]');
        if (firstLangBtn) {
            // Remove active from all buttons
            form.querySelectorAll('.lang-tab-btn').forEach(b => b.classList.remove('active'));
            // Add active to first button
            firstLangBtn.classList.add('active');
            
            // Hide all language content
            form.querySelectorAll('.lang-content').forEach(content => {
                content.style.display = 'none';
                content.classList.remove('active');
            });
            
            // Show first language content (sr)
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

// ===== User Management =====
// Hash password using SHA-256
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function loadUsers() {
    // Check if githubConfig is set
    if (!githubConfig || !githubConfig.token) {
        console.warn('Cannot load users: githubConfig not set');
        return;
    }
    
    showLoading(true);
    try {
        const result = await getFileContent(USERS_FILE_PATH);
        if (result && result.content) {
            currentUsers = result.content;
            currentUsersSha = result.sha;
            renderUsers();
        } else {
            // File doesn't exist, create it
            currentUsers = [];
            try {
                await createFile(USERS_FILE_PATH, [], 'Initial users file');
                const newResult = await getFileContent(USERS_FILE_PATH);
                if (newResult) {
                    currentUsersSha = newResult.sha;
                }
                renderUsers();
            } catch (createError) {
                console.error('Error creating users file:', createError);
                currentUsers = [];
                renderUsers();
            }
        }
    } catch (error) {
        console.error('Load users error:', error);
        currentUsers = [];
        renderUsers();
    } finally {
        showLoading(false);
    }
}

async function saveUsers(commitMessage = 'Update users') {
    showLoading(true);
    try {
        let fileInfo = null;
        let fileExists = false;
        
        try {
            fileInfo = await getFileContent(USERS_FILE_PATH);
            if (fileInfo && fileInfo.sha) {
                fileExists = true;
                currentUsersSha = fileInfo.sha;
            }
        } catch (getError) {
            fileExists = false;
            currentUsersSha = null;
        }
        
        if (fileExists && currentUsersSha) {
            await updateFile(USERS_FILE_PATH, currentUsers, currentUsersSha, commitMessage);
        } else {
            await updateFile(USERS_FILE_PATH, currentUsers, null, commitMessage);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const result = await getFileContent(USERS_FILE_PATH);
        if (result && result.sha) {
            currentUsersSha = result.sha;
        }
        
        showNotification('Korisnici uspešno sačuvani', 'success');
        renderUsers();
    } catch (error) {
        console.error('Save users error:', error);
        showNotification('Greška pri čuvanju korisnika: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function renderUsers() {
    const container = document.getElementById('users-list');
    if (!container) return;
    
    container.innerHTML = '';

    if (!currentUsers || currentUsers.length === 0) {
        container.innerHTML = '<p class="empty-state">Nema korisnika. Dodajte prvog korisnika.</p>';
        return;
    }

    currentUsers.forEach((user) => {
        const item = document.createElement('div');
        item.className = 'item-card';
        const hasCustomToken = user.githubToken ? 'Da' : 'Ne (koristi admin token)';
        item.innerHTML = `
            <div class="item-card__content">
                <h3>${user.username}</h3>
                <p>Korisničko ime: <strong>${user.username}</strong></p>
                <p style="font-size: 0.9rem; color: #666;">GitHub Token: ${hasCustomToken}</p>
            </div>
            <div class="item-card__actions">
                <button class="btn btn-small btn-secondary" onclick="editUser('${user.username}')">Izmeni</button>
                <button class="btn btn-small btn-danger" onclick="deleteUser('${user.username}')">Obriši</button>
            </div>
        `;
        container.appendChild(item);
    });
}

async function editUser(username) {
    const user = currentUsers.find(u => u.username === username);
    if (!user) return;

    document.getElementById('user-id').value = username;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-password').value = ''; // Don't show password
    document.getElementById('user-password').required = false; // Password not required when editing
    document.getElementById('user-password').placeholder = 'Ostavite prazno da zadržite postojeću lozinku';
    document.getElementById('password-hint').textContent = 'Ostavite prazno da zadržite postojeću lozinku ili unesite novu lozinku';
    document.getElementById('user-github-token').value = user.githubToken || '';
    document.getElementById('user-repo-owner').value = user.repoOwner || '';
    document.getElementById('user-repo-name').value = user.repoName || '';
    document.getElementById('user-modal-title').textContent = 'Izmeni korisnika';
    
    // Store original password hash for reference
    const passwordInput = document.getElementById('user-password');
    passwordInput.dataset.originalHash = user.passwordHash;
    
    // Reset password visibility
    passwordInput.type = 'password';
    const toggleBtn = document.getElementById('toggle-password');
    if (toggleBtn) {
        toggleBtn.textContent = '👁️';
        toggleBtn.title = 'Prikaži lozinku';
    }
    
    openModal('user-modal');
}

async function deleteUser(username) {
    if (!confirm('Da li ste sigurni da želite da obrišete ovog korisnika?')) return;

    currentUsers = currentUsers.filter(u => u.username !== username);
    await saveUsers('Delete user');
}

async function addUser() {
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
    document.getElementById('user-password').required = true;
    document.getElementById('user-password').placeholder = '';
    document.getElementById('user-password').removeAttribute('data-original-hash');
    document.getElementById('password-hint').textContent = 'Lozinka će biti sačuvana u hash formatu';
    document.getElementById('user-modal-title').textContent = 'Dodaj korisnika';
    
    // Reset password visibility
    const passwordInput = document.getElementById('user-password');
    passwordInput.type = 'password';
    const toggleBtn = document.getElementById('toggle-password');
    if (toggleBtn) {
        toggleBtn.textContent = '👁️';
        toggleBtn.title = 'Prikaži lozinku';
    }
    
    openModal('user-modal');
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('user-password');
    const toggleBtn = document.getElementById('toggle-password');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.textContent = '🙈';
        toggleBtn.title = 'Sakrij lozinku';
    } else {
        passwordInput.type = 'password';
        toggleBtn.textContent = '👁️';
        toggleBtn.title = 'Prikaži lozinku';
    }
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
            
            loadData().then(() => {
                // After data is loaded, ensure "about" tab is populated if it's active
                // Multiple attempts with increasing delays to ensure it works
                setTimeout(() => {
                    const aboutTab = document.getElementById('tab-about');
                    if (aboutTab && aboutTab.classList.contains('active') && currentData) {
                        populateForms();
                    }
                }, 300);
                
                setTimeout(() => {
                    const aboutTab = document.getElementById('tab-about');
                    if (aboutTab && aboutTab.classList.contains('active') && currentData) {
                        populateForms();
                    }
                }, 600);
            });
            
            // Load users (only if githubConfig is set)
            if (githubConfig && githubConfig.token) {
                loadUsers();
            }
        } catch (error) {
            console.error('Error loading saved config:', error);
            localStorage.removeItem('githubConfig');
        }
    }

    // Login form
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        const tokenValue = formData.get('token').trim();
        const ownerValue = formData.get('owner').trim();
        const repoValue = formData.get('repo').trim();

        // Validate token format
        if (!tokenValue.startsWith('ghp_') && !tokenValue.startsWith('github_pat_')) {
            showError('Token mora počinjati sa "ghp_" ili "github_pat_".\n\nProverite da li ste pravilno kopirali token sa GitHub stranice.');
            return;
        }

        githubConfig = {
            token: tokenValue,
            owner: ownerValue,
            repo: repoValue
        };

        // Test connection
        showLoading(true);
        try {
            // First verify token by checking user info
            const userInfo = await githubRequest('/user');
            console.log('Token verified for user:', userInfo.login);
            
            // Then test repo access
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
            console.error('Login error:', error);
            let errorMessage = error.message || 'Greška pri povezivanju';
            
            // Provide more specific guidance
            if (errorMessage.includes('401') || errorMessage.includes('Neautorizovan')) {
                errorMessage = 'Neautorizovan pristup. Proverite:\n\n' +
                    '1. ✅ Da li je token ispravno kopiran (bez razmaka na početku/kraju)\n' +
                    '2. ✅ Da li token ima "repo" dozvolu (proverite na GitHub Settings > Tokens)\n' +
                    '3. ✅ Da li je token istekao (proverite datum isteka na GitHub)\n' +
                    '4. ✅ Da li je token obrisan\n\n' +
                    'Ako ste kreirali token malopre, proverite da li ste:\n' +
                    '• Označili "repo" dozvolu pri kreiranju\n' +
                    '• Kopirali ceo token (počinje sa ghp_ ili github_pat_)\n' +
                    '• Niste dodali razmake prilikom kopiranja\n\n' +
                    'Kreirajte novi token: https://github.com/settings/tokens';
            } else if (errorMessage.includes('404')) {
                errorMessage = 'Repozitorijum nije pronađen.\n\n' +
                    'Proverite da li su:\n' +
                    '• Repo Owner: ispravan GitHub username\n' +
                    '• Repo Name: ispravan naziv repozitorijuma\n' +
                    '• Repozitorijum postoji i imate pristup';
            } else if (errorMessage.includes('403')) {
                errorMessage = 'Zabranjen pristup.\n\n' +
                    'Token nema dovoljno dozvola. Proverite da li token ima "repo" dozvolu.\n' +
                    'Kreirajte novi token sa "repo" dozvolom: https://github.com/settings/tokens';
            }
            
            showError(errorMessage);
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
            const activeTab = document.getElementById(`tab-${tabName}`);
            if (activeTab) {
                activeTab.classList.add('active');
                
                // If switching to "about" tab, ensure data is populated
                if (tabName === 'about' && currentData) {
                    setTimeout(() => {
                        populateForms();
                    }, 50);
                }
                
                // If "about" tab is already active on page load, populate immediately
                if (tabName === 'about' && activeTab.classList.contains('active') && currentData) {
                    setTimeout(() => {
                        populateForms();
                    }, 100);
                }
            }
        });
    });

    // Language tabs navigation (for all forms with language tabs)
    document.querySelectorAll('.lang-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            const form = btn.closest('.admin-form');
            
            if (!form) return;
            
            // Update active button
            form.querySelectorAll('.lang-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show correct language content
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
    const addUserBtn = document.getElementById('add-user-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', addUser);
    }

    // User form
    const userForm = document.getElementById('user-form');
    if (userForm) {
        userForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const username = formData.get('username');
            const password = formData.get('password');
            const githubToken = formData.get('github-token');
            const repoOwner = formData.get('repo-owner');
            const repoName = formData.get('repo-name');
            const id = formData.get('id');

            if (!username) {
                showNotification('Molimo unesite korisničko ime', 'error');
                return;
            }

            if (!id && !password) {
                // New user - password is required
                showNotification('Molimo unesite lozinku', 'error');
                return;
            }

            let passwordHash;
            if (id) {
                // Editing existing user
                if (password && password.trim() !== '') {
                    // New password provided
                    passwordHash = await hashPassword(password);
                } else {
                    // Keep existing password - get it from the user data
                    const existingUser = currentUsers.find(u => u.username === id);
                    if (existingUser) {
                        passwordHash = existingUser.passwordHash;
                    } else {
                        showNotification('Korisnik nije pronađen', 'error');
                        return;
                    }
                }
            } else {
                // New user - password is required
                passwordHash = await hashPassword(password);
            }

            const user = {
                username: username,
                passwordHash: passwordHash
            };
            
            // Add GitHub config if provided
            if (githubToken && githubToken.trim() !== '') {
                user.githubToken = githubToken.trim();
            }
            if (repoOwner && repoOwner.trim() !== '') {
                user.repoOwner = repoOwner.trim();
            }
            if (repoName && repoName.trim() !== '') {
                user.repoName = repoName.trim();
            }

            if (id) {
                // Update existing user
                const index = currentUsers.findIndex(u => u.username === id);
                if (index !== -1) {
                    currentUsers[index] = user;
                }
            } else {
                // Check if username already exists
                if (currentUsers.find(u => u.username === username)) {
                    showNotification('Korisnik sa ovim korisničkim imenom već postoji', 'error');
                    return;
                }
                currentUsers.push(user);
            }

            closeModal('user-modal');
            await saveUsers(id ? 'Update user' : 'Add user');
        });
    }

    // Image upload handlers
    const portfolioImageUpload = document.getElementById('portfolio-image-upload');
    if (portfolioImageUpload) {
        portfolioImageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showNotification('Molimo izaberite sliku (JPG, PNG, GIF, itd.)', 'error');
                return;
            }
            
            // Validate file size (max 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Slika je prevelika. Maksimalna veličina je 5MB.', 'error');
                return;
            }
            
            const statusEl = document.getElementById('portfolio-image-upload-status');
            const previewEl = document.getElementById('portfolio-image-preview');
            const previewImgEl = document.getElementById('portfolio-image-preview-img');
            const inputEl = document.getElementById('portfolio-image');
            
            try {
                statusEl.textContent = 'Upload-ujem sliku...';
                statusEl.className = 'upload-status uploading';
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImgEl.src = e.target.result;
                    previewEl.style.display = 'block';
                };
                reader.readAsDataURL(file);
                
                // Upload to GitHub
                const imageUrl = await uploadImage(file);
                
                // Update input field
                inputEl.value = imageUrl;
                statusEl.textContent = 'Slika uspešno upload-ovana!';
                statusEl.className = 'upload-status success';
                
                showNotification('Slika je uspešno upload-ovana', 'success');
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
window.deleteService = deleteService;
window.editPortfolio = editPortfolio;
window.deletePortfolio = deletePortfolio;
window.removeImagePreview = removeImagePreview;
