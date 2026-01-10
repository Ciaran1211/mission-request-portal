/**
 * Map Widget for Mission Request Portal
 * ======================================
 * 
 * Interactive map component for drawing mission areas using OpenLayers.
 * Supports polygon, rectangle, circle, line, and point geometries.
 * Generates KML output for mission planning systems.
 * 
 * Features:
 * - Multiple drawing tools with undo support
 * - Layer switching (OSM, Satellite, Ortho)
 * - Fullscreen mode
 * - KML export and download
 * - Parent window communication via postMessage
 * 
 * Dependencies:
 * - OpenLayers 8.2.0 (loaded via CDN in map-widget.html)
 * 
 * @module MapWidget
 * @version 2.0.0
 * @author RocketDNA Development Team
 */

const MapWidget = (function() {
    'use strict';

    /* ======================================================================
       CONSTANTS
       ====================================================================== */

    /**
     * Default map styling for drawn features
     * @constant {Object}
     */
    const DRAW_STYLE = {
        fillColor: 'rgba(10, 186, 239, 0.2)',
        strokeColor: '#0ABAEF',
        strokeWidth: 2,
        pointRadius: 6,
        pointFillColor: '#0ABAEF',
        pointStrokeColor: '#fff',
        pointStrokeWidth: 2
    };

    /**
     * KML export style (orange/yellow for visibility)
     * @constant {Object}
     */
    const KML_STYLE = {
        fillColor: [239, 186, 10, 0.3],
        strokeColor: [239, 186, 10, 1],
        strokeWidth: 2
    };

    /* ======================================================================
       STATE MANAGEMENT
       ====================================================================== */

    /**
     * Module state container
     * Centralized storage for all mutable state
     */
    const State = {
        /** @type {ol.Map|null} OpenLayers map instance */
        map: null,
        
        /** @type {ol.source.Vector|null} Vector source for drawn features */
        drawSource: null,
        
        /** @type {ol.interaction.Draw|null} Current drawing interaction */
        drawInteraction: null,
        
        /** @type {Array<ol.Feature>} History of drawn features for undo */
        featureHistory: [],
        
        /** @type {Object|null} Current site configuration */
        currentConfig: null,
        
        /** @type {ol.layer.Tile|null} Ortho imagery layer */
        orthoLayer: null,
        
        /** @type {boolean} Initialization flag */
        initialized: false
    };

    /* ======================================================================
       MODAL SYSTEM
       ====================================================================== */

    /**
     * Modal dialog manager
     * Handles confirmation dialogs for destructive actions
     */
    const Modal = {
        el: null,
        titleEl: null,
        msgEl: null,
        confirmBtn: null,
        cancelBtn: null,

        /**
         * Initializes modal DOM references and event handlers
         */
        init() {
            this.el = document.getElementById('mapModal');
            this.titleEl = document.getElementById('mapModalTitle');
            this.msgEl = document.getElementById('mapModalMessage');
            this.confirmBtn = document.getElementById('mapModalConfirm');
            this.cancelBtn = document.getElementById('mapModalCancel');

            if (this.cancelBtn) {
                this.cancelBtn.addEventListener('click', () => this.hide());
            }
            if (this.el) {
                this.el.addEventListener('click', (e) => {
                    if (e.target.id === 'mapModal') this.hide();
                });
            }
        },

        /**
         * Shows a modal dialog
         * 
         * @param {string} title - Dialog title
         * @param {string} message - Dialog message
         * @param {string} confirmText - Text for confirm button
         * @param {string} type - Button style: 'primary' or 'danger'
         * @param {Function} onConfirm - Callback when confirmed
         */
        show(title, message, confirmText, type, onConfirm) {
            if (!this.el) return;
            
            this.titleEl.textContent = title;
            this.msgEl.textContent = message;
            this.confirmBtn.textContent = confirmText || 'Confirm';
            this.confirmBtn.className = `map-modal-btn ${type === 'danger' ? 'danger' : 'primary'}`;

            // Clone button to remove old event listeners
            const newConfirm = this.confirmBtn.cloneNode(true);
            this.confirmBtn.parentNode.replaceChild(newConfirm, this.confirmBtn);
            this.confirmBtn = newConfirm;

            this.confirmBtn.addEventListener('click', () => {
                this.hide();
                if (onConfirm) onConfirm();
            });

            this.el.classList.add('show');
        },

        /**
         * Hides the modal dialog
         */
        hide() {
            if (this.el) {
                this.el.classList.remove('show');
            }
        }
    };

    /* ======================================================================
       STATUS MANAGEMENT
       ====================================================================== */

    /**
     * Updates the status indicator in the UI
     * 
     * @param {string} status - Status class: 'ready', 'drawing'
     * @param {string} text - Status message to display
     */
    function setStatus(status, text) {
        const dot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');
        
        if (dot) {
            dot.className = `status-dot ${status}`;
        }
        if (statusText) {
            statusText.textContent = text;
        }
    }

    /* ======================================================================
       MAP INITIALIZATION
       ====================================================================== */

    /**
     * Initializes the map widget
     * Creates map instance, layers, and sets up interactions
     * 
     * @param {Object} config - Initial configuration
     * @param {Array<number>} config.center - [longitude, latitude] center point
     * @param {number} config.defaultZoom - Initial zoom level
     * @param {string} config.orthoUrl - URL template for ortho tiles
     * @returns {ol.Map} The initialized map instance
     */
    function init(config) {
        // If already initialized, just update the site
        if (State.initialized) {
            updateSite(config);
            return State.map;
        }

        // Store configuration with defaults
        State.currentConfig = config || {
            center: [134.0, -25.0],
            defaultZoom: 5,
            orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        };

        // Initialize modal system
        Modal.init();

        // Create base layers
        const layers = createBaseLayers();
        
        // Create drawing layer
        State.drawSource = new ol.source.Vector();
        const drawLayer = createDrawLayer();

        // Initialize map
        State.map = new ol.Map({
            target: 'map',
            layers: [...layers, drawLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat(State.currentConfig.center),
                zoom: State.currentConfig.defaultZoom,
                maxZoom: 21
            }),
            controls: ol.control.defaults.defaults({ zoom: false }).extend([
                new ol.control.ScaleLine()
            ])
        });

        // Set up event handlers
        setupMapEventHandlers();
        setupToolButtons();
        setupLayerButtons();
        setupFullscreen();
        setupResizeHandler();

        State.initialized = true;
        setStatus('ready', 'Ready');

        return State.map;
    }

    /**
     * Creates the base map layers
     * @returns {Array<ol.layer.Tile>} Array of base layers
     */
    function createBaseLayers() {
        const osm = new ol.layer.Tile({
            source: new ol.source.OSM(),
            visible: false,
            properties: { name: 'osm' }
        });

        const satellite = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxZoom: 19
            }),
            visible: false,
            properties: { name: 'satellite' }
        });

        State.orthoLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: State.currentConfig.orthoUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxZoom: 21
            }),
            visible: true,
            properties: { name: 'ortho' }
        });

        return [osm, satellite, State.orthoLayer];
    }

    /**
     * Creates the drawing layer with consistent styling
     * @returns {ol.layer.Vector} Configured vector layer
     */
    function createDrawLayer() {
        return new ol.layer.Vector({
            source: State.drawSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: DRAW_STYLE.fillColor }),
                stroke: new ol.style.Stroke({ 
                    color: DRAW_STYLE.strokeColor, 
                    width: DRAW_STYLE.strokeWidth 
                }),
                image: new ol.style.Circle({
                    radius: DRAW_STYLE.pointRadius,
                    fill: new ol.style.Fill({ color: DRAW_STYLE.pointFillColor }),
                    stroke: new ol.style.Stroke({ 
                        color: DRAW_STYLE.pointStrokeColor, 
                        width: DRAW_STYLE.pointStrokeWidth 
                    })
                })
            })
        });
    }

    /**
     * Sets up map event handlers
     */
    function setupMapEventHandlers() {
        // Coordinate display on pointer move
        State.map.on('pointermove', (evt) => {
            const coords = ol.proj.toLonLat(evt.coordinate);
            const coordDisplay = document.getElementById('coordDisplay');
            if (coordDisplay) {
                coordDisplay.textContent = `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
            }
        });

        // Update feature count and KML on source change
        State.drawSource.on('change', () => {
            const count = State.drawSource.getFeatures().length;
            const featureCountEl = document.getElementById('featureCount');
            if (featureCountEl) {
                featureCountEl.textContent = count;
            }
            updateKmlData();
        });
    }

    /* ======================================================================
       DRAWING TOOLS
       ====================================================================== */

    /**
     * Sets up drawing tool button event handlers
     */
    function setupToolButtons() {
        // Drawing tool buttons
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                if (btn.classList.contains('active')) {
                    setTool(null);
                } else {
                    setTool(tool);
                }
            });
        });

        // Undo button
        document.getElementById('undoBtn')?.addEventListener('click', () => {
            if (State.featureHistory.length) {
                State.drawSource.removeFeature(State.featureHistory.pop());
                setStatus('ready', 'Undo complete');
            }
        });

        // Clear button
        document.getElementById('clearBtn')?.addEventListener('click', clearFeatures);

        // Download KML button
        document.getElementById('downloadBtn')?.addEventListener('click', downloadKML);
    }

    /**
     * Activates a drawing tool
     * 
     * @param {string|null} toolType - Tool type: 'Polygon', 'Box', 'Circle', 'LineString', 'Point', or null to deactivate
     */
    function setTool(toolType) {
        // Remove existing interaction
        if (State.drawInteraction) {
            State.map.removeInteraction(State.drawInteraction);
            State.drawInteraction = null;
        }

        // Update button states
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
            b.classList.remove('active');
        });

        if (!toolType) {
            setStatus('ready', 'Ready');
            return;
        }

        // Activate button
        const activeBtn = document.querySelector(`[data-tool="${toolType}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Configure geometry function for special types
        let geometryFunction;
        let type = toolType;

        if (toolType === 'Box') {
            geometryFunction = ol.interaction.Draw.createBox();
            type = 'Circle'; // Box uses Circle type with custom geometry function
        }

        // Create draw interaction
        State.drawInteraction = new ol.interaction.Draw({
            source: State.drawSource,
            type: type,
            geometryFunction: geometryFunction
        });

        State.drawInteraction.on('drawstart', () => {
            setStatus('drawing', 'Drawing...');
        });

        State.drawInteraction.on('drawend', (e) => {
            State.featureHistory.push(e.feature);
            setStatus('ready', 'Feature added');
        });

        State.map.addInteraction(State.drawInteraction);
        setStatus('ready', `${toolType} active`);
    }

    /* ======================================================================
       LAYER CONTROLS
       ====================================================================== */

    /**
     * Sets up layer switch button event handlers
     */
    function setupLayerButtons() {
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                switchLayer(btn.dataset.layer);
            });
        });
    }

    /**
     * Switches the visible base layer
     * @param {string} layerName - Layer name: 'osm', 'satellite', or 'ortho'
     */
    function switchLayer(layerName) {
        // Update button states
        document.querySelectorAll('.layer-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.layer === layerName);
        });

        // Toggle layer visibility
        State.map.getLayers().forEach(lyr => {
            const name = lyr.get('name');
            if (name) {
                lyr.setVisible(name === layerName);
            }
        });
    }

    /* ======================================================================
       FULLSCREEN CONTROLS
       ====================================================================== */

    /**
     * Sets up fullscreen toggle functionality
     */
    function setupFullscreen() {
        const fullscreenBtn = document.getElementById('fullscreenToggle');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', toggleFullscreen);
        }

        document.addEventListener('fullscreenchange', updateFullscreenUI);
        document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
    }

    /**
     * Toggles fullscreen mode with confirmation
     */
    function toggleFullscreen() {
        const mapContainer = document.querySelector('.map-container');
        
        if (!document.fullscreenElement) {
            Modal.show(
                'Enter Fullscreen Mode?',
                'This will maximize the map. You can exit by pressing ESC or clicking the button again.',
                'Go Fullscreen',
                'primary',
                () => {
                    if (mapContainer.requestFullscreen) {
                        mapContainer.requestFullscreen();
                    } else if (mapContainer.webkitRequestFullscreen) {
                        mapContainer.webkitRequestFullscreen();
                    } else if (mapContainer.msRequestFullscreen) {
                        mapContainer.msRequestFullscreen();
                    }
                }
            );
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    /**
     * Updates UI elements for fullscreen state
     */
    function updateFullscreenUI() {
        const isFs = !!document.fullscreenElement;
        const iconMaximize = document.getElementById('icon-maximize');
        const iconMinimize = document.getElementById('icon-minimize');
        const fullscreenBtn = document.getElementById('fullscreenToggle');

        if (iconMaximize) iconMaximize.style.display = isFs ? 'none' : 'block';
        if (iconMinimize) iconMinimize.style.display = isFs ? 'block' : 'none';
        if (fullscreenBtn) fullscreenBtn.title = isFs ? 'Exit Fullscreen' : 'Toggle Fullscreen';

        // Update map size after fullscreen change
        setTimeout(() => {
            if (State.map) State.map.updateSize();
        }, 200);
    }

    /* ======================================================================
       RESIZE HANDLING
       ====================================================================== */

    /**
     * Sets up window resize handler with debouncing
     */
    function setupResizeHandler() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (State.map) State.map.updateSize();
            }, 100);
        });
    }

    /* ======================================================================
       FEATURE MANAGEMENT
       ====================================================================== */

    /**
     * Clears all drawn features with confirmation
     */
    function clearFeatures() {
        if (State.drawSource.getFeatures().length === 0) {
            setStatus('ready', 'Nothing to clear');
            return;
        }

        Modal.show(
            'Clear All Features?',
            'This will remove all shapes you have drawn. This action cannot be undone.',
            'Clear All',
            'danger',
            () => {
                State.drawSource.clear();
                State.featureHistory = [];
                setStatus('ready', 'Canvas cleared');
            }
        );
    }

    /* ======================================================================
       KML GENERATION & EXPORT
       ====================================================================== */

    /**
     * Generates KML string from drawn features
     * Converts circles to polygons since KML doesn't support native circles
     * 
     * @returns {string} KML formatted string or empty string if no features
     */
    function generateKML() {
        if (!State.drawSource) return '';

        const features = State.drawSource.getFeatures();
        if (!features.length) return '';

        const format = new ol.format.KML({
            extractStyles: false,
            writeStyles: true
        });

        // Clone and transform features for KML export
        const featuresClone = features.map(f => {
            const clone = f.clone();
            let geom = clone.getGeometry();

            // Convert Circle to Polygon (KML doesn't support circles)
            if (geom.getType() === 'Circle') {
                geom = ol.geom.Polygon.fromCircle(geom, 64);
                clone.setGeometry(geom);
            }

            // Transform to geographic coordinates
            geom.transform('EPSG:3857', 'EPSG:4326');
            
            // Apply KML styling
            clone.setStyle(new ol.style.Style({
                fill: new ol.style.Fill({ color: KML_STYLE.fillColor }),
                stroke: new ol.style.Stroke({ 
                    color: KML_STYLE.strokeColor, 
                    width: KML_STYLE.strokeWidth 
                })
            }));
            
            return clone;
        });

        return format.writeFeatures(featuresClone);
    }

    /**
     * Updates the hidden KML data input field
     * Called whenever features change
     */
    function updateKmlData() {
        const kml = generateKML();
        const kmlInput = document.getElementById('kmlData');
        if (kmlInput) {
            kmlInput.value = kml;
        }
    }

    /**
     * Downloads the current features as a KML file
     */
    function downloadKML() {
        const kml = generateKML();
        if (!kml) {
            setStatus('ready', 'Nothing to download');
            return;
        }

        const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mission-area-${Date.now()}.kml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setStatus('ready', 'Download started');
    }

    /* ======================================================================
       SITE UPDATE
       ====================================================================== */

    /**
     * Updates the map to a new site configuration
     * Prompts for confirmation if features exist
     * 
     * @param {Object} config - New site configuration
     */
    function updateSite(config) {
        if (!State.map || !config) return;

        const hadFeatures = State.drawSource && State.drawSource.getFeatures().length > 0;

        if (hadFeatures) {
            Modal.show(
                'Change Site?',
                'Changing sites will clear your current drawings. Do you want to continue?',
                'Change Site',
                'danger',
                () => performSiteUpdate(config)
            );
        } else {
            performSiteUpdate(config);
        }
    }

    /**
     * Performs the actual site update
     * @param {Object} config - New site configuration
     */
    function performSiteUpdate(config) {
        State.currentConfig = config;

        // Clear drawings
        if (State.drawSource) {
            State.drawSource.clear();
            State.featureHistory = [];
        }

        // Update ortho layer source if URL changed
        if (config.orthoUrl && State.orthoLayer) {
            State.orthoLayer.setSource(new ol.source.XYZ({
                url: config.orthoUrl,
                maxZoom: 21
            }));
        }

        // Animate to new location
        State.map.getView().animate({
            center: ol.proj.fromLonLat(config.center),
            zoom: config.defaultZoom,
            duration: 500
        });

        setStatus('ready', 'Site updated');
    }

    /* ======================================================================
       PUBLIC API
       ====================================================================== */

    /**
     * Gets the count of drawn features
     * @returns {number} Feature count
     */
    function getFeatureCount() {
        return State.drawSource ? State.drawSource.getFeatures().length : 0;
    }

    /**
     * Clears all features without confirmation
     */
    function clear() {
        if (State.drawSource) {
            State.drawSource.clear();
            State.featureHistory = [];
        }
    }

    /**
     * Checks if the widget is initialized
     * @returns {boolean} Initialization state
     */
    function isInitialized() {
        return State.initialized;
    }

    /**
     * Gets the OpenLayers map instance
     * @returns {ol.Map|null} Map instance
     */
    function getMap() {
        return State.map;
    }

    // Return public API
    return {
        init,
        generateKML,
        updateSite,
        getFeatureCount,
        clear,
        setTool,
        isInitialized,
        getMap,
        downloadKML
    };
})();

// Export for global access
window.MapWidget = MapWidget;
