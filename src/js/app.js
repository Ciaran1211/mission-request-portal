// Main Application JavaScript
// Handles form logic, validation, file uploads, and API submission

(function() {
    'use strict';

    // ============================================================
    // COMPANY AND SITE CONFIGURATION
    // ============================================================
    // This configuration maps companies to their sites and site areas
    // The map widget will update based on selected site
    
    const COMPANY_CONFIG = {
        'BMA': {
            name: 'BMA',
            displayName: 'BHP Mitsubishi Alliance',
            sites: {
                'Saraji': {
                    name: 'Saraji',
                    areas: ['6W', '8W', '10W', '12W', 'Saraji East', 'Processing Plant', 'Stockpile Area'],
                    mapConfig: {
                        center: [148.2875, -22.40],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Goonyella': {
                    name: 'Goonyella',
                    areas: ['North Pit', 'South Pit', 'East Pit', 'CHPP', 'Rail Loop'],
                    mapConfig: {
                        center: [148.12, -21.82],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Peak Downs': {
                    name: 'Peak Downs',
                    areas: ['Main Pit', 'Extension', 'Haul Road', 'Processing'],
                    mapConfig: {
                        center: [148.19, -22.26],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                }
            }
        },
        'Goldfields': {
            name: 'Goldfields',
            displayName: 'Goldfields',
            sites: {
                'St Ives': {
                    name: 'St Ives',
                    areas: ['Invincible', 'Hamlet', 'Neptune', 'Athena', 'Processing'],
                    mapConfig: {
                        center: [121.67, -31.22],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Granny Smith': {
                    name: 'Granny Smith',
                    areas: ['Open Pit', 'Underground Portal', 'Processing Plant', 'TSF'],
                    mapConfig: {
                        center: [122.35, -28.98],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Agnew': {
                    name: 'Agnew',
                    areas: ['Kim Pit', 'Waroonga', 'Mill', 'Tailings'],
                    mapConfig: {
                        center: [120.68, -27.98],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                }
            }
        },
        'RioTinto': {
            name: 'RioTinto',
            displayName: 'Rio Tinto',
            sites: {
                'Tom Price': {
                    name: 'Tom Price',
                    areas: ['North Deposit', 'South Deposit', 'Section 7', 'Processing', 'Rail'],
                    mapConfig: {
                        center: [117.79, -22.69],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Paraburdoo': {
                    name: 'Paraburdoo',
                    areas: ['Eastern Range', '4 East', 'Channar', 'Processing'],
                    mapConfig: {
                        center: [117.67, -23.20],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Marandoo': {
                    name: 'Marandoo',
                    areas: ['Main Pit', 'Extension', 'Stockpiles', 'Infrastructure'],
                    mapConfig: {
                        center: [118.13, -22.62],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                }
            }
        },
        'FMG': {
            name: 'FMG',
            displayName: 'Fortescue Metals Group',
            sites: {
                'Christmas Creek': {
                    name: 'Christmas Creek',
                    areas: ['Cloudbreak West', 'Eastern Hub', 'Central', 'Processing', 'Rail'],
                    mapConfig: {
                        center: [119.78, -22.35],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Solomon': {
                    name: 'Solomon',
                    areas: ['Kings Valley', 'Firetail', 'Queens Valley', 'Infrastructure'],
                    mapConfig: {
                        center: [117.14, -22.78],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                },
                'Iron Bridge': {
                    name: 'Iron Bridge',
                    areas: ['North Star', 'Glacier Valley', 'Processing', 'Port'],
                    mapConfig: {
                        center: [119.15, -22.15],
                        defaultZoom: 14,
                        orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
                    }
                }
            }
        }
    };

    // ============================================================
    // STATE
    // ============================================================
    let currentCompany = null;
    let currentSite = null;
    let uploadedFiles = [];
    let isSubmitting = false;

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        // Get company from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const companyKey = urlParams.get('company');
        
        if (!companyKey || !COMPANY_CONFIG[companyKey]) {
            showInvalidCompany();
            return;
        }
        
        currentCompany = COMPANY_CONFIG[companyKey];
        document.getElementById('companyId').value = companyKey;
        document.getElementById('companyBadge').textContent = currentCompany.displayName;
        
        // Populate sites dropdown
        populateSites();
        
        // Setup event listeners
        setupEventListeners();
        setDefaultDate();
    }

    function showInvalidCompany() {
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('invalidCompany').style.display = 'flex';
    }

    function populateSites() {
        const siteSelect = document.getElementById('siteSelection');
        siteSelect.innerHTML = '<option value="">Select a site...</option>';
        
        Object.keys(currentCompany.sites).forEach(siteKey => {
            const site = currentCompany.sites[siteKey];
            const option = document.createElement('option');
            option.value = siteKey;
            option.textContent = site.name;
            siteSelect.appendChild(option);
        });
    }

    function populateSiteAreas(siteKey) {
        const areaSelect = document.getElementById('siteArea');
        areaSelect.innerHTML = '<option value="">Select area...</option>';
        
        if (!siteKey || !currentCompany.sites[siteKey]) {
            areaSelect.innerHTML = '<option value="">Select site first...</option>';
            return;
        }
        
        const site = currentCompany.sites[siteKey];
        site.areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaSelect.appendChild(option);
        });
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    function setupEventListeners() {
        // Site selection change - updates areas and map
        document.getElementById('siteSelection').addEventListener('change', handleSiteChange);

        // Custom parameters toggle
        document.getElementById('customParams').addEventListener('change', (e) => {
            document.getElementById('paramsSection').style.display = e.target.checked ? 'grid' : 'none';
        });

        // Frequency type toggle
        document.querySelectorAll('input[name="frequencyType"]').forEach(radio => {
            radio.addEventListener('change', handleFrequencyChange);
        });

        // File upload
        setupFileUpload();

        // Form submission
        document.getElementById('missionForm').addEventListener('submit', handleSubmit);
    }

    function handleSiteChange(e) {
        const siteKey = e.target.value;
        
        // Update site areas dropdown
        populateSiteAreas(siteKey);
        
        // Update map widget
        if (siteKey && currentCompany.sites[siteKey]) {
            currentSite = currentCompany.sites[siteKey];
            const mapConfig = currentSite.mapConfig;
            
            // Initialize or update map
            if (!window.MapWidget.isInitialized()) {
                window.MapWidget.init(mapConfig);
            } else {
                window.MapWidget.updateSite(mapConfig);
            }
        }
    }

    function handleFrequencyChange(e) {
        const isRepeating = e.target.value === 'Repeating';
        const repeatingOptions = document.getElementById('repeatingOptions');
        const repeatFrequency = document.getElementById('repeatFrequency');
        
        repeatingOptions.style.display = isRepeating ? 'block' : 'none';
        repeatFrequency.required = isRepeating;
        
        if (!isRepeating) {
            repeatFrequency.value = '';
        }
    }

    function setDefaultDate() {
        const today = new Date();
        // Set to tomorrow by default for planning purposes
        today.setDate(today.getDate() + 1);
        document.getElementById('missionDate').value = today.toISOString().split('T')[0];
        
        // Set minimum date to today
        document.getElementById('missionDate').min = new Date().toISOString().split('T')[0];
    }

    // ============================================================
    // FILE UPLOAD
    // ============================================================
    function setupFileUpload() {
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');

        // Click to browse
        uploadArea.addEventListener('click', () => fileInput.click());

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            // Check for duplicates
            if (uploadedFiles.some(f => f.name === file.name)) {
                return;
            }

            // Check file size (max 25MB)
            if (file.size > 25 * 1024 * 1024) {
                alert(`File "${file.name}" is too large. Maximum size is 25MB.`);
                return;
            }

            uploadedFiles.push(file);
            renderFileList();
        });
    }

    function renderFileList() {
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        uploadedFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <div class="file-item-info">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                    </svg>
                    <span class="file-item-name">${file.name}</span>
                    <span class="file-item-size">${formatFileSize(file.size)}</span>
                </div>
                <button type="button" class="file-item-remove" data-index="${index}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12"/>
                    </svg>
                </button>
            `;
            fileList.appendChild(item);
        });

        // Add remove handlers
        document.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                uploadedFiles.splice(index, 1);
                renderFileList();
            });
        });
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ============================================================
    // FORM SUBMISSION
    // ============================================================
    function formatDateYYMMDD(dateStr) {
        const date = new Date(dateStr);
        const yy = date.getFullYear().toString().slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}${mm}${dd}`;
    }

    async function handleSubmit(e) {
        e.preventDefault();

        if (isSubmitting) return;
        
        // Validate site selection
        if (!document.getElementById('siteSelection').value) {
            alert('Please select a site.');
            return;
        }

        isSubmitting = true;

        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');

        btnText.style.display = 'none';
        btnLoading.style.display = 'inline-flex';
        submitBtn.disabled = true;

        try {
            const formData = collectFormData();
            const result = await submitToApi(formData);

            // Show success modal
            document.getElementById('missionId').textContent = result.id || 'N/A';
            document.getElementById('successModal').style.display = 'flex';

        } catch (error) {
            console.error('Submission error:', error);
            document.getElementById('errorMessage').textContent = error.message || 'An error occurred while submitting your request.';
            document.getElementById('errorModal').style.display = 'flex';
        } finally {
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
            submitBtn.disabled = false;
            isSubmitting = false;
        }
    }

    function collectFormData() {
        const form = document.getElementById('missionForm');
        const frequencyType = document.querySelector('input[name="frequencyType"]:checked').value;
        const isRepeating = frequencyType === 'Repeating';
        const kmlData = window.MapWidget.generateKML();
        const dateFormatted = formatDateYYMMDD(form.missionDate.value);

        const data = {
            // Company & Site
            company: currentCompany.name,
            companyDisplayName: currentCompany.displayName,
            site: form.siteSelection.value,
            siteArea: form.siteArea.value,
            
            // Mission Details
            missionName: form.missionName.value,
            missionType: form.missionType.value,
            customerComment: form.customerComment.value,
            
            // Custom Parameters
            customParams: form.customParams.checked,
            imageResolution: form.customParams.checked && form.imageResolution.value ? parseFloat(form.imageResolution.value) : null,
            missionHeight: form.customParams.checked && form.missionHeight.value ? parseFloat(form.missionHeight.value) : null,
            overlapForward: form.customParams.checked && form.overlapForward.value ? parseFloat(form.overlapForward.value) : null,
            overlapSide: form.customParams.checked && form.overlapSide.value ? parseFloat(form.overlapSide.value) : null,
            terrainFollowing: form.customParams.checked ? form.terrainFollowing.value : null,
            elevationOptimisation: form.customParams.checked ? form.elevationOptimisation.value : null,
            
            // Frequency
            frequencyType: frequencyType,
            repeatFrequency: isRepeating ? form.repeatFrequency.value : null,
            
            // Schedule
            missionDate: form.missionDate.value,
            missionPriority: parseInt(form.missionPriority.value),
            
            // Contact
            submitterName: form.submitterName.value,
            submitterEmail: form.submitterEmail.value,
            contactNumber: form.contactNumber.value,
            
            // KML Data
            kmlData: kmlData,
            
            // Generated title
            title: `${dateFormatted} ${currentCompany.name} ${form.siteSelection.value} ${form.siteArea.value} ${form.missionName.value}`.trim(),
            
            // Files
            files: uploadedFiles,
            
            // Metadata
            submittedAt: new Date().toISOString()
        };

        return data;
    }

    async function submitToApi(formData) {
        // Convert files to base64
        const filesBase64 = await Promise.all(
            (formData.files || []).map(async file => ({
                name: file.name,
                type: file.type,
                size: file.size,
                data: await fileToBase64(file)
            }))
        );

        const payload = {
            ...formData,
            files: filesBase64
        };

        const response = await fetch('/api/SubmitMission', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }

        return response.json();
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

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
