// Map Widget for Mission Request Portal
// Handles map initialization, drawing tools, and KML generation

const MapWidget = (function() {
    // Site configurations
    const SITES = {
        'Saraji': {
            name: 'Saraji',
            center: [148.2875, -22.40],
            defaultZoom: 14,
            tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        },
        'Goldfields': {
            name: 'Goldfields',
            center: [121.5, -30.75],
            defaultZoom: 14,
            tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        }
    };

    let map = null;
    let drawSource = null;
    let drawInteraction = null;
    let featureHistory = [];
    let currentSite = null;

    function init(siteKey) {
        currentSite = SITES[siteKey] || SITES['Saraji'];

        // Create layers
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

        const ortho = new ol.layer.Tile({
            source: new ol.source.XYZ({
                url: currentSite.tileUrl,
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
            layers: [osm, satellite, ortho, drawLayer],
            view: new ol.View({
                center: ol.proj.fromLonLat(currentSite.center),
                zoom: currentSite.defaultZoom,
                maxZoom: 21
            }),
            controls: ol.control.defaults.defaults({ zoom: true }).extend([
                new ol.control.ScaleLine()
            ])
        });

        // Update feature count on change
        drawSource.on('change', () => {
            const count = drawSource.getFeatures().length;
            document.getElementById('featureCount').textContent = count;
            updateKmlData();
        });

        // Setup tool buttons
        setupToolButtons();
        setupLayerButtons();

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

    function generateKML() {
        const features = drawSource.getFeatures();
        if (!features.length) return '';

        const format = new ol.format.KML({
            extractStyles: false,
            writeStyles: true
        });

        const featuresClone = features.map(f => {
            const clone = f.clone();
            clone.getGeometry().transform('EPSG:3857', 'EPSG:4326');
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
        document.getElementById('kmlData').value = kml;
    }

    function updateSite(siteKey) {
        if (!map) return;
        
        const site = SITES[siteKey];
        if (!site) return;

        currentSite = site;
        map.getView().animate({
            center: ol.proj.fromLonLat(site.center),
            zoom: site.defaultZoom,
            duration: 500
        });
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

    return {
        init,
        generateKML,
        updateSite,
        getFeatureCount,
        clear,
        setTool
    };
})();

// Export for use in app.js
window.MapWidget = MapWidget;
