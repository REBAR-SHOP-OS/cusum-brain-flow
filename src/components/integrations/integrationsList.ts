import type { Integration } from "./IntegrationCard";

// Import logos
import gmailLogo from "@/assets/integrations/gmail.png";
import googleCalendarLogo from "@/assets/integrations/google-calendar.png";
import googleDriveLogo from "@/assets/integrations/google-drive.png";
import googleAnalyticsLogo from "@/assets/integrations/google-analytics.png";
import youtubeLogo from "@/assets/integrations/youtube.png";
import linkedinLogo from "@/assets/integrations/linkedin.png";
import facebookLogo from "@/assets/integrations/facebook.png";
import notionLogo from "@/assets/integrations/notion.png";
import stripeLogo from "@/assets/integrations/stripe.png";
import twilioLogo from "@/assets/integrations/twilio.png";
import dropboxLogo from "@/assets/integrations/dropbox.png";
import slackLogo from "@/assets/integrations/slack.svg";
import quickbooksLogo from "@/assets/integrations/quickbooks.svg";

export const defaultIntegrations: Integration[] = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Let helpers send emails and read your inbox.",
    status: "available",
    icon: gmailLogo,
    docsUrl: "https://developers.google.com/oauthplayground/",
    fields: [
      { key: "GMAIL_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console → Credentials" },
      { key: "GMAIL_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console → Credentials" },
      { key: "GMAIL_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "Get from OAuth Playground with Gmail scopes" },
    ],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Allow helpers to see and schedule events.",
    status: "available",
    icon: googleCalendarLogo,
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "GOOGLE_CALENDAR_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_CALENDAR_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_CALENDAR_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "From OAuth Playground with Calendar scopes" },
    ],
  },
  {
    id: "google-drive",
    name: "Google Drive",
    description: "Create and read docs, sheets, and other files.",
    status: "available",
    icon: googleDriveLogo,
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "GOOGLE_DRIVE_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_DRIVE_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console" },
      { key: "GOOGLE_DRIVE_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "From OAuth Playground with Drive scopes" },
    ],
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    description: "Read and update your QuickBooks data.",
    status: "available",
    icon: quickbooksLogo,
    docsUrl: "https://developer.intuit.com/app/developer/homepage",
    fields: [
      { key: "QUICKBOOKS_CLIENT_ID", label: "Client ID", type: "text", placeholder: "ABxxx", helpText: "From Intuit Developer Portal" },
      { key: "QUICKBOOKS_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "xxx", helpText: "From Intuit Developer Portal" },
      { key: "QUICKBOOKS_REALM_ID", label: "Realm ID (Company ID)", type: "text", placeholder: "123456789", helpText: "Your QuickBooks company ID" },
      { key: "QUICKBOOKS_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "AB11xxx", helpText: "From OAuth flow" },
    ],
  },
  {
    id: "ringcentral",
    name: "RingCentral",
    description: "Handle calls and SMS logging.",
    status: "available",
    icon: "ringcentral",
    docsUrl: "https://developers.ringcentral.com/",
    fields: [
      { key: "RINGCENTRAL_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx", helpText: "From RingCentral Developer Portal" },
      { key: "RINGCENTRAL_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "xxx", helpText: "From RingCentral Developer Portal" },
      { key: "RINGCENTRAL_JWT", label: "JWT Token", type: "textarea", placeholder: "eyJxxx", helpText: "JWT credential from RingCentral app" },
    ],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, manage channels, and communicate.",
    status: "available",
    icon: slackLogo,
    docsUrl: "https://api.slack.com/apps",
    fields: [
      { key: "SLACK_BOT_TOKEN", label: "Bot Token", type: "password", placeholder: "xoxb-xxx", helpText: "From Slack App → OAuth & Permissions" },
      { key: "SLACK_SIGNING_SECRET", label: "Signing Secret", type: "password", placeholder: "xxx", helpText: "From Slack App → Basic Information" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Read and update your Notion data.",
    status: "available",
    icon: notionLogo,
    docsUrl: "https://developers.notion.com/",
    fields: [
      { key: "NOTION_API_KEY", label: "Integration Token", type: "password", placeholder: "secret_xxx", helpText: "From Notion → Settings → Integrations" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Process payments and manage subscriptions.",
    status: "available",
    icon: stripeLogo,
    docsUrl: "https://dashboard.stripe.com/apikeys",
    fields: [
      { key: "STRIPE_SECRET_KEY", label: "Secret Key", type: "password", placeholder: "sk_live_xxx or sk_test_xxx", helpText: "From Stripe Dashboard → Developers → API keys" },
      { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook Secret", type: "password", placeholder: "whsec_xxx", helpText: "From Stripe Dashboard → Developers → Webhooks" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    description: "Send SMS and make voice calls.",
    status: "available",
    icon: twilioLogo,
    docsUrl: "https://console.twilio.com/",
    fields: [
      { key: "TWILIO_ACCOUNT_SID", label: "Account SID", type: "text", placeholder: "ACxxx", helpText: "From Twilio Console" },
      { key: "TWILIO_AUTH_TOKEN", label: "Auth Token", type: "password", placeholder: "xxx", helpText: "From Twilio Console" },
      { key: "TWILIO_PHONE_NUMBER", label: "Phone Number", type: "text", placeholder: "+1234567890", helpText: "Your Twilio phone number" },
    ],
  },
  {
    id: "dropbox",
    name: "Dropbox",
    description: "Read and update your Dropbox data.",
    status: "available",
    icon: dropboxLogo,
    docsUrl: "https://www.dropbox.com/developers/apps",
    fields: [
      { key: "DROPBOX_ACCESS_TOKEN", label: "Access Token", type: "password", placeholder: "sl.xxx", helpText: "From Dropbox App Console" },
    ],
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    description: "Access your Google Analytics data and insights.",
    status: "available",
    icon: googleAnalyticsLogo,
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "GA_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console" },
      { key: "GA_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console" },
      { key: "GA_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "From OAuth Playground" },
    ],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Create and share posts with your network.",
    status: "available",
    icon: linkedinLogo,
    docsUrl: "https://www.linkedin.com/developers/apps",
    fields: [
      { key: "LINKEDIN_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx", helpText: "From LinkedIn Developer Portal" },
      { key: "LINKEDIN_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "xxx", helpText: "From LinkedIn Developer Portal" },
      { key: "LINKEDIN_ACCESS_TOKEN", label: "Access Token", type: "textarea", placeholder: "xxx", helpText: "From OAuth flow" },
    ],
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Manage Facebook and Instagram pages and posts.",
    status: "available",
    icon: facebookLogo,
    docsUrl: "https://developers.facebook.com/apps/",
    fields: [
      { key: "FACEBOOK_APP_ID", label: "App ID", type: "text", placeholder: "xxx", helpText: "From Facebook Developer Console" },
      { key: "FACEBOOK_APP_SECRET", label: "App Secret", type: "password", placeholder: "xxx", helpText: "From Facebook Developer Console" },
      { key: "FACEBOOK_ACCESS_TOKEN", label: "Page Access Token", type: "textarea", placeholder: "xxx", helpText: "From Graph API Explorer" },
    ],
  },
  {
    id: "outlook",
    name: "Outlook",
    description: "Handle your Outlook emails.",
    status: "available",
    icon: "outlook",
    docsUrl: "https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps",
    fields: [
      { key: "OUTLOOK_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx", helpText: "From Azure Portal → App registrations" },
      { key: "OUTLOOK_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "xxx", helpText: "From Azure Portal → Certificates & secrets" },
      { key: "OUTLOOK_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "xxx", helpText: "From OAuth flow" },
    ],
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Upload and manage videos on your channel.",
    status: "available",
    icon: youtubeLogo,
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "YOUTUBE_CLIENT_ID", label: "Client ID", type: "text", placeholder: "xxx.apps.googleusercontent.com", helpText: "From Google Cloud Console" },
      { key: "YOUTUBE_CLIENT_SECRET", label: "Client Secret", type: "password", placeholder: "GOCSPX-xxx", helpText: "From Google Cloud Console" },
      { key: "YOUTUBE_REFRESH_TOKEN", label: "Refresh Token", type: "textarea", placeholder: "1//xxx", helpText: "From OAuth Playground" },
    ],
  },
];
