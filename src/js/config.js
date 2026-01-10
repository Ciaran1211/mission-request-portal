// ============================================================
// COMPANY AND SITE CONFIGURATION
// ============================================================
// This file contains all company, site, and repeat mission configurations.
// Edit this file to add/modify sites, areas, and repeat missions.

const COMPANY_CONFIG = {
    'BMA': {
        name: 'BMA',
        displayName: 'BHP Mitsubishi Alliance',
        logo: 'https://github.com/Ciaran1211/mission-request-portal/blob/main/src/logos/BMA_Logo.png',
        sites: {
            'SR': {
                name: 'Saraji',
                areas: ["6E", "6W", "4E", "4W", "2E", "2W", "1E", "1W", "13E", "15W", "15E", "14W", "14E", "13W", "8W", "8E", "12W", "12E", "9W", "9E", "16W", "16E"],
                // Repeat missions with SharePoint field mappings
                // display: What the client sees in dropdown
                // sharepoint: The actual SharePoint list item name
                // dock: Dock location for this mission
                // plannedFlightTime: Estimated flight time in minutes
                // missionType: Type of mission for SharePoint
                repeatMissions: [
                    { 
                        display: "Daily Panos 1", 
                        sharepoint: "251219 P SR PIT Daily Panos 1",
                        dock: "Dock 3-i016-B (SOUTH)",
                        plannedFlightTime: 21,
                        missionType: "Panoramic"
                    },
                    { 
                        display: "Daily Panos 2", 
                        sharepoint: "251219 P SR PIT Daily Panos 2",
                        dock: "Dock 3-i016-B (SOUTH)",
                        plannedFlightTime: 18,
                        missionType: "Panoramic"
                    },
                    { 
                        display: "Daily Panos 3", 
                        sharepoint: "251219 P SR PIT Daily Panos 3",
                        dock: "Dock 3-I015-B (NORTH)",
                        plannedFlightTime: 15,
                        missionType: "Panoramic"
                    },
                    { 
                        display: "PIT Coal 8", 
                        sharepoint: "251219 S SR PIT Coal 8",
                        dock: "Dock 3-S015‐A (NORTH)",
                        plannedFlightTime: 17,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 9", 
                        sharepoint: "251219 S SR PIT Coal 9",
                        dock: "Dock 3-S016-A (SOUTH)",
                        plannedFlightTime: 17,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 12", 
                        sharepoint: "251219 S SR PIT Coal 12",
                        dock: "Dock 3-S016-A (SOUTH)",
                        plannedFlightTime: 21,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 13-14", 
                        sharepoint: "251219 S SR PIT Coal 13-14",
                        dock: "Dock 3-S016-A (SOUTH)",
                        plannedFlightTime: 21,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 15", 
                        sharepoint: "251219 S SR PIT Coal 15",
                        dock: "Dock 3-S016-A (SOUTH)",
                        plannedFlightTime: 18,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 16", 
                        sharepoint: "251219 S SR PIT Coal 16",
                        dock: "Dock 3-S016-A (SOUTH)",
                        plannedFlightTime: 18,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 1A", 
                        sharepoint: "251219 S SR PIT Coal 1A",
                        dock: "Dock 3-S015‐A (NORTH)",
                        plannedFlightTime: 13,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 2-4", 
                        sharepoint: "251219 S SR PIT Coal 2-4",
                        dock: "Dock 3-S015‐A (NORTH)",
                        plannedFlightTime: 21,
                        missionType: "Survey"
                    },
                    { 
                        display: "PIT Coal 6", 
                        sharepoint: "251219 S SR PIT Coal 6",
                        dock: "Dock 3-S015‐A (NORTH)",
                        plannedFlightTime: 21,
                        missionType: "Survey"
                    }
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
        logo: 'https://github.com/Ciaran1211/mission-request-portal/blob/main/src/logos/gold-fields-logo.svg',
        sites: {
            'GY': {
                name: 'Gruyere',
                areas: ["Pit", "ROM", "TSF", "WD 01", "WD 02-03", "WD 04-05", "WD 06", "Plant / MACA", "Solar Farm", "NE Outer", "SE Outer", "SW Outer", "Multiple Locations"],
                repeatMissions: []
            }
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
// EMAILJS CONFIGURATION
// ============================================================
// Get these from your EmailJS dashboard: https://www.emailjs.com/
const EMAILJS_CONFIG = {
    publicKey: 'AuUzrhV2H93CJxoa0',      // Account → API Keys → Public Key
    serviceId: 'service_4j8dixs',         // Email Services → Service ID
    templateId: 'template_152awpf'        // Email Templates → Template ID
};

// Export for use in app.js (if using modules) or just use globally
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COMPANY_CONFIG, EMAILJS_CONFIG };
}