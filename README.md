# Mission Request Portal

A web application for submitting drone mission requests. Uses EmailJS + Power Automate email trigger to connect to SharePoint - completely free, no premium licenses needed.

## How It Works

```
┌──────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌────────────┐
│   Web Form   │ ──── │   EmailJS    │ ──── │ Power Automate  │ ──── │ SharePoint │
│              │      │  (sends      │      │ (email trigger, │      │   List     │
│              │      │   email)     │      │  parses JSON)   │      │            │
└──────────────┘      └──────────────┘      └─────────────────┘      └────────────┘
```

---

## Setup Guide

### Step 1: Set Up EmailJS (5 minutes)

1. Go to [emailjs.com](https://www.emailjs.com/) → Sign up (free: 200 emails/month)

2. **Add Email Service:**
   - Go to **Email Services** → **Add New Service**
   - Choose Gmail, Outlook, or other
   - Connect your account
   - Note the **Service ID** (e.g., `service_abc123`)

3. **Create Email Template:**
   - Go to **Email Templates** → **Create New Template**
   - Set **To Email**: Your email that Power Automate monitors
   - Set **Subject**: `[MISSION REQUEST] {{title}}`
   - Set **Content**:

```
Reference: {{ref_id}}
Company: {{company}}
Site: {{site}} - {{site_area}}
Mission: {{mission_name}}
Type: {{mission_type}}
Date: {{scheduled_date}}
Priority: {{priority}}
Requested by: {{requested_by}}
Email: {{email}}
Phone: {{phone}}

===JSON_START===
{{json_data}}
===JSON_END===

Submitted: {{submitted_at}}
```

   - Click **Save**
   - Note the **Template ID** (e.g., `template_xyz789`)

4. **Get Public Key:**
   - Go to **Account** → **API Keys**
   - Note the **Public Key**

5. **Update app.js:**
   - Edit `src/js/app.js`
   - Find `EMAILJS_CONFIG` at the top and fill in:

```javascript
const EMAILJS_CONFIG = {
    publicKey: 'your_public_key_here',
    serviceId: 'your_service_id_here',
    templateId: 'your_template_id_here'
};
```

---

### Step 2: Create Power Automate Flow (10 minutes)

1. Go to [make.powerautomate.com](https://make.powerautomate.com)

2. **Create** → **Automated cloud flow**

3. **Flow name**: `Mission Request - Email to SharePoint`

4. **Trigger**: Search `When a new email arrives (V3)` → Select it → **Create**

5. **Configure trigger:**
   - **Folder**: Inbox
   - **Subject Filter**: `[MISSION REQUEST]`
   - **Include Attachments**: No

---

#### Add Action: Extract JSON

6. Click **+ New step** → Search **Compose** → Select it

7. **Rename** to `Extract JSON`

8. In **Inputs**, paste this expression:

```
substring(
  triggerOutputs()?['body/body'],
  add(indexOf(triggerOutputs()?['body/body'], '===JSON_START==='), 16),
  sub(indexOf(triggerOutputs()?['body/body'], '===JSON_END==='), add(indexOf(triggerOutputs()?['body/body'], '===JSON_START==='), 16))
)
```

---

#### Add Action: Parse JSON

9. Click **+ New step** → Search **Parse JSON** → Select it

10. **Content**: Select `Outputs` from the `Extract JSON` step (Dynamic content)

11. **Schema** - Click "Use sample payload" and paste:

```json
{
  "Title": "250104 BMA Saraji 6W Test Mission",
  "ScheduledDate": "2025-01-04",
  "Company": "BMA",
  "Site": "Saraji",
  "Priority": "3 - Medium",
  "MissionType": "Survey - Nadir (standard mapping survey)",
  "Frequency": "Once",
  "MissionPlan": "New Request",
  "JobStatus": "Incomplete",
  "Comments": "Test Mission",
  "CustomerComments": "Survey the area",
  "RequestedBy": "John Smith",
  "EmailContact": "john@example.com",
  "PhContact": "+61 400 000 000",
  "Attachment": "No",
  "CustomerParameters": "Yes",
  "Resolution": 2.5,
  "HeightAGL": 100,
  "SideOverlap": 65,
  "ForwardOverlap": 75,
  "TerrainFollow": "Yes",
  "ElevOpt": "No",
  "SiteArea": "6W",
  "SiteKey": "saraji",
  "SubmittedAt": "2025-01-04T10:30:00.000Z",
  "AttachmentNames": "None",
  "HasKML": "No"
}
```

---

#### Add Action: Create SharePoint Item

12. Click **+ New step** → Search **SharePoint Create item** → Select it

13. **Site Address**: Select your SharePoint site

14. **List Name**: Select your list

15. **Map the fields** from Dynamic content (Parse JSON step):

| SharePoint Column | Dynamic Content |
|-------------------|-----------------|
| Title | `Title` |
| Scheduled Date | `ScheduledDate` |
| Company | `Company` |
| Site | `Site` |
| __Priority | `Priority` |
| Mission Type | `MissionType` |
| Frequency | `Frequency` |
| Mission Plan | `MissionPlan` |
| Job Status | `JobStatus` |
| Comments | `Comments` |
| Customer Comments | `CustomerComments` |
| Requested by | `RequestedBy` |
| Email contact | `EmailContact` |
| Ph. Contact | `PhContact` |
| Attachment? | `Attachment` |
| Customer Parameters? | `CustomerParameters` |
| Resolution | `Resolution` |
| Height (mAGL) | `HeightAGL` |
| Side Overlap (%) | `SideOverlap` |
| Forward Overlap (%) | `ForwardOverlap` |
| Terrain Follow? | `TerrainFollow` |
| Elev. Opt? | `ElevOpt` |

16. Click **Save**

---

### Step 3: Deploy the Web Form

#### Option A: Azure Static Web Apps (Recommended)

1. Push code to GitHub

2. Azure Portal → Create → Static Web App
   - Source: GitHub
   - Build Preset: Custom
   - App location: `/src`
   - Api location: (leave empty - we don't need it)
   - Output: (leave empty)

3. Done! Access at `https://your-app.azurestaticapps.net/?company=BMA`

#### Option B: Any Static Hosting

Upload the `src` folder to:
- Netlify
- Vercel
- GitHub Pages
- Any web server

---

### Step 4: Test

1. Open form: `https://yoursite.com/?company=BMA`

2. Fill out and submit

3. Check:
   - Email arrives in your inbox
   - Power Automate flow runs successfully
   - SharePoint item is created

---

## Company URL Parameters

```
?company=BMA
?company=Goldfields
?company=RioTinto
?company=FMG
?company=Norton
```

---

## Adding New Companies/Sites

### 1. Edit `src/js/app.js`

Add to `COMPANY_CONFIG`:

```javascript
'NewCompany': {
    name: 'NewCompany',
    displayName: 'New Company Name',
    sites: {
        'site-key': {
            name: 'Site Name',
            areas: ['Area 1', 'Area 2', 'Area 3']
        }
    }
}
```

### 2. Edit `src/map-widget.html`

Add to `SITES` object:

```javascript
'site-key': {
    name: 'Site Name',
    company: 'NewCompany',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    center: [longitude, latitude],
    defaultZoom: 14
}
```

---

## SharePoint List Columns

| Column | Type | Notes |
|--------|------|-------|
| Title | Single line of text | Auto-generated |
| Scheduled Date | Date and Time | |
| Company | Choice | |
| Site | Choice | |
| __Priority | Choice | 1-Critical to 5-Flexible |
| Mission Type | Choice | |
| Frequency | Choice | Once, Daily, Weekly, etc. |
| Mission Plan | Choice | Defaults to "New Request" |
| Job Status | Choice | Defaults to "Incomplete" |
| Planned Flight Time (min) | Number | For repeat missions |
| Comments | Single line of text | Mission name |
| Attachment? | Yes/No | |
| Customer Comments | Multiple lines | |
| Customer Parameters? | Choice | |
| Requested by | Single line | |
| Email contact | Hyperlink | |
| Resolution | Number | |
| Height (mAGL) | Number | |
| Side Overlap (%) | Number | |
| Forward Overlap (%) | Number | |
| Terrain Follow? | Choice | |
| Elev. Opt? | Choice | |
| Ph. Contact | Single line | |
| Site Order | Number | For repeat missions |
| Dock | Choice | For specific sites |

---

## Handling Files/KML

Since email has size limits, files aren't attached. Options:

1. **Manual**: User uploads files to SharePoint separately

2. **OneDrive Link**: Add a field for users to paste a OneDrive link

3. **Separate Upload**: Create a separate file upload page that saves to SharePoint/OneDrive directly

---

## Troubleshooting

### Emails not arriving
- Check EmailJS dashboard for send logs
- Verify Service ID, Template ID, and Public Key
- Check spam folder

### Power Automate not triggering
- Verify subject filter matches exactly: `[MISSION REQUEST]`
- Check the folder is correct (Inbox)
- Test with a manual email containing `[MISSION REQUEST]` in subject

### JSON parse errors
- Check the email template has correct markers: `===JSON_START===` and `===JSON_END===`
- Look at the raw email body in flow run history
- Verify no extra whitespace in markers

### SharePoint errors
- Verify column internal names match (use List Settings to check)
- Check required fields have values
- Verify user has permission to create list items

---

## Costs

- **EmailJS Free Tier**: 200 emails/month
- **Power Automate**: Free with Microsoft 365
- **Azure Static Web Apps**: Free tier available
- **Total**: $0/month for low-medium usage

---

## License

MIT License
