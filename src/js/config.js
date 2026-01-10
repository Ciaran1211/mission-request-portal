/**
 * Mission Request Portal - Configuration Module
 * ==============================================
 * 
 * Centralized configuration for all company, site, and service settings.
 * This module is the single source of truth for:
 * - Company and site definitions
 * - Repeat mission configurations with SharePoint field mappings
 * - EmailJS service credentials
 * 
 * IMPORTANT: Update this file when adding new companies or sites.
 * 
 * @module config
 * @version 2.0.0
 * @author RocketDNA Development Team
 */

'use strict';

/* ==========================================================================
   COMPANY AND SITE CONFIGURATION
   ==========================================================================
   
   Structure Overview:
   - COMPANY_CONFIG: Object keyed by company code (URL parameter value)
   - Each company contains: name, displayName, logo URL, and sites object
   - Each site contains: name, areas array, and optional repeatMissions array
   
   Adding a New Company:
   1. Add a new key to COMPANY_CONFIG (e.g., 'NEWCO')
   2. Define required properties: name, displayName, sites
   3. For each site, define: name, areas, and optionally repeatMissions
   4. Update map-widget.html SITES object to match
   
   ========================================================================== */

const COMPANY_CONFIG = {
    /**
     * BHP Mitsubishi Alliance (BMA)
     * Primary coal mining client with multiple Queensland sites
     */
    'BMA': {
        name: 'BMA',
        displayName: 'BHP Mitsubishi Alliance',
        logo: 'https://github.com/Ciaran1211/mission-request-portal/blob/main/src/logos/BMA_Logo.png',
        sites: {
            /**
             * Saraji Mine
             * Located in Central Queensland's Bowen Basin
             * Full repeat mission support with multiple panoramic and survey flights
             */
            'SR': {
                name: 'Saraji',
                areas: [
                    '6E', '6W', '4E', '4W', '2E', '2W', '1E', '1W',
                    '13E', '15W', '15E', '14W', '14E', '13W',
                    '8W', '8E', '12W', '12E', '9W', '9E', '16W', '16E'
                ],
                /**
                 * Repeat Missions Configuration
                 * 
                 * Each mission object contains:
                 * @property {string} display - Human-readable name shown in dropdown
                 * @property {string} sharepoint - Exact SharePoint list item name (must match exactly)
                 * @property {string} dock - Dock location identifier for this mission
                 * @property {number} plannedFlightTime - Estimated flight duration in minutes
                 * @property {string} missionType - Mission category for SharePoint classification
                 */
                repeatMissions: [
                    {
                        display: 'Daily Panos 1',
                        sharepoint: '251219 P SR PIT Daily Panos 1',
                        dock: 'Dock 3-i016-B (SOUTH)',
                        plannedFlightTime: 21,
                        missionType: 'Panoramic'
                    },
                    {
                        display: 'Daily Panos 2',
                        sharepoint: '251219 P SR PIT Daily Panos 2',
                        dock: 'Dock 3-i016-B (SOUTH)',
                        plannedFlightTime: 18,
                        missionType: 'Panoramic'
                    },
                    {
                        display: 'Daily Panos 3',
                        sharepoint: '251219 P SR PIT Daily Panos 3',
                        dock: 'Dock 3-I015-B (NORTH)',
                        plannedFlightTime: 15,
                        missionType: 'Panoramic'
                    },
                    {
                        display: 'PIT Coal 8',
                        sharepoint: '251219 S SR PIT Coal 8',
                        dock: 'Dock 3-S015‐A (NORTH)',
                        plannedFlightTime: 17,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 9',
                        sharepoint: '251219 S SR PIT Coal 9',
                        dock: 'Dock 3-S016-A (SOUTH)',
                        plannedFlightTime: 17,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 12',
                        sharepoint: '251219 S SR PIT Coal 12',
                        dock: 'Dock 3-S016-A (SOUTH)',
                        plannedFlightTime: 21,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 13-14',
                        sharepoint: '251219 S SR PIT Coal 13-14',
                        dock: 'Dock 3-S016-A (SOUTH)',
                        plannedFlightTime: 21,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 15',
                        sharepoint: '251219 S SR PIT Coal 15',
                        dock: 'Dock 3-S016-A (SOUTH)',
                        plannedFlightTime: 18,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 16',
                        sharepoint: '251219 S SR PIT Coal 16',
                        dock: 'Dock 3-S016-A (SOUTH)',
                        plannedFlightTime: 18,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 1A',
                        sharepoint: '251219 S SR PIT Coal 1A',
                        dock: 'Dock 3-S015‐A (NORTH)',
                        plannedFlightTime: 13,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 2-4',
                        sharepoint: '251219 S SR PIT Coal 2-4',
                        dock: 'Dock 3-S015‐A (NORTH)',
                        plannedFlightTime: 21,
                        missionType: 'Survey'
                    },
                    {
                        display: 'PIT Coal 6',
                        sharepoint: '251219 S SR PIT Coal 6',
                        dock: 'Dock 3-S015‐A (NORTH)',
                        plannedFlightTime: 21,
                        missionType: 'Survey'
                    }
                ]
            },

            /**
             * Goonyella Riverside Mine
             * One of the largest metallurgical coal mines in Australia
             */
            'GR': {
                name: 'Goonyella',
                areas: ['North Pit', 'South Pit', 'East Pit', 'CHPP', 'Rail Loop'],
                repeatMissions: []
            },

            /**
             * Peak Downs Mine
             * Open-cut metallurgical coal mine in Bowen Basin
             */
            'PK': {
                name: 'Peak Downs',
                areas: [
                    '3N_E', '3N_W', '5N_E', '5N_W', '6N_E', '7N_E', '6N_W', '7N_W',
                    '1S_E', '1S_W', '2S_E', '2S_W', '1N_W', '1N_E', '4S_E', '4S_W',
                    '2N_W', '2N_E', '5S_E', '5S_W', '9S_E', '11S_E', '9S_W', '11S_W'
                ],
                repeatMissions: []
            }
        }
    },

    /**
     * Goldfields Limited
     * South African-headquartered gold mining company with Australian operations
     */
    'Goldfields': {
        name: 'Goldfields',
        displayName: 'Goldfields',
        logo: 'https://github.com/Ciaran1211/mission-request-portal/blob/main/src/logos/gold-fields-logo.svg',
        sites: {
            /**
             * Gruyere Gold Mine
             * Joint venture gold mine in Western Australia
             */
            'GY': {
                name: 'Gruyere',
                areas: [
                    'Pit', 'ROM', 'TSF',
                    'WD 01', 'WD 02-03', 'WD 04-05', 'WD 06',
                    'Plant / MACA', 'Solar Farm',
                    'NE Outer', 'SE Outer', 'SW Outer',
                    'Multiple Locations'
                ],
                repeatMissions: []
            }
        }
    },

    /**
     * Norton Gold Fields
     * Australian gold mining company operating in Western Australia
     */
    'Norton': {
        name: 'Norton',
        displayName: 'Norton Gold Fields',
        sites: {
            /**
             * Binduli North Operations
             * Gold mining operation near Kalgoorlie, WA
             */
            'BN': {
                name: 'Binduli North',
                areas: [
                    'Janet Ivy Pit', 'Karen Louise Pit',
                    'North Waste Rock Dump', 'East Waste Rock Dump',
                    'ROM', 'ROM 2', 'Heap Leach',
                    'Offices', 'Treatment Plant', 'Fort William',
                    'Site Access', 'Multiple Locations'
                ],
                repeatMissions: []
            }
        }
    }
};

