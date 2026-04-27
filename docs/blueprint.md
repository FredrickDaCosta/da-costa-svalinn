# **App Name**: Da-Costa Cybersecurity Suite

## Core Features:

- Secure User Authentication: Enable secure user registration and login, supporting role-based access for system administrators leveraging Firebase Authentication.
- Unified Security Dashboard: Provide a central 'Single Pane of Glass' dashboard displaying real-time security status, scan history, available credits, and toggleable access to all security modules.
- Smart Link Scrutinizer (AI Tool): An AI tool allowing users to input URLs for stateless metadata analysis, generating a JSON-formatted risk assessment and actionable recommendations.
- Status 'Lure' Detector (AI Tool): An AI tool to analyze user-submitted text or images for social engineering attempts, such as phishing or impersonation, providing a JSON confidence score.
- Transparent Onboarding & Consent: Guide new users through an initial setup process, transparently disclosing AI usage, stateless processing, zero data retention, and obtaining explicit user consent.
- Premium Video Metadata Auditor (AI Tool): Offer a premium, AI-driven tool for uploading MP4 video file headers (no video content) for analysis, detecting exploits or malformed metadata, and presenting a JSON risk rating.
- Credit & Subscription Management: An interface for tracking remaining scan credits, purchasing additional credit packs, and managing premium subscription status, integrated with payment gateways and Firebase Firestore for balance management.

## Style Guidelines:

- Background Color: A very dark, deep blue-grey (`HSL(210, 37%, 4%)`, Hex: #070A0F) forming the 'Black Glass' theme base.
- Primary Color: A vibrant electric green (`HSL(86, 100%, 62%)`, Hex: #B6FF3B), representing success, system integrity, and key interactive elements, offering high contrast on the dark background.
- Accent Color: A bright, vivid yellow (`HSL(56, 90%, 70%)`, Hex: #FAED49) to highlight secondary actions and critical interface elements, analogous to the primary color.
- Alert Color: A strong, striking magenta (`HSL(318, 100%, 62%)`, Hex: #FF3BD4) for warning messages, error indicators, and high-priority alerts.
- Headline Font: 'Hubot Sans' (sans-serif) for its modern, technical, and high-contrast appearance. Note: currently only Google Fonts are supported.
- Body Text Font: 'Inter' (sans-serif) for optimal readability and a neutral, professional aesthetic, suitable for detailed information and complementing the headline font. Note: currently only Google Fonts are supported.
- Use sharp, geometric line-art icons that align with a high-tech cybersecurity theme, ensuring clarity and minimalist appeal on the dark interface.
- Implement a minimal, high-contrast layout focusing on single-tap actions, optimized for mobile use with robust support for low-bandwidth conditions and offline access for essential features.
- Incorporate subtle, performant animations for module transitions, scan feedback, and credit updates, maintaining a responsive user experience without sacrificing speed or clarity.