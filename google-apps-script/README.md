# Google Apps Script Email Setup

## Quick Setup

1. **Open Google Apps Script**
   - Go to [script.google.com](https://script.google.com)
   - Click "New Project"

2. **Paste the Code**
   - Copy the contents of `email-sender.gs` from this folder
   - Paste into the Apps Script editor

3. **Deploy as Web App**
   - Click "Deploy" → "New Deployment"
   - Type: "Web App"
   - Execute as: **Me**
   - Who has access: **Anyone** (or "Anyone with Google account" for Gmail)
   - Click "Deploy"
   - **Copy the Web App URL**

4. **Configure Environment**
   - Open `.env` in your project root
   - Add: `APPS_SCRIPT_EMAIL_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec`
   - Replace `YOUR_SCRIPT_ID` with the ID from your deployed URL

5. **Test**
   - Submit feedback in the app
   - Check the admin email (official.uniosun@edu.ng) for the notification

## How It Works

The Apps Script receives a POST request with:
```json
{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Plain text body",
  "html": "Optional HTML body"
}
```

It uses `GmailApp.sendEmail()` to send via your Gmail account.

## CORS Handling

The script handles CORS preflight (OPTIONS) requests automatically.

## Limits

- **Daily quota**: 100 emails/day (free Gmail) / 1,500/day (Google Workspace)
- **Execution time**: 30 seconds max
- **Attachment size**: 25MB total

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Script function not found: doPost" | Ensure you saved the project after pasting code |
| CORS errors | Check that "Anyone" has access in deployment settings |
| "Authorization required" | Run `doPost` once manually in Apps Script editor to authorize |
| Emails not sending | Check quotas in Apps Script dashboard |