/* ==========================================================================
   EMAILJS CONFIGURATION
   ==========================================================================
   
   EmailJS is used to send form submissions via email to Power Automate.
   
   Setup Instructions:
   1. Create account at https://www.emailjs.com/
   2. Add Email Service (Gmail, Outlook, etc.)
   3. Create Email Template with required variables
   4. Copy credentials below
   
   Free Tier Limits: 200 emails/month
   
   ========================================================================== */

const EMAILJS_CONFIG = {
    /**
     * Public Key
     * Found at: EmailJS Dashboard > Account > API Keys
     */
    publicKey: 'AuUzrhV2H93CJxoa0',

    /**
     * Service ID
     * Found at: EmailJS Dashboard > Email Services > (Your Service)
     */
    serviceId: 'service_4j8dixs',

    /**
     * Template ID
     * Found at: EmailJS Dashboard > Email Templates > (Your Template)
     */
    templateId: 'template_152awpf'
};

/* ==========================================================================
   UTILITY FUNCTIONS
   ========================================================================== */

/**
 * Retrieves a company configuration by its key
 * @param {string} companyKey - The company identifier (e.g., 'BMA', 'Goldfields')
 * @returns {Object|null} The company configuration or null if not found
 */
function getCompanyConfig(companyKey) {
    return COMPANY_CONFIG[companyKey] || null;
}

/**
 * Retrieves all available company keys
 * @returns {string[]} Array of company identifiers
 */
function getAvailableCompanies() {
    return Object.keys(COMPANY_CONFIG);
}

/**
 * Checks if a company has repeat missions configured for any site
 * @param {string} companyKey - The company identifier
 * @returns {boolean} True if any site has repeat missions
 */
function hasRepeatMissions(companyKey) {
    const company = COMPANY_CONFIG[companyKey];
    if (!company) return false;
    
    return Object.values(company.sites).some(
        site => site.repeatMissions && site.repeatMissions.length > 0
    );
}

/* ==========================================================================
   MODULE EXPORTS
   ========================================================================== */

// Support both module systems and global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        COMPANY_CONFIG,
        EMAILJS_CONFIG,
        getCompanyConfig,
        getAvailableCompanies,
        hasRepeatMissions
    };
}
