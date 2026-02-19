# SIA (Student Information Assessment) Web Application

A comprehensive web-based system for managing student assessments, exams, and data analysis.

## Quick Start Setup

### 1. Prerequisites
- Node.js 18+ 
- Firebase Project
- Vercel account (for deployment)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/Cristineddd/Web-Based-for-SIA.git
cd Web-Based-for-SIA

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local  # If .env.example exists, or create manually

# Add to .env.local:
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Firebase Setup

#### Critical: Configure Firestore Security Rules

The application requires specific Firestore security rules to work properly. Follow the instructions in `FIRESTORE_RULES.md` to set up your rules.

**Without proper rules, you'll get "Missing or insufficient permissions" errors.**

#### Create Firestore Collections

Ensure these collections exist in your Firestore database:
- `exams` - Exam data and configuration
- `students` - Student information
- `classes` - Class information
- `users` - User profiles
- `auditLogs` - Validation and action logs

### 4. Local Development

```bash
npm run dev
```

Visit `http://localhost:3000` to access the application.

### 5. Deployment to Vercel

```bash
npm run build
git add .
git commit -m "Ready for deployment"
git push origin main
```

Your site will be automatically deployed to Vercel.

#### Post-Deployment: Update Firebase OAuth Domains

1. Go to Firebase Console > Authentication > Settings
2. Add your Vercel domain to "Authorized domains"
3. Example: `your-app-ewa8goh94-cristineddds-projects.vercel.app`

## Features

- 📊 Exam Management - Create, edit, and manage exams
- 👥 Student Management - Track student information and performance
- 📈 Results Analysis - View detailed exam results and analytics
- 🔐 Role-based Access Control - Secure authentication system
- 📱 Responsive Design - Works on desktop, tablet, and mobile
- 🗂️ File Management - Upload and manage student rosters

## Project Structure

```
src/
├── components/     # React components
├── contexts/      # Context providers (Auth, etc.)
├── hooks/         # Custom React hooks
├── lib/           # Utility functions and Firebase config
├── services/      # Business logic and API integrations
└── types/         # TypeScript type definitions
```

## Troubleshooting

### "Missing or insufficient permissions" Error

This indicates Firestore security rules are not properly configured. See `FIRESTORE_RULES.md` for setup instructions.

### "The query requires an index" Error

Firestore is asking you to create a composite index. Click the link in the error message or refer to the Firestore console to create the index.

### Login Issues / "OAuth not authorized" Warning

Add your deployment domain to Firebase Console > Authentication > Settings > Authorized domains.

## Support

For issues or questions, refer to the documentation in the `/docs` folder or check the troubleshooting guide in `FIRESTORE_RULES.md`.
