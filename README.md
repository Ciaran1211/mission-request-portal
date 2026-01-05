# Mission Request Portal

A web application for submitting drone mission requests. Uses Power Automate to connect to SharePoint - no Azure AD admin access required.

## Features

- **Company-specific URLs**: Each company gets their own form link (e.g., `?company=BMA`)
- **Dynamic Site Selection**: Sites and areas cascade based on company
- **Interactive Map Widget**: Draw mission areas with polygon, rectangle, circle, line, and point tools
- **Custom Flight Parameters**: Optionally specify resolution, height, overlap, terrain following
- **File Attachments**: Upload KML, PDF, images, and shapefiles
- **Power Automate Integration**: Connects to SharePoint via webhook (no admin permissions needed)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Static Web Apps                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Frontend                                    │    │
│  │  • src/index.html (form)                                │    │
│  │  • src/map-widget.html (embedded map iframe)            │    │
│  │  • src/js/app.js                                        │    │
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
                    │  Power Automate │
                    │  Webhook Flow   │
                    └─────────────────┘
                               │
                               ▼
                    ┌─────────────────┐
                    │   SharePoint    │
                    │      List       │
                    └─────────────────┘
```

---

## Setup Guide

### Step 1: Create Power Automate Flow

1. Go to [make.powerautomate.com](https://make.powerautomate.com)

2. Click **Create** → **Instant cloud flow**

3. Name: `Mission Request Webhook`

4. Trigger: **When an HTTP request is received**

5. Click **Create**

6. In the HTTP trigger, click **Use sample payload to generate schema** and paste:

```json
{
    "Title": "250104 BMA Saraji 6W Test Mission",
    "Scheduled Date": "2025-01-04",
    "Company": "BMA",
    "Site": "Saraji",
    "Priority": "3 - Medium",
    "Mission Type": "Survey - Nadir (standard mapping survey)",
    "Frequency": "Once",
    "Mission Plan": "New Request",
    "Job Status": "Incomplete",
    "Comments": "Test Mission",
    "Customer Comments": "Please survey the northern section",
    "Requested by": "John Smith",
    "Email contact": "john.smith@example.com",
    "Ph. Contact": "+61 400 000 000",
    "Attachment?": "No",
    "Customer Parameters?": "Yes",
    "Resolution": 2.5,
    "Height (mAGL)": 100,
    "Side Overlap (%)": 65,
    "Forward Overlap (%)": 75,
    "Terrain Follow?": "Yes",
    "Elev. Opt?": "No",
    "_siteArea": "6W",
    "_kmlData": "",
    "_submittedAt": "2025-01-04T10:30:00.000Z"
}
```

7. Click **+ New step** → Search **SharePoint** → **Create item**

8. Configure SharePoint action:
   - **Site Address**: Select your SharePoint site
   - **List Name**: Select your list
   - Map the fields from Dynamic content:

| SharePoint Field | Dynamic Content |
|-----------------|-----------------|
| Title | `Title` |
| Scheduled Date | `Scheduled Date` |
| Company | `Company` |
| Site | `Site` |
| __Priority | `Priority` |
| Mission Type | `Mission Type` |
| Frequency | `Frequency` |
| Mission Plan | `Mission Plan` |
| Job Status | `Job Status` |
| Comments | `Comments` |
| Customer Comments | `Customer Comments` |
| Requested by | `Requested by` |
| Email contact | `Email contact` |
| Ph. Contact | `Ph. Contact` |
| Attachment? | `Attachment?` |
| Customer Parameters? | `Customer Parameters?` |
| Resolution | `Resolution` |
| Height (mAGL) | `Height (mAGL)` |
| Side Overlap (%) | `Side Overlap (%)` |
| Forward Overlap (%) | `Forward Overlap (%)` |
| Terrain Follow? | `Terrain Follow?` |
| Elev. Opt? | `Elev. Opt?` |

9. **Save** the flow

10. Go back to the HTTP trigger and copy the **HTTP POST URL**

---

### Step 2: Deploy to Azure Static Web Apps

1. Push this code to a GitHub repository

2. In Azure Portal → **Create a resource** → **Static Web App**

3. Configure:
   - **Name**: `mission-request-portal`
   - **Plan type**: `Free`
   - **Source**: `GitHub`
   - **Repository**: Your repo
   - **Branch**: `main`
   - **Build Preset**: `Custom`
   - **App location**: `/src`
   - **Api location**: `/api`
   - **Output location**: (leave empty)

4. Click **Create**

---

### Step 3: Configure Environment Variables

1. In Azure Portal → Your Static Web App → **Configuration**

2. Add Application Setting:
   - **Name**: `POWER_AUTOMATE_WEBHOOK_URL`
   - **Value**: (paste your Power Automate HTTP POST URL)

3. Click **Save**

---

### Step 4: Test

Access your form with a company parameter:

```
https://your-app.azurestaticapps.net/?company=BMA
https://your-app.azurestaticapps.net/?company=Goldfields
https://your-app.azurestaticapps.net/?company=RioTinto
https://your-app.azurestaticapps.net/?company=FMG
https://your-app.azurestaticapps.net/?company=Norton
```

---

## SharePoint List Fields

Your SharePoint list should have these columns:

| Column | Type | Notes |
|--------|------|-------|
| Title | Single line of text | Auto-generated: "YYMMDD Company Site Area MissionName" |
| Scheduled Date | Date and Time | |
| Company | Choice | BMA, Goldfields, RioTinto, FMG, Norton |
| Site | Choice | Site options per company |
| __Priority | Choice | 1 - Critical, 2 - High, 3 - Medium, 4 - Low, 5 - Flexible |
| Mission Type | Choice | Survey - Nadir, Survey - Oblique, Inspection, Panorama, etc. |
| Frequency | Choice | Once, Daily, Weekly, Fortnightly, Monthly, Quarterly |
| Mission Plan | Choice | Default: "New Request" |
| Job Status | Choice | Default: "Incomplete" |
| Planned Flight Time (min) | Number | For repeat missions |
| Comments | Single line of text | Mission name |
| Attachment? | Yes/No | |
| Customer Comments | Multiple lines of text | Description/notes |
| Customer Parameters? | Choice | Yes/No |
| Requested by | Single line of text | |
| Email contact | Hyperlink or Picture | |
| Resolution | Number | cm/px |
| Height (mAGL) | Number | meters above ground |
| Side Overlap (%) | Number | |
| Forward Overlap (%) | Number | |
| Terrain Follow? | Choice | Yes/No |
| Elev. Opt? | Choice | Yes/No |
| Ph. Contact | Single line of text | Phone number |
| Site Order | Number | For repeat missions |
| Dock | Choice | For specific sites |

---

## Adding New Companies/Sites

### 1. Edit `src/js/app.js`

Add to `COMPANY_CONFIG`:

```javascript
'NewCompany': {
    name: 'NewCompany',
    displayName: 'New Company Display Name',
    sites: {
        'site-key': {
            name: 'Site Name',
            areas: ['Area 1', 'Area 2', 'Area 3']
        }
    }
}
```

### 2. Edit `src/map-widget.html`

Add to `SITES` object (around line 352):

```javascript
'site-key': {
    name: 'Site Name',
    company: 'NewCompany',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    center: [longitude, latitude],
    defaultZoom: 14
}
```

For custom orthomosaic tiles, use your tile server URL instead.

---

## Local Development

1. Install Azure Static Web Apps CLI:
   ```bash
   npm install -g @azure/static-web-apps-cli
   ```

2. Create `api/local.settings.json`:
   ```json
   {
     "IsEncrypted": false,
     "Values": {
       "FUNCTIONS_WORKER_RUNTIME": "node",
       "POWER_AUTOMATE_WEBHOOK_URL": "your-webhook-url"
     }
   }
   ```

3. Run locally:
   ```bash
   swa start src --api-location api
   ```

---

## Handling Attachments

The form collects files and KML data, but they're sent as base64 in `_files` and `_kmlData` fields. To handle attachments in Power Automate:

### Option A: Store KML in Customer Comments
Add a Compose action to append KML data to comments.

### Option B: Save to SharePoint Document Library
Add a "Create file" action to save attachments to a document library.

### Option C: Send via Email
Add a "Send email" action with attachments for review.

---

## Troubleshooting

### "Server configuration error"
- Check that `POWER_AUTOMATE_WEBHOOK_URL` is set in Azure Static Web App Configuration

### "Failed to submit to Power Automate"
- Verify the webhook URL is correct
- Check Power Automate flow run history for errors
- Ensure the flow is turned on

### Map not loading
- Check browser console for errors
- Verify the site key exists in both `app.js` and `map-widget.html`

### Invalid Company page shown
- Add `?company=CompanyName` to the URL
- Ensure company key exists in `COMPANY_CONFIG`

---

## License

MIT License
