const { ConfidentialClientApplication } = require('@azure/msal-node');

// SharePoint configuration - set these in Azure Function App Settings
const config = {
    tenantId: process.env.TENANT_ID,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    siteUrl: process.env.SHAREPOINT_SITE_URL, // e.g., 'https://yourtenant.sharepoint.com/sites/yoursite'
    listName: process.env.SHAREPOINT_LIST_NAME // e.g., 'Mission Requests'
};

// MSAL configuration
const msalConfig = {
    auth: {
        clientId: config.clientId,
        authority: `https://login.microsoftonline.com/${config.tenantId}`,
        clientSecret: config.clientSecret
    }
};

const cca = new ConfidentialClientApplication(msalConfig);

// Get access token for SharePoint
async function getAccessToken() {
    const result = await cca.acquireTokenByClientCredential({
        scopes: [`${config.siteUrl}/.default`]
    });
    return result.accessToken;
}

// Get site and list IDs
async function getSiteAndListIds(accessToken) {
    // Extract site path from URL
    const url = new URL(config.siteUrl);
    const sitePath = url.pathname;

    // Get site ID
    const siteResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${url.hostname}:${sitePath}`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    
    if (!siteResponse.ok) {
        throw new Error(`Failed to get site: ${await siteResponse.text()}`);
    }
    
    const site = await siteResponse.json();

    // Get list ID
    const listResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${site.id}/lists?$filter=displayName eq '${config.listName}'`,
        {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        }
    );
    
    if (!listResponse.ok) {
        throw new Error(`Failed to get list: ${await listResponse.text()}`);
    }
    
    const lists = await listResponse.json();
    
    if (!lists.value || lists.value.length === 0) {
        throw new Error(`List '${config.listName}' not found`);
    }

    return {
        siteId: site.id,
        listId: lists.value[0].id
    };
}

// Create SharePoint list item
async function createListItem(accessToken, siteId, listId, itemData) {
    const response = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: itemData
            })
        }
    );

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create list item: ${error}`);
    }

    return response.json();
}

// Add attachment to list item
async function addAttachment(accessToken, siteId, listId, itemId, fileName, fileContent) {
    // Decode base64 content
    const buffer = Buffer.from(fileContent, 'base64');

    const response = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listId}/items/${itemId}/attachments`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: fileName,
                contentBytes: fileContent
            })
        }
    );

    if (!response.ok) {
        console.error(`Failed to add attachment: ${await response.text()}`);
        // Don't throw - attachments are not critical
    }
}

// Main function handler
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

        // Get access token
        const accessToken = await getAccessToken();
        
        // Get site and list IDs
        const { siteId, listId } = await getSiteAndListIds(accessToken);

        let createdIds = [];

        if (data.requestType === 'Repeated Task List') {
            // Daily flight list - create multiple items
            for (const mission of data.missions) {
                const itemData = mapToSharePointFields(mission);
                const result = await createListItem(accessToken, siteId, listId, itemData);
                createdIds.push(result.id);

                // Add attachments to first item only
                if (createdIds.length === 1 && data.files && data.files.length > 0) {
                    for (const file of data.files) {
                        await addAttachment(accessToken, siteId, listId, result.id, file.name, file.data);
                    }
                }
            }
        } else {
            // Once-off request - create single item
            const itemData = mapToSharePointFields(data);
            const result = await createListItem(accessToken, siteId, listId, itemData);
            createdIds.push(result.id);

            // Add KML as attachment if present
            if (data.kmlData) {
                const kmlBase64 = Buffer.from(data.kmlData).toString('base64');
                await addAttachment(
                    accessToken, 
                    siteId, 
                    listId, 
                    result.id, 
                    `Mission_${result.id}.kml`, 
                    kmlBase64
                );
            }

            // Add uploaded files as attachments
            if (data.files && data.files.length > 0) {
                for (const file of data.files) {
                    await addAttachment(accessToken, siteId, listId, result.id, file.name, file.data);
                }
            }
        }

        context.res = {
            status: 200,
            headers,
            body: {
                success: true,
                message: 'Mission request submitted successfully',
                id: createdIds[0],
                count: createdIds.length
            }
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            headers,
            body: {
                success: false,
                message: error.message || 'An error occurred'
            }
        };
    }
};

// Map form data to SharePoint column names
function mapToSharePointFields(data) {
    // Adjust these field names to match your SharePoint list columns
    // The internal names might differ from display names
    const fields = {
        Title: data.title || 'Mission Request',
        SiteSelection: data.siteSelection,
        RequestType: data.requestType,
        WhereOnsite: data.whereOnsite,
        Site: data.site,
        MissionType: data.missionType,
        CustomerComment: data.customerComment,
        MissionDate: data.missionDate,
        MissionPriority: data.missionPriority,
        HowOften: data.howOften,
        SubmitterName: data.submitterName,
        SubmitterEmail: data.submitterEmail,
        ContactNumber: data.contactNumber,
        SiteOrder: data.siteOrder
    };

    // Add optional fields if present
    if (data.taskName) fields.TaskName = data.taskName;
    if (data.dock) fields.Dock = data.dock;
    if (data.plannedFlightTime) fields.PlannedFlightTime = data.plannedFlightTime;
    if (data.missionName) fields.MissionName = data.missionName;
    
    // Custom parameters
    if (data.customParams) {
        if (data.imageResolution) fields.ImageResolution = data.imageResolution;
        if (data.missionHeight) fields.MissionHeight = data.missionHeight;
        if (data.overlapForward) fields.ImageOverlapForward = data.overlapForward;
        if (data.overlapSide) fields.ImageOverlapSide = data.overlapSide;
        if (data.terrainFollowing) fields.TerrainFollowing = data.terrainFollowing;
        if (data.elevationOptimisation) fields.ElevationOptimisation = data.elevationOptimisation;
    }

    // Remove null/undefined values
    Object.keys(fields).forEach(key => {
        if (fields[key] === null || fields[key] === undefined || fields[key] === '') {
            delete fields[key];
        }
    });

    return fields;
}
