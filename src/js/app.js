/**
 * Mission Request Portal - Main Application Module
 * =================================================
 *
 * Core application logic for the drone mission request form.
 * Handles form interactions, validation, file uploads, and submission.
 *
 * Architecture:
 * - IIFE pattern for encapsulation and avoiding global pollution
 * - Event-driven design with centralized state management
 * - Modular functions organized by responsibility
 *
 * Data Flow:
 * Form Input → Validation → Data Collection → EmailJS → Power Automate → SharePoint
 *
 * Dependencies:
 * - config.js (COMPANY_CONFIG, EMAILJS_CONFIG)
 * - EmailJS SDK (loaded via CDN)
 *
 * @module app
 * @version 2.0.0
 * @author RocketDNA Development Team
 */

(function() {
    'use strict';

    /* ======================================================================
       CONSTANTS & CONFIGURATION
       ====================================================================== */

    /**
     * Power Automate HTTP trigger endpoint for direct file uploads.
     * Files are uploaded directly to SharePoint, bypassing email size limits.
     *
     * Setup Instructions:
     * 1. Create Power Automate flow with HTTP Request trigger
     * 2. Configure flow to receive JSON with fileName, fileContent, missionRef
     * 3. Add SharePoint "Create File" action
     * 4. Copy the HTTP POST URL here
     */
    const FILE_UPLOAD_ENDPOINT = 'https://default0d0ae4136f89412e8ba95ea4efeb79.81.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/06e7553c7ba54e239d91319adf12a337/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=G4qLLP60bZw6guaEKK-rWGI-33t6iW30LVQCsIUQd0k';

    /**
     * Maximum file size for uploads (100MB for Power Automate)
     * @constant {number}
     */
    const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

    /**
     * Valid priority values for SharePoint Choice field
     * @constant {string[]}
     */
    const VALID_PRIORITIES = ['1', '2', '3', '4', '5'];

    /* ======================================================================
       APPLICATION STATE
       ====================================================================== */

    /**
     * Centralized application state
     * Maintains all mutable data in a single location for predictability
     */
    const AppState = {
        /** @type {Object|null} Current company configuration from COMPANY_CONFIG */
        currentCompany: null,

        /** @type {Object|null} Current site configuration within the company */
        currentSite: null,

        /** @type {string} KML data from the map widget */
        currentKmlData: '',

        /** @type {Array<Object>} Files added for upload with status tracking */
        uploadedFiles: [],

        /** @type {boolean} Prevents duplicate submissions */
        isSubmitting: false,

        /** @type {string} Current request type: 'single' or 'repeat' */
        requestType: 'single',

        /** @type {Array<Object>} Selected repeat missions with comments */
        repeatMissionRows: []
    };

    /* ======================================================================
       DOM ELEMENT CACHE
       ====================================================================== */

    /**
     * Cached DOM element references
     * Improves performance by avoiding repeated querySelector calls
     */
    const DOMCache = {
        form: null,
        submitBtn: null,
        siteSelection: null,
        siteArea: null,
        mapFrame: null,

        /**
         * Initializes the DOM cache
         * Should be called after DOMContentLoaded
         */
        init() {
            this.form = document.getElementById('missionForm');
            this.submitBtn = document.getElementById('submitBtn');
            this.siteSelection = document.getElementById('siteSelection');
            this.siteArea = document.getElementById('siteArea');
            this.mapFrame = document.getElementById('mapWidgetFrame');
        }
    };

    /* ======================================================================
       UTILITY FUNCTIONS
       ====================================================================== */

    /**
     * Safely retrieves the value of a form field
     * @param {string} fieldName - The name attribute of the form field
     * @param {string} [defaultValue=''] - Value to return if field is not found
     * @returns {string} The field value or default
     */
    function getFieldValue(fieldName, defaultValue = '') {
        const field = DOMCache.form?.elements[fieldName];
        return field ? field.value : defaultValue;
    }

    /**
     * Formats a date string to YYMMDD format for mission titles
     * @param {string} dateStr - ISO date string (YYYY-MM-DD)
     * @returns {string} Formatted date (YYMMDD)
     */
    function formatDateYYMMDD(dateStr) {
        const date = new Date(dateStr);
        const yy = date.getFullYear().toString().slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yy}${mm}${dd}`;
    }

    /**
     * Formats file size in human-readable format
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size (e.g., "1.5 MB")
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    /**
     * Validates an email address format
     * @param {string} email - Email address to validate
     * @returns {boolean} True if valid email format
     */
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Generates a unique reference ID for mission tracking
     * @returns {string} Reference ID (e.g., "MR-ABC123")
     */
    function generateReferenceId() {
        return `MR-${Date.now().toString(36).toUpperCase()}`;
    }

    /* ======================================================================
       MAP WIDGET COMMUNICATION
       ====================================================================== */

    /**
     * Sends a message to the embedded map widget iframe
     * Uses postMessage for cross-origin communication
     *
     * @param {string} type - Message type identifier
     * @param {Object} [data={}] - Additional data to send
     */
    function sendToMapWidget(type, data = {}) {
        const frame = DOMCache.mapFrame;
        if (frame?.contentWindow) {
            frame.contentWindow.postMessage(
                JSON.stringify({ type, ...data }),
                '*'
            );
        }
    }

    /**
     * Sets up the message listener for map widget communication
     * Handles KML data updates and widget ready events
     */
    function setupMapWidgetListener() {
        window.addEventListener('message', function(event) {
            try {
                const data = typeof event.data === 'string'
                    ? JSON.parse(event.data)
                    : event.data;

                switch (data.type) {
                    case 'kmlData':
                        // Store KML data from map drawings
                        AppState.currentKmlData = data.kml || '';
                        const kmlInput = document.getElementById('kmlData');
                        if (kmlInput) {
                            kmlInput.value = AppState.currentKmlData;
                        }
                        console.log('KML data received:', AppState.currentKmlData ? 'Yes' : 'No');
                        break;

                    case 'widgetReady':
                        // Map widget is ready, send current site if selected
                        if (DOMCache.siteSelection?.value) {
                            sendToMapWidget('changeSite', { site: DOMCache.siteSelection.value });
                        }
                        break;
                }
            } catch (err) {
                // Silently ignore parsing errors from unrelated messages
            }
        });
    }

    /* ======================================================================
       INITIALIZATION
       ====================================================================== */

    /**
     * Main initialization function
     * Sets up the entire application after DOM is ready
     */
    function init() {
        // Cache DOM elements
        DOMCache.init();

        // Initialize EmailJS with public key
        if (EMAILJS_CONFIG.publicKey && EMAILJS_CONFIG.publicKey !== 'YOUR_PUBLIC_KEY') {
            emailjs.init(EMAILJS_CONFIG.publicKey);
        }

        // Parse company from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const companyKey = urlParams.get('company');

        // Validate company parameter
        if (!companyKey || !COMPANY_CONFIG[companyKey]) {
            showInvalidCompany();
            return;
        }

        // Initialize company state
        AppState.currentCompany = COMPANY_CONFIG[companyKey];
        document.getElementById('companyId').value = companyKey;

        // Set company branding in header
        setupCompanyBranding();

        // Populate form options and attach event handlers
        populateSites();
        setupEventListeners();
        setupMapWidgetListener();
        setDefaultDate();

        console.log('Mission Request Portal initialized for:', AppState.currentCompany.displayName);
    }

    /**
     * Displays company logo or name in the header badge
     */
    function setupCompanyBranding() {
        const companyBadge = document.getElementById('companyBadge');
        if (!companyBadge) return;

        if (AppState.currentCompany.logo) {
            companyBadge.innerHTML = `<img src="${AppState.currentCompany.logo}" alt="${AppState.currentCompany.displayName}" class="company-logo">`;
        } else {
            companyBadge.textContent = AppState.currentCompany.displayName;
        }
    }

    /**
     * Shows the invalid company error message
     * Hides the main form content
     */
    function showInvalidCompany() {
        const mainContent = document.getElementById('mainContent');
        const invalidMessage = document.getElementById('invalidCompany');

        if (mainContent) mainContent.style.display = 'none';
        if (invalidMessage) invalidMessage.style.display = 'flex';
    }

    /**
     * Populates the site selection dropdown with company's sites
     */
    function populateSites() {
        const siteSelect = DOMCache.siteSelection;
        if (!siteSelect) return;

        siteSelect.innerHTML = '<option value="">Select a site...</option>';

        Object.entries(AppState.currentCompany.sites).forEach(([siteKey, site]) => {
            const option = document.createElement('option');
            option.value = siteKey;
            option.textContent = site.name;
            siteSelect.appendChild(option);
        });
    }

    /**
     * Populates the site area dropdown based on selected site
     * @param {string} siteKey - The selected site identifier
     */
    function populateSiteAreas(siteKey) {
        const areaSelect = DOMCache.siteArea;
        if (!areaSelect) return;

        areaSelect.innerHTML = '<option value="">Select area...</option>';

        if (!siteKey || !AppState.currentCompany.sites[siteKey]) {
            areaSelect.innerHTML = '<option value="">Select site first...</option>';
            return;
        }

        const site = AppState.currentCompany.sites[siteKey];
        site.areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area;
            option.textContent = area;
            areaSelect.appendChild(option);
        });
    }

    /**
     * Sets today's date as default and minimum for date fields
     */
    function setDefaultDate() {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Single request date field
        const missionDate = document.getElementById('missionDate');
        if (missionDate) {
            missionDate.value = todayStr;
            missionDate.min = todayStr;
        }

        // Repeat mission date field
        const repeatMissionDate = document.getElementById('repeatMissionDate');
        if (repeatMissionDate) {
            repeatMissionDate.value = todayStr;
            repeatMissionDate.min = todayStr;
        }
    }

    /* ======================================================================
       REQUEST TYPE HANDLING
       ====================================================================== */

    /**
     * Handles switching between single request and repeat mission modes
     * Toggles form sections visibility and updates field requirements
     *
     * @param {string} type - 'single' or 'repeat'
     */
    function handleRequestTypeChange(type) {
        console.log('Request type changed to:', type);
        AppState.requestType = type;

        // DOM elements for section toggling
        const sections = {
            singleRequest: document.getElementById('singleRequestSections'),
            repeatMission: document.getElementById('repeatMissionSection'),
            singleContact: document.getElementById('singleContactSection'),
            singleAttachments: document.getElementById('singleAttachmentsSection')
        };

        // Field elements for requirement toggling
        const singleFields = {
            siteArea: document.getElementById('siteArea'),
            missionName: document.getElementById('missionName'),
            missionType: document.getElementById('missionType'),
            missionDate: document.getElementById('missionDate'),
            missionPriority: document.getElementById('missionPriority'),
            submitterName: document.getElementById('submitterName'),
            submitterEmail: document.getElementById('submitterEmail')
        };

        const repeatFields = {
            date: document.getElementById('repeatMissionDate'),
            priority: document.getElementById('repeatMissionPriority'),
            name: document.getElementById('repeatSubmitterName'),
            email: document.getElementById('repeatSubmitterEmail')
        };

        if (type === 'single') {
            // Show single request sections
            toggleSection(sections.singleRequest, true);
            toggleSection(sections.repeatMission, false);
            toggleSection(sections.singleContact, true);
            toggleSection(sections.singleAttachments, true);

            // Enable single request field requirements
            setFieldsRequired(singleFields, true);
            setFieldsRequired(repeatFields, false);

        } else {
            // Show repeat mission section
            toggleSection(sections.singleRequest, false);
            toggleSection(sections.repeatMission, true);
            toggleSection(sections.singleContact, false);
            toggleSection(sections.singleAttachments, false);

            // Enable repeat mission field requirements
            setFieldsRequired(singleFields, false);
            setFieldsRequired(repeatFields, true);

            // Initialize with one empty row if none exist
            if (AppState.repeatMissionRows.length === 0) {
                addRepeatMissionRow();
            }
        }
    }

    /**
     * Toggles a section's visibility
     * @param {HTMLElement} section - Section element to toggle
     * @param {boolean} show - Whether to show or hide
     */
    function toggleSection(section, show) {
        if (!section) return;
        section.style.display = show ? 'block' : 'none';
        section.classList.toggle('hidden-section', !show);
    }

    /**
     * Sets required attribute on multiple fields
     * @param {Object} fields - Object with field name keys and element values
     * @param {boolean} required - Whether fields should be required
     */
    function setFieldsRequired(fields, required) {
        Object.values(fields).forEach(field => {
            if (field) field.required = required;
        });
    }

    /**
     * Gets repeat missions available for a specific site
     * @param {string} siteKey - Site identifier
     * @returns {Array} Array of repeat mission configurations
     */
    function getRepeatMissionsForSite(siteKey) {
        if (!AppState.currentCompany?.sites[siteKey]) {
            return [];
        }
        return AppState.currentCompany.sites[siteKey].repeatMissions || [];
    }

    /**
     * Adds a new row to the repeat missions table
     */
    function addRepeatMissionRow() {
        const siteKey = DOMCache.siteSelection?.value;
        const missions = getRepeatMissionsForSite(siteKey);

        if (missions.length === 0) {
            alert('No repeat missions configured for this site.');
            return;
        }

        AppState.repeatMissionRows.push({ mission: null, comment: '' });
        renderRepeatMissionsTable();
    }

    /**
     * Removes a row from the repeat missions table
     * @param {number} index - Row index to remove
     */
    function removeRepeatMissionRow(index) {
        if (AppState.repeatMissionRows.length > 1) {
            AppState.repeatMissionRows.splice(index, 1);
            renderRepeatMissionsTable();
        }
    }

    /**
     * Updates a field in a repeat mission row
     * @param {number} index - Row index
     * @param {string} field - Field name ('mission' or 'comment')
     * @param {*} value - New value
     */
    function updateRepeatMissionRow(index, field, value) {
        if (AppState.repeatMissionRows[index]) {
            AppState.repeatMissionRows[index][field] = value;
        }
    }

    /**
     * Renders the repeat missions table with current state
     * Dynamically generates table rows with dropdowns and inputs
     */
    function renderRepeatMissionsTable() {
        const container = document.getElementById('repeatMissionsTableBody');
        if (!container) return;

        const siteKey = DOMCache.siteSelection?.value;
        const missions = getRepeatMissionsForSite(siteKey);

        container.innerHTML = '';

        AppState.repeatMissionRows.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.className = 'repeat-mission-row';

            // Mission dropdown cell
            const missionCell = document.createElement('td');
            const missionSelect = document.createElement('select');
            missionSelect.className = 'repeat-mission-select';
            missionSelect.innerHTML = '<option value="">Select mission...</option>';

            missions.forEach(mission => {
                const option = document.createElement('option');
                option.value = JSON.stringify(mission);
                option.textContent = mission.display;
                if (row.mission?.sharepoint === mission.sharepoint) {
                    option.selected = true;
                }
                missionSelect.appendChild(option);
            });

            missionSelect.addEventListener('change', (e) => {
                const selectedMission = e.target.value ? JSON.parse(e.target.value) : null;
                updateRepeatMissionRow(index, 'mission', selectedMission);
            });
            missionCell.appendChild(missionSelect);

            // Comment input cell
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

            if (AppState.repeatMissionRows.length > 1) {
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

    /* ======================================================================
       EVENT LISTENERS
       ====================================================================== */

    /**
     * Sets up all event listeners for the form
     */
    function setupEventListeners() {
        // Site selection change
        DOMCache.siteSelection?.addEventListener('change', handleSiteChange);

        // Custom parameters toggle
        document.getElementById('customParams')?.addEventListener('change', (e) => {
            const paramsSection = document.getElementById('paramsSection');
            if (paramsSection) {
                paramsSection.style.display = e.target.checked ? 'grid' : 'none';
            }
        });

        // Frequency type toggle (Once-off vs Repeating)
        document.querySelectorAll('input[name="frequencyType"]').forEach(radio => {
            radio.addEventListener('change', handleFrequencyChange);
        });

        // Request type toggle (Single vs Repeat Missions)
        document.querySelectorAll('input[name="requestType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                handleRequestTypeChange(e.target.value);
            });
        });

        // Add repeat mission row button
        document.getElementById('addRepeatMissionRow')?.addEventListener('click', addRepeatMissionRow);

        // File upload setup
        setupFileUpload();

        // Form submission
        DOMCache.form?.addEventListener('submit', handleSubmit);
    }

    /**
     * Handles site selection change
     * Updates areas, map widget, and repeat mission availability
     *
     * @param {Event} event - Change event
     */
    function handleSiteChange(event) {
        const siteKey = event.target.value;
        populateSiteAreas(siteKey);

        if (siteKey) {
            AppState.currentSite = AppState.currentCompany.sites[siteKey];
            sendToMapWidget('changeSite', { site: siteKey });

            // Check repeat mission availability
            const missions = getRepeatMissionsForSite(siteKey);
            const repeatOption = document.getElementById('repeatMission');

            if (repeatOption) {
                const hasRepeatMissions = missions.length > 0;
                repeatOption.disabled = !hasRepeatMissions;
                repeatOption.parentElement.style.opacity = hasRepeatMissions ? '1' : '0.5';
                repeatOption.parentElement.title = hasRepeatMissions
                    ? ''
                    : 'No repeat missions configured for this site';

                // Switch to single if on repeat with no missions available
                if (!hasRepeatMissions && AppState.requestType === 'repeat') {
                    document.getElementById('singleRequest').checked = true;
                    handleRequestTypeChange('single');
                }
            }

            // Reset repeat mission rows when site changes
            AppState.repeatMissionRows = [];
            if (AppState.requestType === 'repeat') {
                addRepeatMissionRow();
            }
        }
    }

    /**
     * Handles frequency type change (Once-off vs Repeating)
     * @param {Event} event - Change event
     */
    function handleFrequencyChange(event) {
        const isRepeating = event.target.value === 'Repeating';
        const repeatingOptions = document.getElementById('repeatingOptions');
        const repeatFrequency = document.getElementById('repeatFrequency');

        if (repeatingOptions) {
            repeatingOptions.style.display = isRepeating ? 'block' : 'none';
        }
        if (repeatFrequency) {
            repeatFrequency.required = isRepeating;
            if (!isRepeating) repeatFrequency.value = '';
        }
    }

    /* ======================================================================
       FILE UPLOAD HANDLING
       ====================================================================== */

    /**
     * Converts a File object to base64 string
     * @param {File} file - File to convert
     * @returns {Promise<string>} Base64 encoded content (without data URL prefix)
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = (error) => {
                console.error('Error reading file:', error);
                reject(error);
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Uploads a file to SharePoint via Power Automate HTTP trigger
     *
     * @param {string} fileName - Name of the file
     * @param {string} base64Content - Base64 encoded file content
     * @param {string} missionRef - Mission reference for folder organization
     * @param {string} fileType - MIME type of the file
     * @returns {Promise<Object>} Upload result with fileId and webUrl
     */
    async function uploadFileToPowerAutomate(fileName, base64Content, missionRef, fileType) {
        if (!FILE_UPLOAD_ENDPOINT || FILE_UPLOAD_ENDPOINT === 'YOUR_POWER_AUTOMATE_HTTP_URL') {
            throw new Error('File upload endpoint not configured');
        }

        const response = await fetch(FILE_UPLOAD_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName,
                fileContent: base64Content,
                missionRef,
                fileType
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Upload failed: ${response.status} - ${errorText}`);
        }

        return response.json();
    }

    /**
     * Sets up file upload areas for both single and repeat modes
     */
    function setupFileUpload() {
        setupSingleFileUploadArea('fileUploadArea', 'fileInput');
        setupSingleFileUploadArea('repeatFileUploadArea', 'repeatFileInput', 'repeat');
    }

    /**
     * Configures a single file upload area with drag-and-drop
     *
     * @param {string} areaId - ID of the upload area element
     * @param {string} inputId - ID of the file input element
     * @param {string} [mode='single'] - Upload mode for rendering
     */
    function setupSingleFileUploadArea(areaId, inputId, mode = 'single') {
        const uploadArea = document.getElementById(areaId);
        const fileInput = document.getElementById(inputId);

        if (!uploadArea || !fileInput) return;

        // Click to open file dialog
        uploadArea.addEventListener('click', () => fileInput.click());

        // Drag and drop handlers
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
            handleFiles(e.dataTransfer.files, mode);
        });

        // File input change handler
        fileInput.addEventListener('change', (e) => {
            handleFiles(e.target.files, mode);
        });
    }

    /**
     * Processes uploaded files - validates, converts, and uploads to SharePoint
     *
     * @param {FileList} files - Files from input or drop
     * @param {string} [mode='single'] - Upload mode for rendering
     */
    async function handleFiles(files, mode = 'single') {
        const missionRef = generateReferenceId();

        for (const file of Array.from(files)) {
            // Skip duplicates
            if (AppState.uploadedFiles.some(f => f.name === file.name)) {
                console.log(`File ${file.name} already added`);
                continue;
            }

            // Validate file size
            if (file.size > MAX_FILE_SIZE_BYTES) {
                alert(`File "${file.name}" is too large. Maximum size is 100MB per file.`);
                continue;
            }

            // Add file with uploading status
            const tempFile = {
                name: file.name,
                size: file.size,
                type: file.type,
                status: 'uploading',
                originalFile: file
            };
            AppState.uploadedFiles.push(tempFile);
            renderFileList(mode);

            try {
                console.log(`Uploading ${file.name} to SharePoint...`);

                const base64Content = await fileToBase64(file);
                const uploadResult = await uploadFileToPowerAutomate(
                    file.name,
                    base64Content,
                    missionRef,
                    file.type
                );

                // Update file with success status
                const fileIndex = AppState.uploadedFiles.findIndex(
                    f => f.name === file.name && f.status === 'uploading'
                );
                if (fileIndex !== -1) {
                    AppState.uploadedFiles[fileIndex] = {
                        ...AppState.uploadedFiles[fileIndex],
                        status: 'uploaded',
                        fileId: uploadResult.fileId,
                        webUrl: uploadResult.webUrl,
                        missionRef: uploadResult.missionRef
                    };
                }

                console.log(`✅ ${file.name} uploaded successfully`);

            } catch (error) {
                console.error(`Failed to upload file ${file.name}:`, error);

                // Update file with error status
                const fileIndex = AppState.uploadedFiles.findIndex(
                    f => f.name === file.name && f.status === 'uploading'
                );
                if (fileIndex !== -1) {
                    AppState.uploadedFiles[fileIndex].status = 'error';
                    AppState.uploadedFiles[fileIndex].error = error.message;
                }

                alert(`Failed to upload "${file.name}": ${error.message}`);
            }

            renderFileList(mode);
        }
    }

    /**
     * Renders the file list UI with status indicators
     * Updates both single and repeat file list elements
     *
     * @param {string} [mode='single'] - Current upload mode
     */
    function renderFileList(mode = 'single') {
        const fileLists = ['fileList', 'repeatFileList'];

        fileLists.forEach(listId => {
            const fileList = document.getElementById(listId);
            if (!fileList) return;

            fileList.innerHTML = '';

            AppState.uploadedFiles.forEach((file, index) => {
                const item = document.createElement('div');
                item.className = `file-item ${file.status || ''}`;

                // Status indicator
                let statusIcon = '';
                switch (file.status) {
                    case 'uploaded':
                        statusIcon = '<span style="color: var(--green); font-size: 14px; margin-left: 8px;" title="Uploaded successfully">✓</span>';
                        break;
                    case 'error':
                        statusIcon = '<span style="color: var(--red); font-size: 14px; margin-left: 8px;" title="Upload failed">✗</span>';
                        break;
                    case 'uploading':
                        statusIcon = '<span style="color: var(--cyan); font-size: 12px; margin-left: 8px;">Uploading...</span>';
                        break;
                }

                item.innerHTML = `
                    <div class="file-item-info">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                        </svg>
                        <span class="file-item-name">${file.name}</span>
                        <span class="file-item-size">${formatFileSize(file.size)}</span>
                        ${statusIcon}
                    </div>
                    ${file.status !== 'uploading' ? `
                        <button type="button" class="file-item-remove" data-index="${index}" title="Remove file">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 6L6 18M6 6l12 12"/>
                            </svg>
                        </button>
                    ` : ''}
                `;
                fileList.appendChild(item);
            });
        });

        // Attach remove handlers
        document.querySelectorAll('.file-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                AppState.uploadedFiles.splice(index, 1);
                renderFileList();
            });
        });
    }

    /* ======================================================================
       FORM VALIDATION
       ====================================================================== */

    /**
     * Validates the form based on current request type
     * @throws {Error} Validation error with descriptive message
     */
    function validateForm() {
        if (AppState.requestType === 'repeat') {
            validateRepeatMissionForm();
        } else {
            validateSingleRequestForm();
        }
    }

    /**
     * Validates the repeat mission form fields
     * @throws {Error} Validation error with descriptive message
     */
    function validateRepeatMissionForm() {
        // Site selection
        if (!DOMCache.siteSelection?.value) {
            throw new Error('Please select a site');
        }

        // At least one mission selected
        const validMissions = AppState.repeatMissionRows.filter(
            row => row.mission?.sharepoint
        );
        if (validMissions.length === 0) {
            throw new Error('Please select at least one repeat mission');
        }

        // Date validation
        const repeatDate = document.getElementById('repeatMissionDate');
        if (!repeatDate?.value) {
            throw new Error('Please select a mission date');
        }

        const selectedDate = new Date(repeatDate.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
            throw new Error('Scheduled date cannot be in the past');
        }

        // Priority validation
        const repeatPriority = document.getElementById('repeatMissionPriority');
        if (!repeatPriority?.value || !VALID_PRIORITIES.includes(repeatPriority.value)) {
            throw new Error('Please select a valid priority (1-5)');
        }

        // Contact info validation
        const repeatName = document.getElementById('repeatSubmitterName');
        const repeatEmail = document.getElementById('repeatSubmitterEmail');

        if (!repeatName?.value) {
            throw new Error('Your name is required');
        }
        if (!repeatEmail?.value) {
            throw new Error('Email is required');
        }
        if (!isValidEmail(repeatEmail.value)) {
            throw new Error('Please enter a valid email address');
        }
    }

    /**
     * Validates the single request form fields
     * @throws {Error} Validation error with descriptive message
     */
    function validateSingleRequestForm() {
        // HTML5 validation
        if (!DOMCache.form.checkValidity()) {
            const invalidField = DOMCache.form.querySelector(':invalid');
            if (invalidField) {
                invalidField.focus();
                invalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            throw new Error('Please fill in all required fields correctly.');
        }

        // Date validation
        const missionDate = document.getElementById('missionDate')?.value;
        const selectedDate = new Date(missionDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate < today) {
            document.getElementById('missionDate')?.focus();
            throw new Error('Scheduled date cannot be in the past');
        }

        // Custom parameters validation
        if (document.getElementById('customParams')?.checked) {
            validateCustomParameters();
        }

        // Email format validation
        const email = document.getElementById('submitterEmail')?.value;
        if (email && !isValidEmail(email)) {
            document.getElementById('submitterEmail')?.focus();
            throw new Error('Please enter a valid email address');
        }
    }

    /**
     * Validates custom flight parameters if enabled
     * @throws {Error} Validation error with descriptive message
     */
    function validateCustomParameters() {
        const resolution = document.getElementById('imageResolution')?.value;
        if (resolution && (resolution < 0.5 || resolution > 20)) {
            document.getElementById('imageResolution')?.focus();
            throw new Error('Image Resolution must be between 0.5 and 20 cm/px');
        }

        const height = document.getElementById('missionHeight')?.value;
        if (height && (height < 30 || height > 400)) {
            document.getElementById('missionHeight')?.focus();
            throw new Error('Mission Height must be between 30 and 400 meters');
        }

        const forwardOverlap = document.getElementById('overlapForward')?.value;
        if (forwardOverlap && (forwardOverlap < 50 || forwardOverlap > 95)) {
            document.getElementById('overlapForward')?.focus();
            throw new Error('Forward Overlap must be between 50% and 95%');
        }

        const sideOverlap = document.getElementById('overlapSide')?.value;
        if (sideOverlap && (sideOverlap < 50 || sideOverlap > 95)) {
            document.getElementById('overlapSide')?.focus();
            throw new Error('Side Overlap must be between 50% and 95%');
        }
    }

    /* ======================================================================
       DATA COLLECTION
       ====================================================================== */

    /**
     * Collects and structures form data for submission
     * @returns {Object} Structured form data ready for EmailJS
     * @throws {Error} If validation fails
     */
    function collectFormData() {
        const form = DOMCache.form;
        const siteName = AppState.currentSite?.name || form.siteSelection.value;
        const hasAttachments = Boolean(
            AppState.uploadedFiles.length > 0 ||
            (AppState.currentKmlData && AppState.currentKmlData.length > 0)
        );

        if (AppState.requestType === 'repeat') {
            return collectRepeatMissionData(siteName, hasAttachments);
        }
        return collectSingleRequestData(form, siteName, hasAttachments);
    }

    /**
     * Collects data for repeat mission submission
     *
     * @param {string} siteName - Name of the selected site
     * @param {boolean} hasAttachments - Whether files or KML are attached
     * @returns {Object} Structured repeat mission data
     */
    function collectRepeatMissionData(siteName, hasAttachments) {
        const validMissions = AppState.repeatMissionRows.filter(
            row => row.mission?.sharepoint
        );

        if (validMissions.length === 0) {
            throw new Error('Please select at least one repeat mission');
        }

        const repeatDate = document.getElementById('repeatMissionDate');
        const repeatName = document.getElementById('repeatSubmitterName');
        const repeatEmail = document.getElementById('repeatSubmitterEmail');
        const repeatPhone = document.getElementById('repeatContactNumber');
        const repeatPriority = document.getElementById('repeatMissionPriority');

        const dateFormatted = formatDateYYMMDD(repeatDate.value);

        return {
            RequestType: 'Repeat Mission',
            Title: `${dateFormatted} ${getFieldValue('siteSelection')} Repeat Missions (${validMissions.length})`.trim(),
            ScheduledDate: repeatDate?.value || '',
            Company: AppState.currentCompany.name,
            Site: siteName,
            SiteKey: getFieldValue('siteSelection'),
            Priority: repeatPriority?.value || '3',
            RequestedBy: repeatName?.value || '',
            EmailContact: repeatEmail?.value || '',
            PhContact: repeatPhone?.value || '',
            Attachment: hasAttachments,
            AttachmentNames: AppState.uploadedFiles.map(f => f.name).join(', ') || 'None',
            SubmittedAt: new Date().toISOString(),
            HasKML: Boolean(AppState.currentKmlData?.length > 0),
            KMLContent: AppState.currentKmlData || '',
            UploadedFileRefs: getUploadedFileRefs(),
            RepeatMissions: validMissions.map((row, index) => ({
                Title: row.mission.sharepoint,
                MissionName: row.mission.sharepoint,
                DisplayName: row.mission.display,
                Comment: row.comment || '',
                SiteOrder: index + 1,
                Dock: row.mission.dock || '',
                PlannedFlightTime: row.mission.plannedFlightTime || null,
                MissionPlan: 'New Request',
                JobStatus: 'Incomplete',
                MissionType: row.mission.missionType || 'Survey'
            }))
        };
    }

    /**
     * Collects data for single request submission
     *
     * @param {HTMLFormElement} form - The form element
     * @param {string} siteName - Name of the selected site
     * @param {boolean} hasAttachments - Whether files or KML are attached
     * @returns {Object} Structured single request data
     */
    function collectSingleRequestData(form, siteName, hasAttachments) {
        const dateFormatted = formatDateYYMMDD(form.missionDate.value);
        const frequencyType = document.querySelector('input[name="frequencyType"]:checked');
        const isRepeating = frequencyType?.value === 'Repeating';

        let frequency = 'Once';
        if (isRepeating && form.repeatFrequency?.value) {
            frequency = form.repeatFrequency.value;
        }

        // Normalize mission type for SharePoint
        const missionTypeVal = (form.missionType.value || '').trim();
        const missionTypeMap = {
            'Survey - Nadir (standard mapping survey)': 'Survey',
            'Survey - Oblique': 'Survey',
            'Inspection': 'Inspection',
            'Panorama': 'Panoramic',
            'Stockpile': 'Stockpile',
            'Progress Monitoring': 'Progress Monitoring'
        };
        const missionTypeForForm = missionTypeMap[missionTypeVal] || missionTypeVal || 'Other';

        const hasCustomParams = form.customParams?.checked;

        const data = {
            RequestType: 'Single Request',
            Title: `${dateFormatted} ${getFieldValue('siteSelection')} ${getFieldValue('siteArea')} ${getFieldValue('missionName')}`.trim(),
            ScheduledDate: getFieldValue('missionDate'),
            Company: AppState.currentCompany.name,
            Site: siteName,
            Priority: getFieldValue('missionPriority') || '3',
            MissionType: missionTypeForForm,
            Frequency: frequency,
            MissionPlan: 'New Request',
            JobStatus: 'Incomplete',
            Comments: getFieldValue('missionName'),
            CustomerComments: getFieldValue('customerComment'),
            RequestedBy: getFieldValue('submitterName'),
            EmailContact: getFieldValue('submitterEmail'),
            PhContact: getFieldValue('contactNumber'),
            Attachment: hasAttachments,
            CustomerParameters: Boolean(hasCustomParams),
            SiteArea: getFieldValue('siteArea'),
            SiteKey: getFieldValue('siteSelection'),
            SubmittedAt: new Date().toISOString(),
            AttachmentNames: AppState.uploadedFiles.map(f => f.name).join(', ') || 'None',
            HasKML: Boolean(AppState.currentKmlData?.length > 0),
            KMLContent: AppState.currentKmlData || '',
            UploadedFileRefs: getUploadedFileRefs()
        };

        // Add custom parameters if enabled
        if (hasCustomParams) {
            const resolution = getFieldValue('imageResolution');
            const height = getFieldValue('missionHeight');
            const sideOverlap = getFieldValue('overlapSide');
            const forwardOverlap = getFieldValue('overlapForward');

            if (resolution) data.Resolution = parseFloat(resolution);
            if (height) data.HeightAGL = parseInt(height);
            if (sideOverlap) data.SideOverlap = parseInt(sideOverlap);
            if (forwardOverlap) data.ForwardOverlap = parseInt(forwardOverlap);
            data.TerrainFollow = getFieldValue('terrainFollowing');
            data.ElevOpt = getFieldValue('elevationOptimisation');
        }

        // Remove empty values for cleaner JSON
        Object.keys(data).forEach(key => {
            if (data[key] === null || data[key] === undefined || data[key] === '') {
                delete data[key];
            }
        });

        return data;
    }

    /**
     * Gets references to successfully uploaded files
     * @returns {Array<Object>} Array of file reference objects
     */
    function getUploadedFileRefs() {
        return AppState.uploadedFiles
            .filter(f => f.status === 'uploaded')
            .map(f => ({
                name: f.name,
                fileId: f.fileId,
                webUrl: f.webUrl,
                missionRef: f.missionRef
            }));
    }

    /* ======================================================================
       FORM SUBMISSION
       ====================================================================== */

    /**
     * Handles form submission
     * Validates, collects data, and sends via EmailJS
     *
     * @param {Event} event - Submit event
     */
    async function handleSubmit(event) {
        event.preventDefault();

        // Prevent double submission
        if (AppState.isSubmitting) return;

        // Require site selection
        if (!DOMCache.siteSelection?.value) {
            alert('Please select a site.');
            return;
        }

        // Verify EmailJS configuration
        if (!EMAILJS_CONFIG.publicKey || EMAILJS_CONFIG.publicKey === 'YOUR_PUBLIC_KEY') {
            alert('EmailJS is not configured. Please update EMAILJS_CONFIG in config.js');
            return;
        }

        AppState.isSubmitting = true;
        setSubmitButtonLoading(true);

        try {
            validateForm();
            const formData = collectFormData();
            console.log('Form data collected:', formData);

            await sendViaEmailJS(formData);

            // Show success modal with mission title
            document.getElementById('missionId').textContent = formData.Title;
            document.getElementById('successModal').style.display = 'flex';

        } catch (error) {
            console.error('Submission error:', error);
            document.getElementById('errorMessage').textContent =
                error.message || 'An error occurred while submitting your request.';
            document.getElementById('errorModal').style.display = 'flex';

        } finally {
            setSubmitButtonLoading(false);
            AppState.isSubmitting = false;
        }
    }

    /**
     * Toggles submit button loading state
     * @param {boolean} loading - Whether to show loading state
     */
    function setSubmitButtonLoading(loading) {
        const submitBtn = DOMCache.submitBtn;
        if (!submitBtn) return;

        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');

        if (btnText) btnText.style.display = loading ? 'none' : 'inline';
        if (btnLoading) btnLoading.style.display = loading ? 'inline-flex' : 'none';
        submitBtn.disabled = loading;
    }

    /**
     * Sends form data via EmailJS
     *
     * @param {Object} formData - Collected form data
     * @returns {Promise<string>} Reference ID on success
     */
    async function sendViaEmailJS(formData) {
        const refId = generateReferenceId();
        const jsonData = JSON.stringify(formData, null, 2);

        // Build template parameters
        const templateParams = {
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
            request_type: formData.RequestType || 'Single Request',
            kml_content: formData.KMLContent || 'No KML data provided',
            has_kml: formData.HasKML ? 'Yes' : 'No',
            has_attachments: formData.Attachment ? 'Yes' : 'No'
        };

        // Add type-specific fields
        if (formData.RequestType === 'Repeat Mission') {
            templateParams.site_area = 'N/A';
            templateParams.mission_name = `${formData.RepeatMissions.length} repeat mission(s)`;
            templateParams.mission_type = 'Repeat';
            templateParams.priority = formData.Priority || '3';
            templateParams.repeat_missions = formData.RepeatMissions
                .map(m => m.DisplayName)
                .join(', ');
        } else {
            templateParams.site_area = formData.SiteArea;
            templateParams.mission_name = formData.Comments;
            templateParams.mission_type = formData.MissionType;
            templateParams.priority = formData.Priority;
        }

        console.log('Sending email via EmailJS...');
        console.log('Template params:', templateParams);

        const response = await emailjs.send(
            EMAILJS_CONFIG.serviceId,
            EMAILJS_CONFIG.templateId,
            templateParams
        );

        if (response.status !== 200) {
            throw new Error(`Email send failed with status: ${response.status}`);
        }

        console.log('Email sent successfully:', response);
        return refId;
    }

    /* ======================================================================
       INITIALIZATION ENTRY POINT
       ====================================================================== */

    // Initialize application when DOM is ready
    document.addEventListener('DOMContentLoaded', init);

})();
