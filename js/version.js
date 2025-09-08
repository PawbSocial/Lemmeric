/**
 * Lemmeric Version Information
 * 
 * This file contains the current version of Lemmeric.
 * Update this version number when releasing new versions.
 * 
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes
 * - MINOR: New features, backward compatible
 * - PATCH: Bug fixes, backward compatible
 * 
 * IMPORTANT: This file should NOT be copied by users to preserve their settings.
 * It should be updated manually during releases to reflect the current version.
 */

export const LEMMERIC_VERSION = '0.1.0';

// Build date (automatically updated during deployment)
export const BUILD_DATE = '2025-09-01';

// Repository URL (update this when you set up your GitHub repo)
// Example: 'https://github.com/yourusername/lemmeric-lemmy-ui'
export const REPOSITORY_URL = 'https://github.com/yourusername/lemmeric-lemmy-ui';

// Version info object for easy access
export const VERSION_INFO = {
    version: LEMMERIC_VERSION,
    buildDate: BUILD_DATE,
    name: 'Lemmeric',
    repository: REPOSITORY_URL
};
