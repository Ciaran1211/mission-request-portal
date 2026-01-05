// Mission Request Submission via Power Automate Webhook
// This function forwards form data to Power Automate which handles SharePoint integration

module.exports = async function (context, req) {
    context.log('Mission Request submission received');

    // CORS headers
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };

    // Handle preflight
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers };
        return;
    }

    // Power Automate webhook URL - set this in Azure Static Web App Configuration
    const WEBHOOK_URL = process.env.POWER_AUTOMATE_WEBHOOK_URL;

    if (!WEBHOOK_URL) {
        context.log.error('POWER_AUTOMATE_WEBHOOK_URL not configured');
        context.res = {
            status: 500,
            headers,
            body: { success: false, message: 'Server configuration error' }
        };
        return;
    }

    try {
        const data = req.body;

        if (!data) {
            context.res = {
                status: 400,
                headers,
                body: { success: false, message: 'No data received' }
            };
            return;
        }

        // Map form data to SharePoint fields
        const sharePointData = mapToSharePointFields(data);

        context.log('Sending to Power Automate:', JSON.stringify(sharePointData, null, 2));

        // Send to Power Automate
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sharePointData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('Power Automate error:', errorText);
            throw new Error('Failed to submit to Power Automate');
        }

        // Generate a reference ID for the user
        const refId = `MR-${Date.now().toString(36).toUpperCase()}`;

        context.res = {
            status: 200,
            headers,
            body: {
                success: true,
                message: 'Mission request submitted successfully',
                id: refId
            }
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            headers,
            body: {
                success: false,
                message: error.message || 'An error occurred while submitting the request'
            }
        };
    }
};

/**
 * Map form data to SharePoint list field names
 * These names should match your Power Automate flow's expected input
 */
function mapToSharePointFields(data) {
    // Priority mapping (form sends number, SharePoint expects choice text)
    const priorityMap = {
        1: '1 - Critical',
        2: '2 - High',
        3: '3 - Medium',
        4: '4 - Low',
        5: '5 - Flexible'
    };

    // Determine frequency value
    let frequency = 'Once';
    if (data.frequencyType === 'Repeating' && data.repeatFrequency) {
        frequency = data.repeatFrequency; // Daily, Weekly, Fortnightly, Monthly, Quarterly
    }

    // Check if has attachments
    const hasAttachments = (data.files && data.files.length > 0) || (data.kmlData && data.kmlData.length > 0);

    // Build the SharePoint fields object
    // Using display names - Power Automate can map these to internal names
    const fields = {
        // Core fields
        'Title': data.title || `${data.company} ${data.site} ${data.missionName}`,
        'Scheduled Date': data.missionDate,
        'Company': data.company,
        'Site': data.site,
        'Priority': priorityMap[data.missionPriority] || '3 - Medium',
        'Mission Type': data.missionType,
        'Frequency': frequency,
        
        // Defaults for new requests
        'Mission Plan': 'New Request',
        'Job Status': 'Incomplete',
        
        // Comments and descriptions
        'Comments': data.missionName,
        'Customer Comments': data.customerComment || '',
        
        // Contact info
        'Requested by': data.submitterName,
        'Email contact': data.submitterEmail,
        'Ph. Contact': data.contactNumber || '',
        
        // Attachment indicator
        'Attachment?': hasAttachments ? 'Yes' : 'No',
        
        // Customer parameters
        'Customer Parameters?': data.customParams ? 'Yes' : 'No'
    };

    // Add custom flight parameters if specified
    if (data.customParams) {
        if (data.imageResolution) fields['Resolution'] = data.imageResolution;
        if (data.missionHeight) fields['Height (mAGL)'] = data.missionHeight;
        if (data.overlapSide) fields['Side Overlap (%)'] = data.overlapSide;
        if (data.overlapForward) fields['Forward Overlap (%)'] = data.overlapForward;
        if (data.terrainFollowing) fields['Terrain Follow?'] = data.terrainFollowing;
        if (data.elevationOptimisation) fields['Elev. Opt?'] = data.elevationOptimisation;
    }

    // Fields typically only used for repeat missions
    if (data.plannedFlightTime) {
        fields['Planned Flight Time (min)'] = data.plannedFlightTime;
    }
    if (data.siteOrder) {
        fields['Site Order'] = data.siteOrder;
    }
    if (data.dock) {
        fields['Dock'] = data.dock;
    }

    // Additional data that might be useful in the flow
    // (not direct SharePoint fields, but Power Automate can use them)
    fields['_siteArea'] = data.siteArea || '';
    fields['_kmlData'] = data.kmlData || '';
    fields['_submittedAt'] = data.submittedAt || new Date().toISOString();
    
    // Include file info (Power Automate can handle attachments separately)
    if (data.files && data.files.length > 0) {
        fields['_files'] = data.files.map(f => ({
            name: f.name,
            type: f.type,
            size: f.size,
            data: f.data // base64
        }));
    }

    return fields;
}
