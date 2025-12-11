// App Blocker Extension - Background Service Worker

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  defaultAccessDuration: 15, // minutes
  blocklist: [],
  challengeTypes: {
    'typing': { difficulty: 3, duration: 1440 }
  }
};

// Store temporary access info
const temporaryAccessMap = new Map();

// Initialize extension
initializeExtension();

async function initializeExtension() {
  // Ensure default settings exist
  const settings = await getSettings();
  if (!settings || Object.keys(settings).length === 0) {
    await saveSettings(DEFAULT_SETTINGS);
  }

  // Load blocking rules
  await updateBlockingRules();

  console.log('App Blocker Extension initialized');
}

// Get current settings
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || {});
    });
  });
}

// Save settings
async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve();
    });
  });
}

// Update blocking rules based on current blocklist
async function updateBlockingRules() {
  const settings = await getSettings();
  const { blocklist = [], whitelist = [] } = settings;

  // Prepare rules for blocking
  const rulesToAdd = [];
  let ruleId = 1;

  // Process each blocked site
  for (const entry of blocklist) {
    // Check if this site has temporary access
    if (isSiteTemporarilyAccessible(entry.urlPattern)) {
      continue; // Skip blocking if temporarily accessible
    }

    // Create blocking rule for the site
    rulesToAdd.push({
      id: ruleId++,
      priority: 1,
      action: {
        type: "redirect",
        redirect: {
          url: chrome.runtime.getURL("friction-page/index.html") + "?originalUrl=" + encodeURIComponent(`https://${entry.urlPattern}`)
        }
      },
      condition: {
        urlFilter: `*://*.${entry.urlPattern}/*`,
        resourceTypes: ["main_frame"]
      }
    });
  }

  // Update the blocking rules
  try {
    await chrome.declarativeNetRequest.updateSessionRules({
      addRules: rulesToAdd,
      removeRuleIds: rulesToAdd.map(rule => rule.id)
    });
    console.log(`${rulesToAdd.length} blocking rules updated`);
  } catch (error) {
    console.error('Error updating blocking rules:', error);
  }
}

// Check if a site is temporarily accessible
function isSiteTemporarilyAccessible(urlPattern) {
  const now = Date.now();

  // Check if we have temporary access for this pattern
  if (temporaryAccessMap.has(urlPattern)) {
    const accessInfo = temporaryAccessMap.get(urlPattern);

    // Return true if access is still valid (not expired)
    if (accessInfo.expiresAt > now) {
      return true;
    } else {
      // Clear expired access
      temporaryAccessMap.delete(urlPattern);
    }
  }

  return false;
}

// Grant temporary access to a site
async function grantTemporaryAccess(urlPattern, durationMinutes, timeSpentOnChallenge = 0) {
  const now = Date.now();
  const expiresAt = now + (durationMinutes * 60 * 1000); // Convert minutes to milliseconds

  temporaryAccessMap.set(urlPattern, {
    grantedAt: now,
    expiresAt: expiresAt,
    duration: durationMinutes
  });

  // Schedule cleanup when access expires
  setTimeout(() => {
    if (temporaryAccessMap.has(urlPattern)) {
      const accessInfo = temporaryAccessMap.get(urlPattern);
      if (Date.now() >= accessInfo.expiresAt) {
        temporaryAccessMap.delete(urlPattern);
        updateBlockingRules(); // Re-enable blocking after timeout
      }
    }
  }, durationMinutes * 60 * 1000);

  // Update rules immediately to remove blocking for this site
  updateBlockingRules();
}


// Listen for messages from friction page
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "grantTemporaryAccess") {
    grantTemporaryAccess(request.urlPattern, request.duration, request.timeSpent || 0);
    sendResponse({ success: true });
  } else if (request.action === "getSettings") {
    getSettings().then(settings => {
      sendResponse({ settings });
    });
    return true; // Keep message channel open for async response
  } else if (request.action === "updateSettings") {
    saveSettings(request.settings).then(() => {
      updateBlockingRules(); // Reload blocking rules after settings update
      sendResponse({ success: true });
    });
    return true; // Keep message channel open for async response
  }
});

// Listen for navigation to update blocking rules if needed
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    // Update rules periodically to check for temporary access expiration
    setTimeout(updateBlockingRules, 1000);
  }
});

// Listen for storage changes to update rules
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.settings) {
    updateBlockingRules();
  }
});
