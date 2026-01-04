// Main Application JavaScript
// Handles form logic, validation, file uploads, and API submission
// Communicates with map widget iframe via postMessage

(function() {
    'use strict';

    // ============================================================
    // COMPANY AND SITE CONFIGURATION
    // ============================================================
    // Site keys must match the SITES config in map-widget.html
    
    const COMPANY_CONFIG = {
        'BMA': {
            name: 'BMA',
            displayName: 'BHP Mitsubishi Alliance',
            sites: {
                'Saraji': {
                    name: 'Saraji',
                    areas: ['6E', '6W', '4E', '4W', '2E', '2W', '1E', '1W', '13E', '15W', '15E', '14W', '14E', '13W', '8W', '8E', '12W', '12E', '9W', '9E', '16W', '16E'],
                    mapConfig: {
                        center: [148.30, -22.42],
                        defaultZoom: 15,
                        orthoUrl: 'https://s3-map-tiles.s3.ap-southeast-2.amazonaws.com/sites/saraji/{z}/{x}/{y}.png'
                    }
                },
                'Goonyella': {
                    name: 'Goonyella',
                    areas: ['North Pit', 'South Pit', 'East Pit', 'CHPP', 'Rail Loop'],
                    mapConfig: {
                        center: [147.97, -21.74],
                        defaultZoom: 15,
                        orthoUrl: 'https://s3-map-tiles.s3.ap-southeast-2.amazonaws.com/sites/goonyella/{z}/{x}/{y}.png'
                    }
                },
                'Peak Downs': {
                    name: 'Peak Downs',
                    areas: ['3N_E', '3N_W', '5N_E', '5N_W', '6N_E', '7N_E', '6N_W', '7N_W', '1S_E', '1S_W', '2S_E', '2S_W', '1N_W', '1N_E', '4S_E', '4S_W', '2N_W', '2N_E', '5S_E', '5S_W', '9S_E', '11S_E', '9S_W', '11S_W'],
                    mapConfig: {
                        center: [148.19, -22.26],
                        defaultZoom: 15,
                        orthoUrl: 'https://s3-map-tiles.s3.ap-southeast-2.amazonaws.com/sites/peak-downs/{z}/{x}/{y}.png'
                    }
                }
            }
        },
        'Goldfields': {
            name: 'Goldfields',
            displayName: 'Goldfields',
            sites: {
                'Gruyere': {
                    name: 'Gruyere',
                    areas: ['Pit', 'ROM', 'TSF', 'WD 01', 'WD 02-03', 'WD 04-05', 'WD 06', 'Plant / MACA', 'Solar Farm', 'NE Outer', 'SE Outer', 'SW Outer', 'Multiple Locations'],
                    mapConfig: {
                        center: [123.8552,-27.9897],
                        defaultZoom: 15,
                        orthoUrl: 'https://s3-map-tiles.s3.ap-southeast-2.amazonaws.com/sites/gruyere/{z}/{x}/{y}.png'
                    }
                },
            }
        }
    };

    // ============================================================
    // STATE
    // ============================================================
    let currentCompany = null;
    let currentSite = null;
    let currentKmlData = '';
    let uploadedFiles = [];
    let isSubmitting = false;
    let mapWidgetReady = false;

    // ============================================================
    // IFRAME COMMUNICATION
    // ============================================================
    function getMapFrame() {
        return document.getElementById('mapWidgetFrame');
    }

    function sendToMapWidget(type, data = {}) {
        const frame = getMapFrame();
        if (frame && frame.contentWindow) {
            frame.contentWindow.postMessage(JSON.stringify({ type, ...data }), '*');
        }
    }

    function setupMapWidgetListener() {
        window.addEventListener('message', function(e) {
            try {
                const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
                
                // Handle KML data from widget
                if (data.type === 'kmlData') {
                    currentKmlData = data.kml || '';
                    document.getElementById('kmlData').value = currentKmlData;
                }
                
                // Handle widget ready notification
                if (data.type === 'widgetReady') {
                    mapWidgetReady = true;
                    // If a site is already selected, send it to the widget
                    const siteSelect = document.getElementById('siteSelection');
                    if (siteSelect && siteSelect.value) {
                        sendToMapWidget('changeSite', { site: siteSelect.value });
                    }
                }
            } catch (err) {
                // Ignore parse errors
            }
        });
    }

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
        setupMapWidgetListener();
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

    // Priority tooltip functionality
const priorityHelpButton = document.getElementById('priorityHelpButton');
const priorityTooltip = document.getElementById('priorityTooltip');

if (priorityHelpButton && priorityTooltip) {
    // Toggle tooltip on button click
    priorityHelpButton.addEventListener('click', function(e) {
        e.stopPropagation();
        priorityTooltip.classList.toggle('show');
    });
    
    // Close tooltip when clicking outside
    document.addEventListener('click', function(e) {
        if (!priorityHelpButton.contains(e.target) && !priorityTooltip.contains(e.target)) {
            priorityTooltip.classList.remove('show');
        }
    });
    
    // Close tooltip on escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            priorityTooltip.classList.remove('show');
        }
    });
}

// Optional: Show tooltip automatically when Priority 2 is selected
const missionPrioritySelect = document.getElementById('missionPriority');
missionPrioritySelect.addEventListener('change', function() {
    if (this.value === '2' && priorityTooltip) {
        // Show tooltip to remind about time requirement
        priorityTooltip.classList.add('show');
        
        // Auto-hide after 8 seconds
        setTimeout(() => {
            priorityTooltip.classList.remove('show');
        }, 8000);
    }
});

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    function setupEventListeners() {
        // Site selection change - updates areas and map widget
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
        
        // Send site change to map widget
        if (siteKey) {
            currentSite = currentCompany.sites[siteKey];
            sendToMapWidget('changeSite', { site: siteKey });
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
        const dateFormatted = formatDateYYMMDD(form.missionDate.value);
        const siteName = currentSite ? currentSite.name : form.siteSelection.value;

        const data = {
            // Company & Site
            company: currentCompany.name,
            companyDisplayName: currentCompany.displayName,
            site: siteName,
            siteKey: form.siteSelection.value,
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
            
            // KML Data (from map widget via postMessage)
            kmlData: currentKmlData,
            
            // Generated title
            title: `${dateFormatted} ${currentCompany.name} ${siteName} ${form.siteArea.value} ${form.missionName.value}`.trim(),
            
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
