// Map Widget for Mission Request Portal
// Handles map initialization, drawing tools, KML generation, and all interactions
// Matches functionality of widget-final.html

const MapWidget = (function() {
    'use strict';

    // ============================================================
    // STATE
    // ============================================================
    const State = {
        map: null,
        drawSource: null,
        drawInteraction: null,
        featureHistory: [],
        currentConfig: null,
        orthoLayer: null,
        initialized: false
    };

    // ============================================================
    // MODAL SYSTEM
    // ============================================================
    const Modal = {
        el: null,
        titleEl: null,
        msgEl: null,
        confirmBtn: null,
        cancelBtn: null,

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

        hide() {
            if (this.el) {
                this.el.classList.remove('show');
            }
        }
    };

    // ============================================================
    // STATUS MANAGEMENT
    // ============================================================
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

    // ============================================================
    // MAP INITIALIZATION
    // ============================================================
    function init(config) {
        if (State.initialized) {
            updateSite(config);
            return State.map;
        }

        State.currentConfig = config || {
            center: [134.0, -25.0],
            defaultZoom: 5,
            orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        };

        // Initialize modal
        Modal.init();

        // Create base layers
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

        // Ortho layer - can be updated per site
        State.orthoLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: State.currentConfig.orthoUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxZoom: 21
            }),
            visible: true,
            properties: { name: 'ortho' }
        });

        // Drawing layer
        State.drawSource = new ol.source.Vector();
        const drawLayer = new ol.layer.Vector({
            source: State.drawSource,
            style: new ol.style.Style({
                fill: new ol.style.Fill({ color: 'rgba(10, 186, 239, 0.2)' }),
                stroke: new ol.style.Stroke({ color: '#0ABAEF', width: 2 }),
                image: new ol.style.Circle({
                    radius: 6,
                    fill: new ol.style.Fill({ color: '#0ABAEF' }),
                    stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
                })
            })
        });

        // Initialize map
        State.map = new ol.Map({
            target: 'map',
            layers: [osm, satellite, State.orthoLayer, drawLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat(State.currentConfig.center),
                zoom: State.currentConfig.defaultZoom,
                maxZoom: 21
            }),
            controls: ol.control.defaults.defaults({ zoom: false }).extend([
                new ol.control.ScaleLine()
            ])
        });

        // Coordinate display on pointer move
        State.map.on('pointermove', (evt) => {
            const coords = ol.proj.toLonLat(evt.coordinate);
            const coordDisplay = document.getElementById('coordDisplay');
            if (coordDisplay) {
                coordDisplay.textContent = `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`;
            }
        });

        // Update feature count on change
        State.drawSource.on('change', () => {
            const count = State.drawSource.getFeatures().length;
            const featureCountEl = document.getElementById('featureCount');
            if (featureCountEl) {
                featureCountEl.textContent = count;
            }
            updateKmlData();
        });

        // Setup all interactions
        setupToolButtons();
        setupLayerButtons();
        setupFullscreen();
        setupResizeHandler();

        State.initialized = true;
        setStatus('ready', 'Ready');

        return State.map;
    }

    // ============================================================
    // TOOL BUTTONS
    // ============================================================
    function setupToolButtons() {
        // Drawing tools
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
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            clearFeatures();
        });

        // Download KML button
        document.getElementById('downloadBtn')?.addEventListener('click', () => {
            downloadKML();
        });
    }

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

        // Create geometry function for special types
        let geometryFunction;
        let type = toolType;

        if (toolType === 'Box') {
            geometryFunction = ol.interaction.Draw.createBox();
            type = 'Circle';
        } else if (toolType === 'Circle') {
            type = 'Circle';
        }

        // Create new draw interaction
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

    // ============================================================
    // LAYER BUTTONS
    // ============================================================
    function setupLayerButtons() {
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layerName = btn.dataset.layer;
                switchLayer(layerName);
            });
        });
    }

    function switchLayer(layerName) {
        document.querySelectorAll('.layer-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.layer === layerName);
        });

        State.map.getLayers().forEach(lyr => {
            const name = lyr.get('name');
            if (name) {
                lyr.setVisible(name === layerName);
            }
        });
    }

    // ============================================================
    // FULLSCREEN
    // ============================================================
    function setupFullscreen() {
        const fullscreenBtn = document.getElementById('fullscreenToggle');
        if (fullscreenBtn) {
            fullscreenBtn.addEventListener('click', toggleFullscreen);
        }

        document.addEventListener('fullscreenchange', updateFullscreenUI);
        document.addEventListener('webkitfullscreenchange', updateFullscreenUI);
    }

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

    // ============================================================
    // RESIZE HANDLER
    // ============================================================
    function setupResizeHandler() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (State.map) State.map.updateSize();
            }, 100);
        });
    }

    // ============================================================
    // CLEAR FEATURES
    // ============================================================
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

    // ============================================================
    // KML GENERATION & DOWNLOAD
    // ============================================================
    function generateKML() {
        if (!State.drawSource) return '';

        const features = State.drawSource.getFeatures();
        if (!features.length) return '';

        const format = new ol.format.KML({
            extractStyles: false,
            writeStyles: true
        });

        const featuresClone = features.map(f => {
            const clone = f.clone();
            let geom = clone.getGeometry();

            // Convert Circle to Polygon (KML doesn't support circles)
            if (geom.getType() === 'Circle') {
                geom = ol.geom.Polygon.fromCircle(geom, 64);
                clone.setGeometry(geom);
            }

            geom.transform('EPSG:3857', 'EPSG:4326');
            clone.setStyle(new ol.style.Style({
                fill: new ol.style.Fill({ color: [10, 186, 239, 0.3] }),
                stroke: new ol.style.Stroke({ color: [10, 186, 239, 1], width: 2 })
            }));
            return clone;
        });

        return format.writeFeatures(featuresClone);
    }

    function updateKmlData() {
        const kml = generateKML();
        const kmlInput = document.getElementById('kmlData');
        if (kmlInput) {
            kmlInput.value = kml;
        }
    }

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

    // ============================================================
    // SITE UPDATE
    // ============================================================
    function updateSite(config) {
        if (!State.map || !config) return;

        const hadFeatures = State.drawSource && State.drawSource.getFeatures().length > 0;

        if (hadFeatures) {
            Modal.show(
                'Change Site?',
                'Changing sites will clear your current drawings. Do you want to continue?',
                'Change Site',
                'danger',
                () => {
                    performSiteUpdate(config);
                }
            );
        } else {
            performSiteUpdate(config);
        }
    }

    function performSiteUpdate(config) {
        State.currentConfig = config;

        // Clear drawings
        if (State.drawSource) {
            State.drawSource.clear();
            State.featureHistory = [];
        }

        // Update ortho layer source if URL is different
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

    // ============================================================
    // PUBLIC API
    // ============================================================
    function getFeatureCount() {
        return State.drawSource ? State.drawSource.getFeatures().length : 0;
    }

    function clear() {
        if (State.drawSource) {
            State.drawSource.clear();
            State.featureHistory = [];
        }
    }

    function isInitialized() {
        return State.initialized;
    }

    function getMap() {
        return State.map;
    }

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

// Export for use in app.js
window.MapWidget = MapWidget;
