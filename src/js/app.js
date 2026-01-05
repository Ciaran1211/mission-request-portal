// Main Application JavaScript
// Handles form logic, validation, file uploads, and EmailJS submission
// Sends structured data via email for Power Automate to parse

(function() {
    'use strict';

    // ============================================================
    // EMAILJS CONFIGURATION
    // ============================================================
    // Get these from your EmailJS dashboard: https://www.emailjs.com/
    const EMAILJS_CONFIG = {
        publicKey: 'AuUzrhV2H93CJxoa0',      // Account → API Keys → Public Key
        serviceId: 'service_4j8dixs',       // Email Services → Service ID
        templateId: 'template_152awpf'      // Email Templates → Template ID
    };

    // ============================================================
    // COMPANY AND SITE CONFIGURATION
    // ============================================================
    const COMPANY_CONFIG = {
        'BMA': {
            name: 'BMA',
            displayName: 'BHP Mitsubishi Alliance',
            sites: {
                'saraji': {
                    name: 'Saraji',
                    areas: ['6W', '8W', '10W', '12W', 'Saraji East', 'Processing Plant', 'Stockpile Area']
                },
                'goonyella': {
                    name: 'Goonyella',
                    areas: ['North Pit', 'South Pit', 'East Pit', 'CHPP', 'Rail Loop']
                },
                'peak-downs': {
                    name: 'Peak Downs',
                    areas: ['Main Pit', 'Extension', 'Haul Road', 'Processing']
                }
            }
        },
        'Goldfields': {
            name: 'Goldfields',
            displayName: 'Goldfields',
            sites: {
                'st-ives': {
                    name: 'St Ives',
                    areas: ['Invincible', 'Hamlet', 'Neptune', 'Athena', 'Processing']
                },
                'gruyere': {
                    name: 'Gruyere',
                    areas: ['Open Pit', 'Stage 1', 'Stage 2', 'Processing Plant', 'TSF']
                },
                'agnew': {
                    name: 'Agnew',
                    areas: ['Kim Pit', 'Waroonga', 'Mill', 'Tailings']
                }
            }
        },
        'RioTinto': {
            name: 'RioTinto',
            displayName: 'Rio Tinto',
            sites: {
                'tom-price': {
                    name: 'Tom Price',
                    areas: ['North Deposit', 'South Deposit', 'Section 7', 'Processing', 'Rail']
                },
                'paraburdoo': {
                    name: 'Paraburdoo',
                    areas: ['Eastern Range', '4 East', 'Channar', 'Processing']
                }
            }
        },
        'FMG': {
            name: 'FMG',
            displayName: 'Fortescue Metals Group',
            sites: {
                'christmas-creek': {
                    name: 'Christmas Creek',
                    areas: ['Cloudbreak West', 'Eastern Hub', 'Central', 'Processing', 'Rail']
                },
                'solomon': {
                    name: 'Solomon',
                    areas: ['Kings Valley', 'Firetail', 'Queens Valley', 'Infrastructure']
                }
            }
        },
        'Norton': {
            name: 'Norton',
            displayName: 'Norton Gold Fields',
            sites: {
                'binduli-north': {
                    name: 'Binduli North',
                    areas: ['Main Pit', 'North Extension', 'ROM Pad', 'Haul Road']
                }
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
                
                if (data.type === 'kmlData') {
                    currentKmlData = data.kml || '';
                    document.getElementById('kmlData').value = currentKmlData;
                }
                
                if (data.type === 'widgetReady') {
                    const siteSelect = document.getElementById('siteSelection');
                    if (siteSelect && siteSelect.value) {
                        sendToMapWidget('changeSite', { site: siteSelect.value });
                    }
                }
            } catch (err) {}
        });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        // Initialize EmailJS
        if (EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
            emailjs.init(EMAILJS_CONFIG.publicKey);
        }

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
        
        populateSites();
        setupEventListeners();
        setupMapWidgetListener();
        setDefaultDate();

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
        document.getElementById('siteSelection').addEventListener('change', handleSiteChange);

        document.getElementById('customParams').addEventListener('change', (e) => {
            document.getElementById('paramsSection').style.display = e.target.checked ? 'grid' : 'none';
        });

        document.querySelectorAll('input[name="frequencyType"]').forEach(radio => {
            radio.addEventListener('change', handleFrequencyChange);
        });

        setupFileUpload();
        document.getElementById('missionForm').addEventListener('submit', handleSubmit);
    }

    function handleSiteChange(e) {
        const siteKey = e.target.value;
        populateSiteAreas(siteKey);
        
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
        today.setDate(today.getDate() + 1);
        document.getElementById('missionDate').value = today.toISOString().split('T')[0];
        document.getElementById('missionDate').min = new Date().toISOString().split('T')[0];
    }

    // ============================================================
    // FILE UPLOAD
    // ============================================================
    function setupFileUpload() {
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');

        uploadArea.addEventListener('click', () => fileInput.click());

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

        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files);
        });
    }

    function handleFiles(files) {
        Array.from(files).forEach(file => {
            if (uploadedFiles.some(f => f.name === file.name)) return;
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
        
        if (!document.getElementById('siteSelection').value) {
            alert('Please select a site.');
            return;
        }

        // Check EmailJS configuration
        if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
            alert('EmailJS is not configured. Please update EMAILJS_CONFIG in app.js');
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
            const refId = await sendViaEmailJS(formData);

            document.getElementById('missionId').textContent = refId;
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

    // Update the collectFormData function to match the schema
function collectFormData() {
    const form = document.getElementById('missionForm');
    const frequencyType = document.querySelector('input[name="frequencyType"]:checked').value;
    const isRepeating = frequencyType === 'Repeating';
    const dateFormatted = formatDateYYMMDD(form.missionDate.value);
    const siteName = currentSite ? currentSite.name : form.siteSelection.value;

    // Frequency value
    let frequency = 'Once';
    if (isRepeating && form.repeatFrequency.value) {
        frequency = form.repeatFrequency.value;
    }

    const hasAttachments = uploadedFiles.length > 0 || (currentKmlData && currentKmlData.length > 0);

    // Build SharePoint-ready data object matching the schema
    const data = {
        // === SHAREPOINT FIELDS ===
        Title: `${dateFormatted} ${currentCompany.name} ${siteName} ${form.siteArea.value} ${form.missionName.value}`.trim(),
        ScheduledDate: form.missionDate.value,
        Company: currentCompany.name,
        Site: siteName,
        'Site Order': form.siteOrder.value ? parseInt(form.siteOrder.value) : null,
        Dock: form.dock.value || '',
        Priority: parseInt(form.missionPriority.value) || 3, // Integer 1-5
        MissionType: form.missionType.value,
        Frequency: frequency,
        MissionPlan: 'New Request',
        PlannedFlightTime: form.plannedFlightTime.value ? parseFloat(form.plannedFlightTime.value) : null,
        JobStatus: 'Incomplete',
        Comments: form.missionName.value,
        CustomerComments: form.customerComment.value || '',
        RequestedBy: form.submitterName.value,
        EmailContact: form.submitterEmail.value,
        PhContact: form.contactNumber.value || '',
        Attachment: hasAttachments ? 'Yes' : 'No',
        CustomerParameters: form.customParams.checked ? 'Yes' : 'No',
        
        // Custom parameters (only if enabled)
        Resolution: form.customParams.checked && form.imageResolution.value ? parseFloat(form.imageResolution.value) : null,
        HeightAGL: form.customParams.checked && form.missionHeight.value ? parseInt(form.missionHeight.value) : null,
        SideOverlap: form.customParams.checked && form.overlapSide.value ? parseInt(form.overlapSide.value) : null,
        ForwardOverlap: form.customParams.checked && form.overlapForward.value ? parseInt(form.overlapForward.value) : null,
        TerrainFollow: form.customParams.checked ? (form.terrainFollowing.value || '') : '',
        ElevOpt: form.customParams.checked ? (form.elevationOptimisation.value || '') : '',
        
        // === METADATA ===
        SiteArea: form.siteArea.value,
        SiteKey: form.siteSelection.value,
        SubmittedAt: new Date().toISOString(),
        
        // File names only
        AttachmentNames: uploadedFiles.map(f => f.name).join(', ') || 'None',
        HasKML: currentKmlData ? 'Yes' : 'No'
    };

    // Validate data types according to schema
    validateFormData(data);

    // Remove null values for cleaner JSON
    Object.keys(data).forEach(key => {
        if (data[key] === null || data[key] === undefined || data[key] === '') {
            delete data[key];
        }
    });

    return data;
}

// Add validation function
function validateFormData(data) {
    // Validate required fields
    const requiredFields = ['Title', 'ScheduledDate', 'Company', 'Site', 'Priority', 'MissionType', 'RequestedBy', 'EmailContact'];
    requiredFields.forEach(field => {
        if (!data[field]) {
            throw new Error(`${field} is required`);
        }
    });

    // Validate data types
    if (data.Priority && (data.Priority < 1 || data.Priority > 5)) {
        throw new Error('Priority must be between 1 and 5');
    }

    if (data['Site Order'] && !Number.isInteger(data['Site Order'])) {
        throw new Error('Site Order must be an integer');
    }

    if (data.PlannedFlightTime && typeof data.PlannedFlightTime !== 'number') {
        throw new Error('Planned Flight Time must be a number');
    }

    if (data.Resolution && typeof data.Resolution !== 'number') {
        throw new Error('Resolution must be a number');
    }

    if (data.HeightAGL && !Number.isInteger(data.HeightAGL)) {
        throw new Error('Height AGL must be an integer');
    }

    if (data.SideOverlap && !Number.isInteger(data.SideOverlap)) {
        throw new Error('Side Overlap must be an integer');
    }

    if (data.ForwardOverlap && !Number.isInteger(data.ForwardOverlap)) {
        throw new Error('Forward Overlap must be an integer');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (data.EmailContact && !emailRegex.test(data.EmailContact)) {
        throw new Error('Please enter a valid email address');
    }

    // Validate date is not in the past
    const selectedDate = new Date(data.ScheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        throw new Error('Scheduled date cannot be in the past');
    }

    return true;
}

// Add this to the handleSubmit function before calling collectFormData()
async function handleSubmit(e) {
    e.preventDefault();

    if (isSubmitting) return;
    
    if (!document.getElementById('siteSelection').value) {
        alert('Please select a site.');
        return;
    }

    // Check EmailJS configuration
    if (EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
        alert('EmailJS is not configured. Please update EMAILJS_CONFIG in app.js');
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
        // Validate form first
        validateForm();
        
        const formData = collectFormData();
        const refId = await sendViaEmailJS(formData);

        document.getElementById('missionId').textContent = refId;
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

// Add this validation function
function validateForm() {
    const form = document.getElementById('missionForm');
    
    // Basic HTML5 validation
    if (!form.checkValidity()) {
        // Find first invalid field
        const invalidField = form.querySelector(':invalid');
        if (invalidField) {
            invalidField.focus();
            invalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        throw new Error('Please fill in all required fields correctly.');
    }
    
    // Additional custom validation
    const missionDate = document.getElementById('missionDate').value;
    const selectedDate = new Date(missionDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        document.getElementById('missionDate').focus();
        throw new Error('Scheduled date cannot be in the past');
    }
    
    // Validate custom parameters if enabled
    if (document.getElementById('customParams').checked) {
        const resolution = document.getElementById('imageResolution').value;
        if (resolution && (resolution < 0.5 || resolution > 20)) {
            document.getElementById('imageResolution').focus();
            throw new Error('Image Resolution must be between 0.5 and 20 cm/px');
        }
        
        const height = document.getElementById('missionHeight').value;
        if (height && (height < 30 || height > 400)) {
            document.getElementById('missionHeight').focus();
            throw new Error('Mission Height must be between 30 and 400 meters');
        }
        
        const forwardOverlap = document.getElementById('overlapForward').value;
        if (forwardOverlap && (forwardOverlap < 50 || forwardOverlap > 95)) {
            document.getElementById('overlapForward').focus();
            throw new Error('Forward Overlap must be between 50% and 95%');
        }
        
        const sideOverlap = document.getElementById('overlapSide').value;
        if (sideOverlap && (sideOverlap < 50 || sideOverlap > 95)) {
            document.getElementById('overlapSide').focus();
            throw new Error('Side Overlap must be between 50% and 95%');
        }
    }
    
    // Validate file sizes
    uploadedFiles.forEach(file => {
        if (file.size > 25 * 1024 * 1024) {
            throw new Error(`File "${file.name}" is too large. Maximum size is 25MB.`);
        }
    });
}

    async function sendViaEmailJS(formData) {
        const refId = `MR-${Date.now().toString(36).toUpperCase()}`;
        
        // Create clean JSON for Power Automate parsing
        const jsonData = JSON.stringify(formData, null, 2);

        const templateParams = {
            title: formData.Title,
            ref_id: refId,
            json_data: jsonData,
            submitted_at: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' }),
            
            // Also include key fields for quick viewing in email
            company: formData.Company,
            site: formData.Site,
            site_area: formData.SiteArea,
            mission_name: formData.Comments,
            mission_type: formData.MissionType,
            scheduled_date: formData.ScheduledDate,
            priority: formData.Priority,
            requested_by: formData.RequestedBy,
            email: formData.EmailContact,
            phone: formData.PhContact || 'Not provided'
        };

        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams
        );

        if (response.status !== 200) {
            throw new Error('Failed to send email');
        }

        return refId;
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', init);
})();
