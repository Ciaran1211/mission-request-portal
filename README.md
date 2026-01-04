# Mission Request Portal

A custom web application for submitting drone mission requests directly to SharePoint, replacing the JotForm + Power Automate workflow.

## Features

- **Once-off Mission Requests**: Draw mission areas on an interactive map, specify parameters, and submit
- **Daily Flight Lists**: Select from predefined daily flights with automatic expansion and dock assignments
- **File Attachments**: Upload KML, PDF, and image files
- **Direct SharePoint Integration**: Creates list items and attachments directly via Microsoft Graph API

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Static Web Apps                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Frontend (HTML/CSS/JS)                      │    │
│  │  • src/index.html                                        │    │
│  │  • src/css/styles.css                                    │    │
│  │  • src/js/app.js, map-widget.js                         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Azure Function (API)                        │    │
│  │  • api/SubmitMission/index.js                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │   SharePoint    │
                    │   List          │
                    └─────────────────┘
```

---

## Deployment Guide

### Prerequisites

1. **Azure Subscription** (free tier works)
2. **Azure AD access** (to register an app)
3. **SharePoint site** with a list created
4. **GitHub account** (for deployment)

---

### Step 1: Azure AD App Registration

1. Go to **Azure Portal** → **Azure Active Directory** → **App registrations**

2. Click **New registration**
   - Name: `Mission Request Portal`
   - Supported account types: `Accounts in this organizational directory only`
   - Click **Register**

3. Note down:
   - **Application (client) ID**: `_______________________`
   - **Directory (tenant) ID**: `_______________________`

4. Go to **Certificates & secrets** → **New client secret**
   - Description: `Mission Request Secret`
   - Expires: `24 months`
   - Click **Add**
   - **Copy the Value immediately!**: `_______________________`

5. Go to **API permissions** → **Add a permission**
   - Select **Microsoft Graph**
   - Select **Application permissions**
   - Search and check:
     - `Sites.ReadWrite.All`
   - Click **Add permissions**
   - Click **Grant admin consent for [Your Org]**

---

### Step 2: Create SharePoint List

Ensure your SharePoint list has these columns:

| Column Name | Type | Required |
|-------------|------|----------|
| Title | Single line of text | Yes |
| SiteSelection | Single line of text | |
| RequestType | Single line of text | |
| WhereOnsite | Single line of text | |
| Site | Single line of text | |
| MissionName | Single line of text | |
| MissionType | Single line of text | |
| TaskName | Single line of text | |
| CustomerComment | Multiple lines of text | |
| MissionDate | Date only | |
| MissionPriority | Number | |
| HowOften | Single line of text | |
| SubmitterName | Single line of text | |
| SubmitterEmail | Single line of text | |
| ContactNumber | Single line of text | |
| SiteOrder | Number | |
| Dock | Single line of text | |
| PlannedFlightTime | Number | |
| ImageResolution | Number | |
| MissionHeight | Number | |
| ImageOverlapForward | Number | |
| ImageOverlapSide | Number | |
| TerrainFollowing | Single line of text | |
| ElevationOptimisation | Single line of text | |

---

### Step 3: Push to GitHub

1. Create a new GitHub repository

2. Push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/mission-request-portal.git
   git push -u origin main
   ```

---

### Step 4: Deploy to Azure Static Web Apps

1. Go to **Azure Portal** → **Create a resource** → **Static Web App**

2. Fill in:
   - **Subscription**: Your subscription
   - **Resource Group**: Create new or use existing
   - **Name**: `mission-request-portal`
   - **Plan type**: `Free`
   - **Region**: Choose closest to you
   - **Source**: `GitHub`
   - **Organization**: Your GitHub username
   - **Repository**: `mission-request-portal`
   - **Branch**: `main`

3. Build Details:
   - **Build Preset**: `Custom`
   - **App location**: `/src`
   - **Api location**: `/api`
   - **Output location**: `` (leave empty)

4. Click **Review + create** → **Create**

5. Wait for deployment (GitHub Action will run automatically)

---

### Step 5: Configure Environment Variables

1. In Azure Portal, go to your Static Web App

2. Go to **Configuration** → **Application settings**

3. Add these settings:

   | Name | Value |
   |------|-------|
   | `TENANT_ID` | Your Azure AD tenant ID |
   | `CLIENT_ID` | Your app registration client ID |
   | `CLIENT_SECRET` | Your app registration secret |
   | `SHAREPOINT_SITE_URL` | `https://yourtenant.sharepoint.com/sites/yoursite` |
   | `SHAREPOINT_LIST_NAME` | `Mission Requests` (or your list name) |

4. Click **Save**

---

### Step 6: Test the Application

1. Go to your Static Web App URL (shown in Overview)

2. Fill out the form and submit

3. Check your SharePoint list for the new item

---

## Local Development

### Prerequisites

- Node.js 18+
- Azure Functions Core Tools v4
- Azure CLI (optional)

### Setup

1. Install API dependencies:
   ```bash
   cd api
   npm install
   ```

2. Create `api/local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "AzureWebJobsStorage": "",
       "TENANT_ID": "your-tenant-id",
       "CLIENT_ID": "your-client-id",
       "CLIENT_SECRET": "your-client-secret",
       "SHAREPOINT_SITE_URL": "https://yourtenant.sharepoint.com/sites/yoursite",
       "SHAREPOINT_LIST_NAME": "Mission Requests"
     }
   }
   ```

3. Start the Azure Functions locally:
   ```bash
   cd api
   func start
   ```

4. Serve the frontend (use any static server):
   ```bash
   cd src
   npx serve .
   ```

5. Or use the Static Web Apps CLI:
   ```bash
   npm install -g @azure/static-web-apps-cli
   swa start src --api-location api
   ```

---

## Customization

### Adding New Sites

Edit `src/js/map-widget.js`:

```javascript
const SITES = {
    'Saraji': {
        name: 'Saraji',
        center: [148.2875, -22.40],  // [longitude, latitude]
        defaultZoom: 14,
        tileUrl: 'https://your-tile-server/tiles/{z}/{x}/{y}'
    },
    // Add more sites here
};
```

### Adding New Flight Tasks

Edit `src/js/app.js`:

```javascript
const FLIGHT_CONFIG = {
    'New Task': {
        missionType: 'Survey - Nadir',
        plannedFlightTime: 30,
        dock: 'Dock Name'
    },
    // Add more tasks here
};
```

Also update the HTML in `src/index.html` to add checkboxes for new tasks.

### Modifying SharePoint Field Mapping

Edit `api/SubmitMission/index.js` → `mapToSharePointFields()` function.

---

## Troubleshooting

### "Failed to get site" Error

- Verify `SHAREPOINT_SITE_URL` is correct (no trailing slash)
- Ensure the app has `Sites.ReadWrite.All` permission
- Ensure admin consent was granted

### "List not found" Error

- Check `SHAREPOINT_LIST_NAME` matches exactly (case-sensitive)
- Verify the list exists on the specified site

### CORS Errors

- The API includes CORS headers for all origins
- If still having issues, check browser console for specific errors

### File Upload Issues

- Maximum file size is ~100MB (Azure Functions limit)
- Ensure file types are allowed in the HTML input

---

## Security Considerations

1. **Client Secret**: Store only in Azure App Settings, never in code
2. **API Permissions**: `Sites.ReadWrite.All` is broad - consider using `Sites.Selected` for production
3. **CORS**: Restrict to specific domains in production
4. **Rate Limiting**: Consider implementing rate limiting for the API

---

## License

MIT License - Feel free to modify and use as needed.
