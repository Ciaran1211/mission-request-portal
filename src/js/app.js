// Main Application JavaScript
// Handles form logic, validation, file uploads, and EmailJS submission
// Supports both New Mission and Repeat Mission request types
// Configuration is loaded from config.js

(function() {
    'use strict';

    // ============================================================
    // STATE
    // ============================================================
    let currentCompany = null;
    let currentSite = null;
    let currentSiteKey = null;
    let currentKmlData = '';
    let uploadedFiles = [];
    let isSubmitting = false;
    let isRepeatMission = false;

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
                    if (currentSiteKey) {
                        sendToMapWidget('changeSite', { site: currentSiteKey });
                    }
                }
            } catch (err) {}
        });
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    function init() {
        console.log('App initializing...');
        
        // Check if config is loaded
        if (typeof COMPANY_CONFIG === 'undefined') {
            console.error('ERROR: COMPANY_CONFIG not found. Make sure config.js is loaded before app.js');
            return;
        }
        if (typeof EMAILJS_CONFIG === 'undefined') {
            console.error('ERROR: EMAILJS_CONFIG not found. Make sure config.js is loaded before app.js');
            return;
        }
        
        console.log('Config loaded. Companies:', Object.keys(COMPANY_CONFIG));

        // Initialize EmailJS
        if (EMAILJS_CONFIG.publicKey && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
            emailjs.init(EMAILJS_CONFIG.publicKey);
            console.log('EmailJS initialized');
        }

        // Get company from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const companyKey = urlParams.get('company');
        console.log('Company from URL:', companyKey);
        
        if (!companyKey || !COMPANY_CONFIG[companyKey]) {
            console.log('Invalid company, showing error page');
            showInvalidCompany();
            return;
        }
        
        currentCompany = COMPANY_CONFIG[companyKey];
        console.log('Current company:', currentCompany.name);
        console.log('Sites:', Object.keys(currentCompany.sites));
        
        document.getElementById('companyId').value = companyKey;
        document.getElementById('companyBadge').textContent = currentCompany.displayName;
        
        populateSites();
        setupEventListeners();
        setupMapWidgetListener();
        setDefaultDate();
        
        console.log('App initialization complete');
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
        if (site.areas && site.areas.length > 0) {
            site.areas.forEach(area => {
                const option = document.createElement('option');
                option.value = area;
                option.textContent = area;
                areaSelect.appendChild(option);
            });
        }
    }

    function populateRepeatMissions(siteKey) {
        const listContainer = document.getElementById('repeatMissionsList');
        
        if (!siteKey || !currentCompany.sites[siteKey]) {
            listContainer.innerHTML = '<p class="no-missions-message">Select a site to see available repeat missions.</p>';
            return;
        }
        
        const site = currentCompany.sites[siteKey];
        const missions = site.repeatMissions || [];
        
        if (missions.length === 0) {
            listContainer.innerHTML = '<p class="no-missions-message">No repeat missions configured for this site.</p>';
            return;
        }
        
        listContainer.innerHTML = '';
        
        missions.forEach((mission, index) => {
            const missionItem = document.createElement('div');
            missionItem.className = 'repeat-mission-item';
            missionItem.innerHTML = `
                <div class="mission-checkbox-row">
                    <label class="checkbox-label">
                        <input type="checkbox" 
                               name="repeatMissionSelect" 
                               value="${index}" 
                               data-sharepoint="${mission.sharepoint}"
                               data-display="${mission.display}"
                               data-dock="${mission.dock || ''}"
                               data-flight-time="${mission.plannedFlightTime || ''}"
                               data-mission-type="${mission.missionType || ''}">
                        <span class="checkbox-custom"></span>
                        <span class="mission-display-name">${mission.display}</span>
                    </label>
                    ${mission.plannedFlightTime ? `<span class="mission-time">${mission.plannedFlightTime} min</span>` : ''}
                </div>
                <div class="mission-comment-row">
                    <input type="text" 
                           class="mission-comment-input" 
                           placeholder="Add comment (optional)"
                           data-mission-index="${index}">
                </div>
            `;
            listContainer.appendChild(missionItem);
        });
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================
    function setupEventListeners() {
        // Request type toggle
        document.querySelectorAll('input[name="requestType"]').forEach(radio => {
            radio.addEventListener('change', handleRequestTypeChange);
        });

        // Site selection
        document.getElementById('siteSelection').addEventListener('change', handleSiteChange);

        // Custom parameters toggle
        document.getElementById('customParams').addEventListener('change', (e) => {
            document.getElementById('paramsSection').style.display = e.target.checked ? 'grid' : 'none';
        });

        // File upload
        setupFileUpload();
        
        // Form submission
        document.getElementById('missionForm').addEventListener('submit', handleSubmit);
    }

    function handleRequestTypeChange(e) {
        isRepeatMission = e.target.value === 'Repeat Mission';
        
        // Toggle visibility of sections
        const siteAreaGroup = document.getElementById('siteAreaGroup');
        const mapSection = document.getElementById('mapSection');
        const missionDetailsSection = document.getElementById('missionDetailsSection');
        const repeatMissionsSection = document.getElementById('repeatMissionsSection');
        const fileUploadSection = document.getElementById('fileUploadSection');
        
        if (isRepeatMission) {
            // Show repeat missions, hide new mission sections
            siteAreaGroup.style.display = 'none';
            mapSection.style.display = 'none';
            missionDetailsSection.style.display = 'none';
            fileUploadSection.style.display = 'none';
            repeatMissionsSection.style.display = 'block';
            
            // Update section numbers
            document.getElementById('scheduleNumber').textContent = '4';
            document.getElementById('contactNumber').textContent = '5';
            
            // Remove required from new mission fields
            document.getElementById('siteArea').removeAttribute('required');
            document.getElementById('missionName').removeAttribute('required');
            document.getElementById('missionType').removeAttribute('required');
            
            // Populate repeat missions for current site
            if (currentSiteKey) {
                populateRepeatMissions(currentSiteKey);
            }
        } else {
            // Show new mission sections, hide repeat missions
            siteAreaGroup.style.display = 'block';
            mapSection.style.display = 'block';
            missionDetailsSection.style.display = 'block';
            fileUploadSection.style.display = 'block';
            repeatMissionsSection.style.display = 'none';
            
            // Update section numbers
            document.getElementById('scheduleNumber').textContent = '4';
            document.getElementById('contactNumber').textContent = '5';
            document.getElementById('attachmentsNumber').textContent = '6';
            
            // Restore required attributes
            document.getElementById('siteArea').setAttribute('required', '');
            document.getElementById('missionName').setAttribute('required', '');
            document.getElementById('missionType').setAttribute('required', '');
        }
    }

    function handleSiteChange(e) {
        const siteKey = e.target.value;
        currentSiteKey = siteKey;
        
        if (siteKey && currentCompany.sites[siteKey]) {
            currentSite = currentCompany.sites[siteKey];
            
            // Update areas dropdown
            populateSiteAreas(siteKey);
            
            // Update map widget
            sendToMapWidget('changeSite', { site: siteKey });
            
            // Update repeat missions list if in repeat mode
            if (isRepeatMission) {
                populateRepeatMissions(siteKey);
            }
        } else {
            currentSite = null;
            populateSiteAreas(null);
            if (isRepeatMission) {
                populateRepeatMissions(null);
            }
        }
    }

    function setDefaultDate() {
        const today = new Date();
        document.getElementById('missionDate').value = today.toISOString().split('T')[0];
        document.getElementById('missionDate').min = today.toISOString().split('T')[0];
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

        // Validate repeat missions selection
        if (isRepeatMission) {
            const selectedMissions = document.querySelectorAll('input[name="repeatMissionSelect"]:checked');
            if (selectedMissions.length === 0) {
                alert('Please select at least one mission.');
                return;
            }
        }

        // Check EmailJS configuration
        if (!EMAILJS_CONFIG.publicKey || EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
            alert('EmailJS is not configured. Please update EMAILJS_CONFIG in config.js');
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
            let formData;
            if (isRepeatMission) {
                formData = collectRepeatMissionData();
            } else {
                formData = collectNewMissionData();
            }
            
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

    function collectNewMissionData() {
        const form = document.getElementById('missionForm');
        const dateFormatted = formatDateYYMMDD(form.missionDate.value);
        const siteName = currentSite ? currentSite.name : form.siteSelection.value;

        const hasAttachments = uploadedFiles.length > 0 || (currentKmlData && currentKmlData.length > 0);

        const data = {
            RequestType: 'New Mission',
            Title: `${dateFormatted} ${currentCompany.name} ${siteName} ${form.siteArea.value} ${form.missionName.value}`.trim(),
            ScheduledDate: form.missionDate.value,
            Company: currentCompany.name,
            Site: siteName,
            SiteKey: currentSiteKey,
            SiteArea: form.siteArea.value,
            Priority: parseInt(form.missionPriority.value) || 3,
            MissionType: form.missionType.value,
            MissionName: form.missionName.value,
            CustomerComments: form.customerComment.value || '',
            RequestedBy: form.submitterName.value,
            EmailContact: form.submitterEmail.value,
            PhContact: form.contactNumber.value || '',
            Attachment: hasAttachments,
            CustomerParameters: form.customParams.checked,
            MissionPlan: 'New Request',
            JobStatus: 'Incomplete',
            Frequency: 'Once',
            SubmittedAt: new Date().toISOString(),
            AttachmentNames: uploadedFiles.map(f => f.name).join(', ') || 'None',
            HasKML: currentKmlData ? true : false
        };

        // Custom parameters (only if enabled)
        if (form.customParams.checked) {
            if (form.imageResolution.value) data.Resolution = parseFloat(form.imageResolution.value);
            if (form.missionHeight.value) data.HeightAGL = parseInt(form.missionHeight.value);
            if (form.overlapSide.value) data.SideOverlap = parseInt(form.overlapSide.value);
            if (form.overlapForward.value) data.ForwardOverlap = parseInt(form.overlapForward.value);
            if (form.terrainFollowing.value) data.TerrainFollow = form.terrainFollowing.value;
            if (form.elevationOptimisation.value) data.ElevOpt = form.elevationOptimisation.value;
        }

        return data;
    }

    function collectRepeatMissionData() {
        const form = document.getElementById('missionForm');
        const siteName = currentSite ? currentSite.name : form.siteSelection.value;

        // Get selected missions
        const selectedCheckboxes = document.querySelectorAll('input[name="repeatMissionSelect"]:checked');
        const repeatMissions = [];
        
        let siteOrder = 1;
        selectedCheckboxes.forEach(checkbox => {
            const index = checkbox.value;
            const commentInput = document.querySelector(`.mission-comment-input[data-mission-index="${index}"]`);
            const comment = commentInput ? commentInput.value : '';
            
            repeatMissions.push({
                Title: checkbox.dataset.sharepoint,
                MissionName: checkbox.dataset.sharepoint,
                DisplayName: checkbox.dataset.display,
                MissionType: checkbox.dataset.missionType || '',
                Comment: comment,
                SiteOrder: siteOrder++,
                Dock: checkbox.dataset.dock || '',
                PlannedFlightTime: checkbox.dataset.flightTime ? parseInt(checkbox.dataset.flightTime) : null,
                MissionPlan: 'New Request',
                JobStatus: 'Incomplete'
            });
        });

        const data = {
            RequestType: 'Repeat Mission',
            Title: `${formatDateYYMMDD(form.missionDate.value)} ${currentSiteKey} Repeat Missions (${repeatMissions.length})`,
            ScheduledDate: form.missionDate.value,
            Priority: parseInt(form.missionPriority.value) || 3,
            Company: currentCompany.name,
            Site: siteName,
            SiteKey: currentSiteKey,
            RequestedBy: form.submitterName.value,
            EmailContact: form.submitterEmail.value,
            PhContact: form.contactNumber.value || '',
            Attachment: false,
            AttachmentNames: 'None',
            SubmittedAt: new Date().toISOString(),
            RepeatMissions: repeatMissions
        };

        return data;
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
            
            // Key fields for quick viewing
            request_type: formData.RequestType,
            company: formData.Company,
            site: formData.Site,
            site_area: formData.SiteArea || 'N/A',
            mission_name: formData.MissionName || (formData.RepeatMissions ? `${formData.RepeatMissions.length} missions` : ''),
            mission_type: formData.MissionType || 'Repeat',
            scheduled_date: formData.ScheduledDate,
            priority: formData.Priority,
            requested_by: formData.RequestedBy,
            email_contact: formData.EmailContact.replace('@', ' [at] '),
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
