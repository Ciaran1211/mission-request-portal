// Map Widget for Mission Request Portal
// Handles map initialization, drawing tools, and KML generation

const MapWidget = (function() {
    let map = null;
    let drawSource = null;
    let drawInteraction = null;
    let featureHistory = [];
    let currentConfig = null;
    let orthoLayer = null;
    let initialized = false;

    /**
     * Initialize the map with a site configuration
     * @param {Object} config - Site map configuration
     * @param {Array} config.center - [longitude, latitude]
     * @param {number} config.defaultZoom - Default zoom level
     * @param {string} config.orthoUrl - URL for ortho tiles (optional)
     */
    function init(config) {
        if (initialized) {
            updateSite(config);
            return map;
        }

        currentConfig = config || {
            center: [134.0, -25.0], // Default to Australia center
            defaultZoom: 5,
            orthoUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        };

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
        orthoLayer = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: currentConfig.orthoUrl || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                maxZoom: 21
            }),
            visible: true,
            properties: { name: 'ortho' }
        });

        // Drawing layer
        drawSource = new ol.source.Vector();
        const drawLayer = new ol.layer.Vector({
            source: drawSource,
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
        map = new ol.Map({
            target: 'map',
            layers: [osm, satellite, orthoLayer, drawLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat(currentConfig.center),
                zoom: currentConfig.defaultZoom,
                maxZoom: 21
            }),
            controls: ol.control.defaults.defaults({ zoom: true }).extend([
                new ol.control.ScaleLine()
            ])
        });

        // Update feature count on change
        drawSource.on('change', () => {
            const count = drawSource.getFeatures().length;
            const featureCountEl = document.getElementById('featureCount');
            if (featureCountEl) {
                featureCountEl.textContent = count;
            }
            updateKmlData();
        });

        // Setup tool buttons
        setupToolButtons();
        setupLayerButtons();

        initialized = true;
        return map;
    }

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
            if (featureHistory.length) {
                const lastFeature = featureHistory.pop();
                drawSource.removeFeature(lastFeature);
            }
        });

        // Clear button
        document.getElementById('clearBtn')?.addEventListener('click', () => {
            if (drawSource.getFeatures().length > 0) {
                if (confirm('Clear all drawn features?')) {
                    drawSource.clear();
                    featureHistory = [];
                }
            }
        });
    }

    function setupLayerButtons() {
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const layerName = btn.dataset.layer;
                switchLayer(layerName);
            });
        });
    }

    function setTool(toolType) {
        // Remove existing interaction
        if (drawInteraction) {
            map.removeInteraction(drawInteraction);
            drawInteraction = null;
        }

        // Update button states
        document.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
            b.classList.remove('active');
        });

        if (!toolType) return;

        // Activate button
        document.querySelector(`[data-tool="${toolType}"]`)?.classList.add('active');

        // Create new interaction
        const geometryFunction = toolType === 'Box' ? ol.interaction.Draw.createBox() : undefined;
        const type = (toolType === 'Box' || toolType === 'Circle') ? 'Circle' : toolType;

        drawInteraction = new ol.interaction.Draw({
            source: drawSource,
            type: type,
            geometryFunction: geometryFunction
        });

        drawInteraction.on('drawend', (e) => {
            featureHistory.push(e.feature);
        });

        map.addInteraction(drawInteraction);
    }

    function switchLayer(layerName) {
        document.querySelectorAll('.layer-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.layer === layerName);
        });

        map.getLayers().forEach(lyr => {
            const name = lyr.get('name');
            if (name) {
                lyr.setVisible(name === layerName);
            }
        });
    }

    /**
     * Update the map to show a new site
     * @param {Object} config - Site map configuration
     */
    function updateSite(config) {
        if (!map || !config) return;

        currentConfig = config;

        // Update ortho layer source if URL is different
        if (config.orthoUrl && orthoLayer) {
            orthoLayer.setSource(new ol.source.XYZ({
                url: config.orthoUrl,
                maxZoom: 21
            }));
        }

        // Animate to new location
        map.getView().animate({
            center: ol.proj.fromLonLat(config.center),
            zoom: config.defaultZoom,
            duration: 500
        });

        // Clear any existing drawings when switching sites
        if (drawSource.getFeatures().length > 0) {
            const shouldClear = confirm('Changing sites will clear your current drawings. Continue?');
            if (shouldClear) {
                drawSource.clear();
                featureHistory = [];
            }
        }
    }

    function generateKML() {
        if (!drawSource) return '';
        
        const features = drawSource.getFeatures();
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

    function getFeatureCount() {
        return drawSource ? drawSource.getFeatures().length : 0;
    }

    function clear() {
        if (drawSource) {
            drawSource.clear();
            featureHistory = [];
        }
    }

    function isInitialized() {
        return initialized;
    }

    function getMap() {
        return map;
    }

    return {
        init,
        generateKML,
        updateSite,
        getFeatureCount,
        clear,
        setTool,
        isInitialized,
        getMap
    };
})();

// Export for use in app.js
window.MapWidget = MapWidget;
