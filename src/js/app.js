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
        publicKey: 'AuUzrhV2H93CJxoa0',      // Account â†’ API Keys â†’ Public Key
        serviceId: 'service_4j8dixs',       // Email Services â†’ Service ID
        templateId: 'template_152awpf'      // Email Templates â†’ Template ID
    };

    // ============================================================
    // COMPANY AND SITE CONFIGURATION
    // ============================================================
    const COMPANY_CONFIG = {
        'BMA': {
            name: 'BMA',
            displayName: 'BHP Mitsubishi Alliance',
            sites: {
                'SR': {
                    name: 'Saraji',
                    areas: ["6E", "6W", "4E", "4W", "2E", "2W", "1E", "1W", "13E", "15W", "15E", "14W", "14E", "13W", "8W", "8E", "12W", "12E", "9W", "9E", "16W", "16E"],
                    repeatMissions: [
                        { display: "Daily Panos", sharepoint: "251219 P SR PIT Daily Panos 1" },
                        { display: "Daily Panos 2", sharepoint: "251219 P SR PIT Daily Panos 2" },
                        { display: "Daily Panos 3", sharepoint: "251219 P SR PIT Daily Panos 3" },
                        { display: "PIT Coal 8", sharepoint: "251219 S SR PIT Coal 8" },
                        { display: "PIT Coal 9", sharepoint: "251219 S SR PIT Coal 9" },
                        { display: "PIT Coal 12", sharepoint: "251219 S SR PIT Coal 12" },
                        { display: "PIT Coal 13-14", sharepoint: "251219 S SR PIT Coal 13-14" },
                        { display: "PIT Coal 15", sharepoint: "251219 S SR PIT Coal 15" },
                        { display: "PIT Coal 16", sharepoint: "251219 S SR PIT Coal 16" },
                        { display: "PIT Coal 1A", sharepoint: "251219 S SR PIT Coal 1A" },
                        { display: "PIT Coal 2-4", sharepoint: "251219 S SR PIT Coal 2-4" },
                        { display: "PIT Coal 6", sharepoint: "251219 S SR PIT Coal 6" }
                    ]
                },
                'GR': {
                    name: 'Goonyella',
                    areas: ['North Pit', 'South Pit', 'East Pit', 'CHPP', 'Rail Loop'],
                    repeatMissions: []
                },
                'PK': {
                    name: 'Peak Downs',
                    areas: ["3N_E", "3N_W", "5N_E", "5N_W", "6N_E", "7N_E", "6N_W", "7N_W", "1S_E", "1S_W", "2S_E", "2S_W", "1N_W", "1N_E", "4S_E", "4S_W", "2N_W", "2N_E", "5S_E", "5S_W", "9S_E", "11S_E", "9S_W", "11S_W"],
                    repeatMissions: []
                }
            }
        },
        'Goldfields': {
            name: 'Goldfields',
            displayName: 'Goldfields',
            sites: {
                'GY': {
                    name: 'Gruyere',
                    areas: ["Pit", "ROM", "TSF", "WD 01", "WD 02-03", "WD 04-05", "WD 06", "Plant / MACA", "Solar Farm", "NE Outer", "SE Outer", "SW Outer", "Multiple Locations"],
                    repeatMissions: []
                },
            }
        },
        'Norton': {
            name: 'Norton',
            displayName: 'Norton Gold Fields',
            sites: {
                'BN': {
                    name: 'Binduli North',
                    areas: ["Janet Ivy Pit", "Karen Louise Pit", "North Waste Rock Dump", "East Waste Rock Dump", "ROM", "ROM 2", "Heap Leach", "Offices", "Treatment Plant", "Fort William", "Site Access", "Multiple Locations"],
                    repeatMissions: []
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
    let requestType = 'single'; // 'single' or 'repeat'
    let repeatMissionRows = []; // Array of {mission: '', comment: ''}

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
    // REQUEST TYPE HANDLING
    // ============================================================
    function handleRequestTypeChange(type) {
        requestType = type;

        const singleRequestSections = document.getElementById('singleRequestSections');
        const repeatMissionSection = document.getElementById('repeatMissionSection');
        const singleContactSection = document.getElementById('singleContactSection');
        const singleAttachmentsSection = document.getElementById('singleAttachmentsSection');

        if (type === 'single') {
            singleRequestSections.style.display = 'block';
            repeatMissionSection.style.display = 'none';
            if (singleContactSection) singleContactSection.style.display = 'block';
            if (singleAttachmentsSection) singleAttachmentsSection.style.display = 'block';

            // Re-enable required fields for single request
            document.getElementById('siteArea').required = true;
            document.getElementById('missionName').required = true;
            document.getElementById('missionType').required = true;
            document.getElementById('missionPriority').required = true;
            document.getElementById('submitterName').required = true;
            document.getElementById('submitterEmail').required = true;
        } else {
            singleRequestSections.style.display = 'none';
            repeatMissionSection.style.display = 'block';
            if (singleContactSection) singleContactSection.style.display = 'none';
            if (singleAttachmentsSection) singleAttachmentsSection.style.display = 'none';

            // Disable required fields for single request
            document.getElementById('siteArea').required = false;
            document.getElementById('missionName').required = false;
            document.getElementById('missionType').required = false;
            document.getElementById('missionPriority').required = false;
            document.getElementById('submitterName').required = false;
            document.getElementById('submitterEmail').required = false;

            // Initialize with one empty row if none exist
            if (repeatMissionRows.length === 0) {
                addRepeatMissionRow();
            }
        }
    }

    function getRepeatMissionsForSite(siteKey) {
        if (!currentCompany || !currentCompany.sites[siteKey]) {
            return [];
        }
        return currentCompany.sites[siteKey].repeatMissions || [];
    }

    function addRepeatMissionRow() {
        const siteKey = document.getElementById('siteSelection').value;
        const missions = getRepeatMissionsForSite(siteKey);

        repeatMissionRows.push({ mission: '', comment: '' });
        renderRepeatMissionsTable();
    }

    function removeRepeatMissionRow(index) {
        if (repeatMissionRows.length > 1) {
            repeatMissionRows.splice(index, 1);
            renderRepeatMissionsTable();
        }
    }

    function updateRepeatMissionRow(index, field, value) {
        if (repeatMissionRows[index]) {
            repeatMissionRows[index][field] = value;
        }
    }

    function renderRepeatMissionsTable() {
        const container = document.getElementById('repeatMissionsTableBody');
        const siteKey = document.getElementById('siteSelection').value;
        const missions = getRepeatMissionsForSite(siteKey);

        container.innerHTML = '';

        repeatMissionRows.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.className = 'repeat-mission-row';

            // Mission dropdown cell
            const missionCell = document.createElement('td');
            const missionSelect = document.createElement('select');
            missionSelect.className = 'repeat-mission-select';
            missionSelect.innerHTML = '<option value="">Select mission...</option>';

            missions.forEach(mission => {
                const option = document.createElement('option');
                option.value = mission.sharepoint; // Store SharePoint name as value
                option.textContent = mission.display; // Show display name
                if (row.mission === mission.sharepoint) {
                    option.selected = true;
                }
                missionSelect.appendChild(option);
            });

            missionSelect.addEventListener('change', (e) => {
                updateRepeatMissionRow(index, 'mission', e.target.value);
            });
            missionCell.appendChild(missionSelect);

            // Comment cell
            const commentCell = document.createElement('td');
            const commentInput = document.createElement('input');
            commentInput.type = 'text';
            commentInput.className = 'repeat-mission-comment';
            commentInput.placeholder = 'KML Reference / Comment';
            commentInput.value = row.comment || '';
            commentInput.addEventListener('input', (e) => {
                updateRepeatMissionRow(index, 'comment', e.target.value);
            });
            commentCell.appendChild(commentInput);

            // Actions cell
            const actionsCell = document.createElement('td');
            actionsCell.className = 'repeat-mission-actions';

            if (repeatMissionRows.length > 1) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'remove-row-btn';
                removeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
                removeBtn.title = 'Remove row';
                removeBtn.addEventListener('click', () => removeRepeatMissionRow(index));
                actionsCell.appendChild(removeBtn);
            }

            tr.appendChild(missionCell);
            tr.appendChild(commentCell);
            tr.appendChild(actionsCell);
            container.appendChild(tr);
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

        // Request type toggle
        document.querySelectorAll('input[name="requestType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                handleRequestTypeChange(e.target.value);
            });
        });

        // Add repeat mission row button
        const addRowBtn = document.getElementById('addRepeatMissionRow');
        if (addRowBtn) {
            addRowBtn.addEventListener('click', addRepeatMissionRow);
        }

        setupFileUpload();
        document.getElementById('missionForm').addEventListener('submit', handleSubmit);
    }

    function handleSiteChange(e) {
        const siteKey = e.target.value;
        populateSiteAreas(siteKey);
        
        if (siteKey) {
            currentSite = currentCompany.sites[siteKey];
            sendToMapWidget('changeSite', { site: siteKey });

            // Check if site has repeat missions and update UI
            const missions = getRepeatMissionsForSite(siteKey);
            const repeatOption = document.getElementById('repeatMission');

            if (repeatOption) {
                // Disable repeat option if no repeat missions available
                if (missions.length === 0) {
                    repeatOption.disabled = true;
                    repeatOption.parentElement.style.opacity = '0.5';
                    repeatOption.parentElement.title = 'No repeat missions configured for this site';

                    // If currently on repeat mode, switch to single
                    if (requestType === 'repeat') {
                        document.getElementById('singleRequest').checked = true;
                        handleRequestTypeChange('single');
                    }
                } else {
                    repeatOption.disabled = false;
                    repeatOption.parentElement.style.opacity = '1';
                    repeatOption.parentElement.title = '';
                }
            }

            // Clear and refresh repeat mission rows when site changes
            repeatMissionRows = [];
            if (requestType === 'repeat') {
                addRepeatMissionRow();
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
        const todayStr = today.toISOString().split('T')[0];

        // Set date for single request mode
        const missionDate = document.getElementById('missionDate');
        if (missionDate) {
            missionDate.value = todayStr;
            missionDate.min = todayStr;
        }

        // Set date for repeat mission mode
        const repeatMissionDate = document.getElementById('repeatMissionDate');
        if (repeatMissionDate) {
            repeatMissionDate.value = todayStr;
            repeatMissionDate.min = todayStr;
        }
    }

    // ============================================================
    // FILE UPLOAD
    // ============================================================
    function setupFileUpload() {
        // Single request file upload
        const uploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');

        if (uploadArea && fileInput) {
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

        // Repeat mission file upload
        const repeatUploadArea = document.getElementById('repeatFileUploadArea');
        const repeatFileInput = document.getElementById('repeatFileInput');

        if (repeatUploadArea && repeatFileInput) {
            repeatUploadArea.addEventListener('click', () => repeatFileInput.click());

            repeatUploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                repeatUploadArea.classList.add('drag-over');
            });

            repeatUploadArea.addEventListener('dragleave', () => {
                repeatUploadArea.classList.remove('drag-over');
            });

            repeatUploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                repeatUploadArea.classList.remove('drag-over');
                handleFiles(e.dataTransfer.files, 'repeat');
            });

            repeatFileInput.addEventListener('change', (e) => {
                handleFiles(e.target.files, 'repeat');
            });
        }
    }

    function handleFiles(files, mode = 'single') {
        Array.from(files).forEach(file => {
            if (uploadedFiles.some(f => f.name === file.name)) return;
            if (file.size > 25 * 1024 * 1024) {
                alert(`File "${file.name}" is too large. Maximum size is 25MB.`);
                return;
            }
            uploadedFiles.push(file);
            renderFileList(mode);
        });
    }

    function renderFileList(mode = 'single') {
        // Render to both file lists since they share the same uploadedFiles array
        const fileLists = ['fileList', 'repeatFileList'];

        fileLists.forEach(listId => {
            const fileList = document.getElementById(listId);
            if (!fileList) return;

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
        });

        // Setup remove handlers
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

    // Form validation function
    function validateForm() {
        const form = document.getElementById('missionForm');

        // For repeat missions, only validate essential fields
        if (requestType === 'repeat') {
            // Check site selection
            if (!document.getElementById('siteSelection').value) {
                throw new Error('Please select a site');
            }

            // Check at least one mission is selected
            const validMissions = repeatMissionRows.filter(row => row.mission);
            if (validMissions.length === 0) {
                throw new Error('Please select at least one repeat mission');
            }

            // Check date (using repeat-specific field)
            const repeatDate = document.getElementById('repeatMissionDate');
            if (!repeatDate || !repeatDate.value) {
                throw new Error('Please select a mission date');
            }

            const selectedDate = new Date(repeatDate.value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (selectedDate < today) {
                throw new Error('Scheduled date cannot be in the past');
            }

            // Check contact info (using repeat-specific fields)
            const repeatName = document.getElementById('repeatSubmitterName');
            const repeatEmail = document.getElementById('repeatSubmitterEmail');

            if (!repeatName || !repeatName.value) {
                throw new Error('Your name is required');
            }
            if (!repeatEmail || !repeatEmail.value) {
                throw new Error('Email is required');
            }

            return;
        }

        // Basic HTML5 validation for single request
        if (!form.checkValidity()) {
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

    // Update the collectFormData function to match the schema
function collectFormData() {
    const form = document.getElementById('missionForm');
    const dateFormatted = formatDateYYMMDD(form.missionDate.value);
    const siteName = currentSite ? currentSite.name : form.siteSelection.value;
    const hasAttachments = uploadedFiles.length > 0 || (currentKmlData && currentKmlData.length > 0);

    // Helper to safely get form field value
    const getFieldValue = (fieldName, defaultValue = '') => {
        const field = form.elements[fieldName];
        return field ? field.value : defaultValue;
    };

    // Handle Repeat Mission request type
    if (requestType === 'repeat') {
        // Filter out empty rows
        const validMissions = repeatMissionRows.filter(row => row.mission);

        if (validMissions.length === 0) {
            throw new Error('Please select at least one repeat mission');
        }

        // Use repeat-specific field IDs
        const repeatDate = document.getElementById('repeatMissionDate');
        const repeatName = document.getElementById('repeatSubmitterName');
        const repeatEmail = document.getElementById('repeatSubmitterEmail');
        const repeatPhone = document.getElementById('repeatContactNumber');

        const data = {
            RequestType: 'Repeat Mission',
            ScheduledDate: repeatDate ? repeatDate.value : '',
            Company: currentCompany.name,
            Site: siteName,
            SiteKey: getFieldValue('siteSelection'),
            RequestedBy: repeatName ? repeatName.value : '',
            EmailContact: repeatEmail ? repeatEmail.value : '',
            PhContact: repeatPhone ? repeatPhone.value : '',
            Attachment: hasAttachments ? 'Yes' : 'No',
            AttachmentNames: uploadedFiles.map(f => f.name).join(', ') || 'None',
            SubmittedAt: new Date().toISOString(),

            // Repeat missions array
            RepeatMissions: validMissions.map(row => ({
                MissionName: row.mission, // SharePoint name
                Comment: row.comment || ''
            })),

            // Summary for title
            Title: `${dateFormatted} ${getFieldValue('siteSelection')} Repeat Missions (${validMissions.length})`.trim()
        };

        // Validate repeat mission data
        validateRepeatFormData(data);

        return data;
    }

    // Handle Single Request type (original logic)
    const frequencyType = document.querySelector('input[name="frequencyType"]:checked');
    const isRepeating = frequencyType && frequencyType.value === 'Repeating';

    let frequency = 'Once';
    if (isRepeating && form.repeatFrequency && form.repeatFrequency.value) {
        frequency = form.repeatFrequency.value;
    }

    const missionTypeVal = (form.missionType.value || '').trim();

    // Normalize SharePoint-friendly mission type
    const missionTypeForForm = (() => {
      const map = {
        'Survey - Nadir (standard mapping survey)': 'Survey',
        'Survey - Oblique (e.g. pit wall models)': 'Survey',
        'Panoramic (360-deg imagery)': 'Panoramic',
        'Inspection imagery': 'Inspection',
        'Video recording': 'Video',
        'Video livestream': 'Livestream',
        'Other': 'Other'
      };
      return map[missionTypeVal] || missionTypeVal || 'Other';
    })();

    // Build SharePoint-ready data object matching the schema
    const data = {
        // === SHAREPOINT FIELDS ===
        RequestType: 'Single Request',
        Title: `${dateFormatted} ${getFieldValue('siteSelection')} ${getFieldValue('siteArea')} ${getFieldValue('missionName')}`.trim(),
        ScheduledDate: getFieldValue('missionDate'),
        Company: currentCompany.name,
        Site: siteName,
        Priority: parseInt(getFieldValue('missionPriority')) || 3, // Integer 1-5
        MissionType: missionTypeForForm,
        Frequency: frequency,
        MissionPlan: 'New Request',
        JobStatus: 'Incomplete',
        Comments: getFieldValue('missionName'),
        CustomerComments: getFieldValue('customerComment'),
        RequestedBy: getFieldValue('submitterName'),
        EmailContact: getFieldValue('submitterEmail'),
        PhContact: getFieldValue('contactNumber'),
        Attachment: hasAttachments ? 'Yes' : 'No',
        CustomerParameters: form.customParams && form.customParams.checked ? 'Yes' : 'No',
        
        // Custom parameters (only if enabled)
        Resolution: form.customParams && form.customParams.checked && getFieldValue('imageResolution') ? parseFloat(getFieldValue('imageResolution')) : null,
        HeightAGL: form.customParams && form.customParams.checked && getFieldValue('missionHeight') ? parseInt(getFieldValue('missionHeight')) : null,
        SideOverlap: form.customParams && form.customParams.checked && getFieldValue('overlapSide') ? parseInt(getFieldValue('overlapSide')) : null,
        ForwardOverlap: form.customParams && form.customParams.checked && getFieldValue('overlapForward') ? parseInt(getFieldValue('overlapForward')) : null,
        TerrainFollow: form.customParams && form.customParams.checked ? getFieldValue('terrainFollowing') : '',
        ElevOpt: form.customParams && form.customParams.checked ? getFieldValue('elevationOptimisation') : '',
        
        // === METADATA ===
        SiteArea: getFieldValue('siteArea'),
        SiteKey: getFieldValue('siteSelection'),
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

// Validation for repeat mission form
function validateRepeatFormData(data) {
    if (!data.ScheduledDate) {
        throw new Error('Scheduled date is required');
    }
    if (!data.RequestedBy) {
        throw new Error('Your name is required');
    }
    if (!data.EmailContact) {
        throw new Error('Email is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.EmailContact)) {
        throw new Error('Please enter a valid email address');
    }

    const selectedDate = new Date(data.ScheduledDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
        throw new Error('Scheduled date cannot be in the past');
    }

    return true;
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

    async function sendViaEmailJS(formData) {
        const refId = `MR-${Date.now().toString(36).toUpperCase()}`;
        
        // Create clean JSON for Power Automate parsing
        const jsonData = JSON.stringify(formData, null, 2);

        // Build template params based on request type
        let templateParams = {
            title: formData.Title,
            ref_id: refId,
            json_data: jsonData,
            submitted_at: new Date().toLocaleString('en-AU', { timeZone: 'Australia/Perth' }),
            company: formData.Company,
            site: formData.Site,
            scheduled_date: formData.ScheduledDate,
            requested_by: formData.RequestedBy,
            email: formData.EmailContact,
            phone: formData.PhContact || 'Not provided',
            request_type: formData.RequestType || 'Single Request'
        };

        // Add type-specific fields
        if (formData.RequestType === 'Repeat Mission') {
            templateParams.site_area = 'N/A';
            templateParams.mission_name = `${formData.RepeatMissions.length} repeat mission(s)`;
            templateParams.mission_type = 'Repeat';
            templateParams.priority = 'N/A';
            templateParams.repeat_missions = formData.RepeatMissions.map(m => m.MissionName).join(', ');
        } else {
            templateParams.site_area = formData.SiteArea;
            templateParams.mission_name = formData.Comments;
            templateParams.mission_type = formData.MissionType;
            templateParams.priority = formData.Priority;
        }

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