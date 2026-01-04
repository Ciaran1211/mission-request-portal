// Main Application JavaScript
// Handles form logic, validation, file uploads, and API submission

(function() {
    'use strict';

    // Flight configurations for daily list
    const FLIGHT_CONFIG = {
        'Daily Panos': {
            missionType: 'Panorama',
            plannedFlightTime: 15,
            entries: [
                { name: 'Daily Panos 1', dock: 'Dock 3-i016-B (SOUTH)' },
                { name: 'Daily Panos 2', dock: 'Dock 3-i016-B (SOUTH)' },
                { name: 'Daily Panos 3', dock: 'Dock 3-I015-B (NORTH)' }
            ]
        },
        'PIT Coal 6': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 45,
            dock: 'Dock 3-S015-A (NORTH)'
        },
        'PIT Coal 8': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 50,
            dock: 'Dock 3-S015-A (NORTH)'
        },
        'PIT Coal 9': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 40,
            dock: 'Dock 3-i016-A (SOUTH)'
        },
        'PIT Coal 12': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 35,
            dock: 'Dock 3-i016-A (SOUTH)'
        },
        'PIT Coal 13-14': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 55,
            dock: 'Dock 3-i016-A (SOUTH)'
        },
        'PIT Coal 15': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 30,
            dock: 'Dock 3-i016-A (SOUTH)'
        },
        'PIT Coal 16': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 25,
            dock: 'Dock 3-i016-A (SOUTH)'
        },
        'PIT Coal 1A': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 40,
            dock: 'Dock 3-S015-A (NORTH)'
        },
        'PIT Coal 2-4': {
            missionType: 'Survey - Nadir',
            plannedFlightTime: 60,
            dock: 'Dock 3-S015-A (NORTH)'
        }
    };

    // State
    let uploadedFiles = [];
    let isSubmitting = false;

    // Initialize application
    function init() {
        setupEventListeners();
        setDefaultDate();
        initializeMap();
    }

    function initializeMap() {
        const siteSelect = document.getElementById('siteSelection');
        const initialSite = siteSelect.value || 'Saraji';
        MapWidget.init(initialSite);
    }

    function setupEventListeners() {
        // Request type toggle
        document.querySelectorAll('input[name="requestType"]').forEach(radio => {
            radio.addEventListener('change', handleRequestTypeChange);
        });

        // Site selection change
        document.getElementById('siteSelection').addEventListener('change', (e) => {
            MapWidget.updateSite(e.target.value);
        });

        // Custom parameters toggle
        document.getElementById('customParams').addEventListener('change', (e) => {
            document.getElementById('paramsSection').style.display = e.target.checked ? 'grid' : 'none';
        });

        // File upload
        setupFileUpload();

        // Form submission
        document.getElementById('missionForm').addEventListener('submit', handleSubmit);
    }

    function setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('missionDate').value = today;
    }

    function handleRequestTypeChange(e) {
        const isOnceOff = e.target.value === 'Once-off Request';
        document.getElementById('onceOffSection').style.display = isOnceOff ? 'block' : 'none';
        document.getElementById('dailyListSection').style.display = isOnceOff ? 'none' : 'block';

        // Update required fields
        document.getElementById('missionName').required = isOnceOff;
        document.getElementById('missionType').required = isOnceOff;
    }

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
        const requestType = document.querySelector('input[name="requestType"]:checked').value;
        const isOnceOff = requestType === 'Once-off Request';

        const baseData = {
            siteSelection: form.siteSelection.value,
            whereOnsite: form.whereOnsite.value,
            site: form.site.value,
            requestType: requestType,
            missionDate: form.missionDate.value,
            missionPriority: parseInt(form.missionPriority.value),
            howOften: form.howOften.value,
            submitterName: form.submitterName.value,
            submitterEmail: form.submitterEmail.value,
            contactNumber: form.contactNumber.value
        };

        if (isOnceOff) {
            // Once-off request
            const kmlData = MapWidget.generateKML();
            const dateFormatted = formatDateYYMMDD(form.missionDate.value);
            
            return {
                ...baseData,
                missionName: form.missionName.value,
                missionType: form.missionType.value,
                customerComment: form.customerComment.value,
                customParams: form.customParams.checked,
                imageResolution: form.imageResolution.value ? parseFloat(form.imageResolution.value) : null,
                missionHeight: form.missionHeight.value ? parseFloat(form.missionHeight.value) : null,
                overlapForward: form.overlapForward.value ? parseFloat(form.overlapForward.value) : null,
                overlapSide: form.overlapSide.value ? parseFloat(form.overlapSide.value) : null,
                terrainFollowing: form.terrainFollowing.value,
                elevationOptimisation: form.elevationOptimisation.value,
                kmlData: kmlData,
                title: `${dateFormatted} ${form.site.value} ${form.whereOnsite.value} ${form.missionName.value}`.trim(),
                siteOrder: 1,
                files: uploadedFiles
            };
        } else {
            // Daily flight list
            const selectedFlights = Array.from(document.querySelectorAll('input[name="dailyFlights"]:checked'))
                .map(cb => cb.value);

            // Expand flights with configuration
            const missions = [];
            let siteOrder = 0;

            selectedFlights.forEach(flightName => {
                const config = FLIGHT_CONFIG[flightName];
                if (!config) return;

                const dateFormatted = formatDateYYMMDD(form.missionDate.value);

                if (config.entries) {
                    // Multiple entries (e.g., Daily Panos)
                    config.entries.forEach(entry => {
                        siteOrder++;
                        missions.push({
                            ...baseData,
                            taskName: entry.name,
                            missionType: config.missionType,
                            plannedFlightTime: config.plannedFlightTime,
                            dock: entry.dock,
                            title: `${dateFormatted} ${form.site.value} ${form.whereOnsite.value} ${entry.name}`.trim(),
                            siteOrder: siteOrder
                        });
                    });
                } else {
                    // Single entry
                    siteOrder++;
                    missions.push({
                        ...baseData,
                        taskName: flightName,
                        missionType: config.missionType,
                        plannedFlightTime: config.plannedFlightTime,
                        dock: config.dock,
                        title: `${dateFormatted} ${form.site.value} ${form.whereOnsite.value} ${flightName}`.trim(),
                        siteOrder: siteOrder
                    });
                }
            });

            return {
                requestType: 'Repeated Task List',
                missions: missions,
                files: uploadedFiles
            };
        }
    }

    async function submitToApi(formData) {
        // Convert files to base64
        const filesBase64 = await Promise.all(
            (formData.files || []).map(async file => ({
                name: file.name,
                type: file.type,
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
