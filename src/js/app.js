// Main Application JavaScript
// Handles form logic, validation, file uploads, and EmailJS submission
// Sends structured data via email for Power Automate to parse
// Configuration is loaded from config.js

(function() {
    'use strict';

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

    function collectFormData() {
        const form = document.getElementById('missionForm');
        const frequencyType = document.querySelector('input[name="frequencyType"]:checked').value;
        const isRepeating = frequencyType === 'Repeating';
        const dateFormatted = formatDateYYMMDD(form.missionDate.value);
        const siteName = currentSite ? currentSite.name : form.siteSelection.value;

        // Priority mapping
        const priorityMap = {
            '1': '1 - Critical',
            '2': '2 - High',
            '3': '3 - Medium',
            '4': '4 - Low',
            '5': '5 - Flexible'
        };

        // Frequency value
        let frequency = 'Once';
        if (isRepeating && form.repeatFrequency.value) {
            frequency = form.repeatFrequency.value;
        }

        const hasAttachments = uploadedFiles.length > 0 || (currentKmlData && currentKmlData.length > 0);

        // Build SharePoint-ready data object
        // Note: Email is stored with [at] to prevent HTML auto-linking, Power Automate will fix it
        const data = {
            // === SHAREPOINT FIELDS ===
            Title: `${dateFormatted} ${currentCompany.name} ${siteName} ${form.siteArea.value} ${form.missionName.value}`.trim(),
            ScheduledDate: form.missionDate.value,
            Company: currentCompany.name,
            Site: siteName,
            Priority: priorityMap[form.missionPriority.value] || '3 - Medium',
            MissionType: form.missionType.value,
            Frequency: frequency,
            MissionPlan: 'New Request',
            JobStatus: 'Incomplete',
            Comments: form.missionName.value,
            CustomerComments: form.customerComment.value || '',
            RequestedBy: form.submitterName.value,
            EmailContact: form.submitterEmail.value,
            PhContact: form.contactNumber.value || '',
            Attachment: hasAttachments,
            CustomerParameters: form.customParams.checked ? 'Yes' : 'No',

            // Custom parameters (only if enabled)
            Resolution: form.customParams.checked && form.imageResolution.value ? parseFloat(form.imageResolution.value) : null,
            HeightAGL: form.customParams.checked && form.missionHeight.value ? parseFloat(form.missionHeight.value) : null,
            SideOverlap: form.customParams.checked && form.overlapSide.value ? parseFloat(form.overlapSide.value) : null,
            ForwardOverlap: form.customParams.checked && form.overlapForward.value ? parseFloat(form.overlapForward.value) : null,
            TerrainFollow: form.customParams.checked ? (form.terrainFollowing.value || null) : null,
            ElevOpt: form.customParams.checked ? (form.elevationOptimisation.value || null) : null,

            // === METADATA (for reference, not direct SP fields) ===
            SiteArea: form.siteArea.value,
            SiteKey: form.siteSelection.value,
            SubmittedAt: new Date().toISOString(),

            // File names only (files can't be sent via email easily)
            AttachmentNames: uploadedFiles.map(f => f.name).join(', ') || 'None',
            HasKML: currentKmlData ? 'Yes' : 'No'
        };

        // Remove null values for cleaner JSON
        Object.keys(data).forEach(key => {
            if (data[key] === null || data[key] === undefined) {
                delete data[key];
            }
        });

        return data;
    }

    async function sendViaEmailJS(formData) {
        const refId = `MR-${Date.now().toString(36).toUpperCase()}`;

        // Create clean JSON for Power Automate parsing
        // Note: EmailJS may convert to HTML, so Power Automate needs to clean it
        const jsonData = JSON.stringify(formData, null, 2);

        const templateParams = {
            title: formData.Title,
            ref_id: refId,
            json_data: jsonData,
            submitted_at: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' }),

            // Key fields for quick viewing (plain text, no links)
            company: formData.Company,
            site: formData.Site,
            site_area: formData.SiteArea,
            mission_name: formData.Comments,
            mission_type: formData.MissionType,
            scheduled_date: formData.ScheduledDate,
            priority: formData.Priority,
            requested_by: formData.RequestedBy,
            email_contact: formData.EmailContact.replace('@', ' [at] '), // Prevent auto-linking
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
