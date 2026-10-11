/**
 * Google Apps Script for sending emails
 * 
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this code
 * 4. Deploy > New Deployment > Web App
 * 5. Execute as: Me
 * 6. Who has access: Anyone (or Anyone with Google account for Gmail)
 * 7. Copy the Web App URL and add to .env as APPS_SCRIPT_EMAIL_URL
 */

function doPost(e) {
  // Handle CORS preflight
  if (e.httpMethod === 'OPTIONS') {
    return ContentService.createTextOutput(JSON.stringify({status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeaders({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
  }

  try {
    const params = JSON.parse(e.postData.contents);
    const {to, subject, body, html} = params;

    if (!to || !subject || !body) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Missing required fields: to, subject, body'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Send email using Gmail service
    GmailApp.sendEmail(to, subject, body, {
      htmlBody: html || body,
      name: 'UniOsun Pulse',
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Email sent successfully'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
}