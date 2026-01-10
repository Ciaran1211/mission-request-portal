# Mission Request Portal

A professional web application for submitting drone mission requests at mining sites. Built for RocketDNA to serve clients including BMA, Goldfields, and Norton Gold Fields.

## 🚀 Features

- **Dual Request Modes**: Single mission requests or repeat mission scheduling
- **Interactive Map Widget**: Draw mission areas with polygon, rectangle, circle, line, and point tools
- **KML Export**: Generate KML files from drawn mission areas
- **File Attachments**: Upload supporting documents directly to SharePoint
- **Multi-Company Support**: Configurable for different mining companies and sites
- **Priority System**: 5-level priority classification with visual indicators
- **Mobile Responsive**: Fully functional on desktop and mobile devices

## 📋 System Architecture

```
┌──────────────┐      ┌──────────────┐      ┌─────────────────┐      ┌────────────┐
│   Web Form   │ ──── │   EmailJS    │ ──── │ Power Automate  │ ──── │ SharePoint │
│              │      │  (sends      │      │ (email trigger, │      │   List     │
│              │      │   email)     │      │  parses JSON)   │      │            │
└──────────────┘      └──────────────┘      └─────────────────┘      └────────────┘
```

## 🛠️ Quick Setup

### 1. Configure EmailJS

1. Create account at [emailjs.com](https://www.emailjs.com/)
2. Add email service and create template
3. Update `src/js/config.js`:

```javascript
const EMAILJS_CONFIG = {
    publicKey: 'your_public_key',
    serviceId: 'your_service_id',
    templateId: 'your_template_id'
};
```

### 2. Configure Power Automate

1. Create flow with "When a new email arrives" trigger
2. Filter for subject: `[MISSION REQUEST]`
3. Parse JSON from email body
4. Create SharePoint list item

### 3. Deploy

```bash
# Azure Static Web Apps
az staticwebapp create --name mission-portal --source ./src

# Or upload src/ to any static hosting
```

### 4. Access

```
https://your-domain.com/?company=BMA
https://your-domain.com/?company=Goldfields
https://your-domain.com/?company=Norton
```

## 📁 Project Structure

```
mission-request-portal/
├── src/
│   ├── css/
│   │   └── styles.css          # All styling (documented, organized)
│   ├── js/
│   │   ├── config.js           # Company/site configuration
│   │   ├── app.js              # Main application logic
│   │   └── map-widget.js       # OpenLayers map module
│   ├── logos/
│   │   └── gold-fields-logo.svg
│   ├── index.html              # Main form interface
│   └── map-widget.html         # Embedded map widget
├── staticwebapp.config.json    # Azure SWA configuration
├── README.md                   # This file
└── README_OPTIMIZATION_SUMMARY.md  # Detailed optimization notes
```

## ⚙️ Configuration

### Adding Companies

Edit `src/js/config.js`:

```javascript
const COMPANY_CONFIG = {
    'NewCompany': {
        name: 'NewCompany',
        displayName: 'New Company Display Name',
        logo: 'path/to/logo.svg',  // Optional
        sites: {
            'SITE_KEY': {
                name: 'Site Name',
                areas: ['Area 1', 'Area 2'],
                repeatMissions: [
                    {
                        display: 'Mission Display Name',
                        sharepoint: 'SharePoint List Title',
                        dock: 'Dock Location',
                        plannedFlightTime: 20,
                        missionType: 'Survey'
                    }
                ]
            }
        }
    }
};
```

### Adding Map Sites

Edit `src/map-widget.html` SITES object:

```javascript
'SITE_KEY': {
    name: 'Site Name',
    company: 'CompanyName',
    tileUrl: 'https://your-tile-server/{z}/{x}/{y}.png',
    center: [longitude, latitude],
    defaultZoom: 15
}
```

## 🎨 Customization

### Styling

All styles use CSS custom properties in `src/css/styles.css`:

```css
:root {
    --navy: #0F2458;
    --cyan: #0ABAEF;
    --pink: #E92F8B;
    /* ... more variables */
}
```

### Priority Levels

| Level | Name | Response Time | Color |
|-------|------|---------------|-------|
| 1 | Critical | Within 30 min | Red |
| 2 | High | Within 4 hours | Orange |
| 3 | Medium | Before 13:00 | Yellow |
| 4 | Low | End of day | Green |
| 5 | Flexible | Next day | Cyan |

## 📧 Email Template

Required EmailJS template variables:

```
{{title}}           - Mission title
{{ref_id}}          - Reference ID
{{company}}         - Company name
{{site}}            - Site name
{{site_area}}       - Site area
{{mission_name}}    - Mission name
{{mission_type}}    - Mission type
{{scheduled_date}}  - Scheduled date
{{priority}}        - Priority level
{{requested_by}}    - Requester name
{{email}}           - Contact email
{{phone}}           - Contact phone
{{json_data}}       - Full JSON payload
{{submitted_at}}    - Submission timestamp
```

## 🔐 Security

- Content Security Policy headers configured
- Input validation on all form fields
- XSS prevention through HTML encoding
- CORS headers for API endpoints

## 📱 Browser Support

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+
- Mobile browsers (iOS Safari, Chrome for Android)

## 🧪 Testing

### Manual Test Checklist

1. [ ] Load with valid company parameter
2. [ ] Load with invalid company (shows error)
3. [ ] Select site and verify areas populate
4. [ ] Submit single request
5. [ ] Submit repeat missions
6. [ ] Draw shapes on map
7. [ ] Export KML file
8. [ ] Upload attachments
9. [ ] Test on mobile device

## 📄 License

MIT License - See LICENSE file for details.

## 🆘 Support

- **Technical Issues**: Check browser console for errors
- **Configuration**: Review config.js comments
- **Integration**: Test EmailJS and Power Automate separately

---

*Built with ❤️ for RocketDNA drone operations*
