import { cn } from "@/lib/utils";

interface IntegrationIconProps {
  id: string;
  className?: string;
}

export function IntegrationIcon({ id, className }: IntegrationIconProps) {
  const iconClass = cn("w-8 h-8", className);

  switch (id) {
    case "gmail":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path fill="#4285F4" d="M22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6Z"/>
          <path fill="#EA4335" d="M22 6L12 13L2 6"/>
          <path fill="#FBBC05" d="M2 6L12 13V20H4C2.9 20 2 19.1 2 18V6Z"/>
          <path fill="#34A853" d="M22 6V18C22 19.1 21.1 20 20 20H12V13L22 6Z"/>
          <path fill="#C5221F" d="M22 6L12 13L2 6C2 4.9 2.9 4 4 4H20C21.1 4 22 4.9 22 6Z"/>
        </svg>
      );

    case "google-calendar":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <rect x="3" y="4" width="18" height="18" rx="2" fill="#fff" stroke="#4285F4" strokeWidth="1.5"/>
          <rect x="3" y="4" width="18" height="5" fill="#4285F4"/>
          <text x="12" y="16" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1A73E8">31</text>
          <rect x="7" y="2" width="2" height="4" rx="1" fill="#4285F4"/>
          <rect x="15" y="2" width="2" height="4" rx="1" fill="#4285F4"/>
        </svg>
      );

    case "google-drive":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path fill="#4285F4" d="M12 2L2 18H7L17 2H12Z"/>
          <path fill="#FBBC05" d="M17 2L7 18H22L12 2H17Z"/>
          <path fill="#34A853" d="M2 18L7 18L12 10L7 10L2 18Z"/>
          <path fill="#4285F4" d="M7 18H22L17 10H2L7 18Z"/>
          <path fill="#EA4335" d="M12 2L7 10H17L12 2Z"/>
        </svg>
      );

    case "quickbooks":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <circle cx="12" cy="12" r="10" fill="#2CA01C"/>
          <path d="M8 8V16M8 12H14C15.1 12 16 11.1 16 10C16 8.9 15.1 8 14 8H10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      );

    case "ringcentral":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <circle cx="12" cy="12" r="10" fill="#FF8200"/>
          <circle cx="12" cy="12" r="4" fill="white"/>
        </svg>
      );

    case "slack":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path fill="#E01E5A" d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
          <path fill="#36C5F0" d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z"/>
          <path fill="#2EB67D" d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z"/>
          <path fill="#ECB22E" d="M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
        </svg>
      );

    case "notion":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path fill="currentColor" d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.98-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466l1.823 1.447zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.166V6.354c0-.606-.233-.933-.748-.886l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952l1.448.327s0 .84-1.168.84l-3.22.186c-.094-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.454-.234 4.763 7.279V9.107l-1.215-.14c-.093-.514.28-.886.747-.933l3.225-.186zm-14.71-6.44L17.88.753c1.354-.093 1.727 0 2.567.606l3.267 2.474c.56.42.746.514.746 1.027v15.178c0 1.026-.373 1.633-1.68 1.726L5.86 22.84c-.98.047-1.448-.093-1.962-.746l-2.52-3.267c-.56-.7-.794-1.26-.794-1.913V5.413c0-.84.374-1.54 1.495-1.633l2.707-.187z"/>
        </svg>
      );

    case "stripe":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <rect width="24" height="24" rx="4" fill="#635BFF"/>
          <path fill="white" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.918 3.757 7.037c0 3.945 2.401 5.681 6.203 7.039 2.51.89 3.355 1.566 3.355 2.582 0 .972-.831 1.56-2.396 1.56-1.9 0-4.965-.917-7.04-2.166l-.888 5.549c1.956 1.116 5.31 1.954 8.283 1.954 2.644 0 4.863-.607 6.435-1.759 1.715-1.229 2.591-3.006 2.591-5.329 0-4.078-2.457-5.786-6.324-7.317z"/>
        </svg>
      );

    case "twilio":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <circle cx="12" cy="12" r="10" fill="#F22F46"/>
          <circle cx="9" cy="9" r="2" fill="white"/>
          <circle cx="15" cy="9" r="2" fill="white"/>
          <circle cx="9" cy="15" r="2" fill="white"/>
          <circle cx="15" cy="15" r="2" fill="white"/>
        </svg>
      );

    case "dropbox":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path fill="#0061FF" d="M6 2L0 6L6 10L0 14L6 18L12 14L18 18L24 14L18 10L24 6L18 2L12 6L6 2ZM6 4.5L10.5 7.5L6 10.5L1.5 7.5L6 4.5ZM18 4.5L22.5 7.5L18 10.5L13.5 7.5L18 4.5ZM12 8L16.5 11L12 14L7.5 11L12 8ZM6 12.5L10.5 15.5L6 18.5L1.5 15.5L6 12.5ZM18 12.5L22.5 15.5L18 18.5L13.5 15.5L18 12.5Z"/>
        </svg>
      );

    case "google-analytics":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <path fill="#F9AB00" d="M22 12C22 17.52 17.52 22 12 22C6.48 22 2 17.52 2 12C2 6.48 6.48 2 12 2C17.52 2 22 6.48 22 12Z"/>
          <rect x="6" y="10" width="3" height="8" rx="1.5" fill="#E37400"/>
          <rect x="10.5" y="6" width="3" height="12" rx="1.5" fill="#E37400"/>
          <rect x="15" y="8" width="3" height="10" rx="1.5" fill="#E37400"/>
        </svg>
      );

    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <rect width="24" height="24" rx="4" fill="#0A66C2"/>
          <path fill="white" d="M7.5 9.5H5V19H7.5V9.5ZM6.25 8.25C7.08 8.25 7.75 7.58 7.75 6.75C7.75 5.92 7.08 5.25 6.25 5.25C5.42 5.25 4.75 5.92 4.75 6.75C4.75 7.58 5.42 8.25 6.25 8.25ZM13 9.5H10.5V19H13V14C13 12.5 14.5 12 15.5 12C16.5 12 17 12.5 17 14V19H19.5V13C19.5 10 17 9 15.5 9C14 9 13 9.5 13 9.5V9.5Z"/>
        </svg>
      );

    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <circle cx="12" cy="12" r="10" fill="#1877F2"/>
          <path fill="white" d="M15.5 8H14C12.9 8 12.5 8.5 12.5 9.5V11H15.5L15 14H12.5V22H9.5V14H7V11H9.5V9C9.5 6.5 11 5 13.5 5C14.5 5 15.5 5.2 15.5 5.2V8Z"/>
        </svg>
      );

    case "outlook":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4"/>
          <ellipse cx="9" cy="12" rx="4" ry="5" fill="#28A8EA"/>
          <rect x="14" y="7" width="7" height="10" fill="#0364B8"/>
          <path d="M14 7L21 12L14 17V7Z" fill="#28A8EA"/>
        </svg>
      );

    case "youtube":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <rect x="2" y="4" width="20" height="16" rx="4" fill="#FF0000"/>
          <path fill="white" d="M10 8.5V15.5L16 12L10 8.5Z"/>
        </svg>
      );

    case "odoo":
      return (
        <svg viewBox="0 0 24 24" className={iconClass}>
          <rect width="24" height="24" rx="4" fill="#714B67"/>
          <circle cx="8" cy="12" r="3" fill="white"/>
          <circle cx="16" cy="12" r="3" fill="white"/>
          <path d="M11 12H13" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      );

    default:
      return (
        <div className={cn("rounded-lg bg-muted flex items-center justify-center text-muted-foreground", iconClass)}>
          ?
        </div>
      );
  }
}
