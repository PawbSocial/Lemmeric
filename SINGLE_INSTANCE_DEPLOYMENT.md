# Single Instance Deployment Guide

This guide explains how to deploy Lemmeric as a custom UI for your own Lemmy instance, removing the multi-instance functionality and using your instance's branding.

## Overview

When deployed in single instance mode, Lemmeric will:
- Remove the instance selector from settings
- Use your instance's name and icon in the navbar
- Lock users to your instance only
- Fetch branding information from your instance's `/site` API endpoint

## Quick Setup

### 1. Enable Single Instance Mode

In `js/config.js`, set:

```javascript
export const CONFIG = {
    // Instance deployment mode
    SINGLE_INSTANCE_MODE: true,
    
    // Single instance configuration
    SINGLE_INSTANCE_URL: 'https://your-instance.com',
    
    // ... rest of config
};
```

### 2. Configure Your Instance URL

Set the `SINGLE_INSTANCE_URL` to your instance's full URL:

```javascript
SINGLE_INSTANCE_URL: 'https://your-instance.com'
```

**Note**: The `INSTANCES` object is not used in single instance mode. Your instance's branding (name, description, icon) will be automatically fetched from the API.

### 3. Deploy

Deploy the modified code to your web server. The UI will automatically:
- Hide the instance selector in settings
- Fetch your instance's name and icon from the `/site` API
- Update the navbar branding accordingly

## How It Works

### Branding Fetching

When `SINGLE_INSTANCE_MODE` is enabled, Lemmeric will:

1. Call your instance's `/site` API endpoint
2. Extract the `site.name` and `site.icon` fields
3. Update the navbar logo and text with your instance's branding
4. Fall back to default branding if the API call fails

### Instance Locking

- Users cannot switch to other instances
- The instance selector is completely hidden in settings
- All API calls are locked to your configured instance

### Settings Changes

The following settings are automatically hidden in single instance mode:
- Default Instance selector
- Instance switching functionality

## Customization Options

### Custom Branding

You can override the API-fetched branding by setting values in your instance config:

```javascript
INSTANCES: {
    'your-instance.com': {
        name: 'Custom Name', // Override API name
        icon: '/custom-logo.png', // Override API icon
        // ... other settings
    }
}
```

### Theme Customization

The existing theme system remains fully functional, allowing users to choose between light and dark themes.

## Troubleshooting

### Branding Not Updating

1. Check that your instance's `/site` API endpoint is accessible
2. Verify the API returns `site_view.site.name` and `site_view.site.icon`
3. Check browser console for any API errors

### Instance Selector Still Visible

1. Ensure `SINGLE_INSTANCE_MODE: true` is set in config.js
2. Clear browser cache and reload
3. Check that the config.js file is being loaded correctly

### API Errors

1. Verify your instance's API endpoint is correct
2. Check CORS settings if deploying to a different domain
3. Ensure the API is accessible from your deployment location

## Example Configuration

See `config.example.js` for a complete example configuration file that you can use as a starting point.

## Security Considerations

- The `/site` API endpoint is public and doesn't require authentication
- No sensitive information is exposed through the branding system
- Users can still authenticate normally with your instance

## Support

If you encounter issues with single instance deployment:
1. Check the browser console for error messages
2. Verify your instance's API endpoints are working
3. Ensure all configuration values are correctly set
