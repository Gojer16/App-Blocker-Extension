// Options Page Script
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const newBlockedSiteInput = document.getElementById('new-blocked-site');
    const addSiteBtn = document.getElementById('add-site-btn');
    const blockedSitesList = document.getElementById('blocked-sites-list');
    
    const maxDailyUnlocksInput = document.getElementById('max-daily-unlocks');
    const mathDurationInput = document.getElementById('math-duration');
    const memoryDurationInput = document.getElementById('memory-duration');
    const typingDurationInput = document.getElementById('typing-duration');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    
    // Load settings on page load
    loadSettings();
    
    // Add blocked site button event
    addSiteBtn.addEventListener('click', addBlockedSite);
    
    // Also allow adding with Enter key
    newBlockedSiteInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addBlockedSite();
        }
    });
    
    
    
    // Save settings button
    saveSettingsBtn.addEventListener('click', saveSettings);
});

function loadSettings() {
    chrome.runtime.sendMessage({
        action: "getSettings"
    }, function(response) {
        if (response && response.settings) {
            const settings = response.settings;
            
            // Populate challenge duration
            if (settings.challengeTypes) {
                // We have fixed 24-hour duration for typing challenge now
            }
            
            // Load blocked sites
            loadBlockedSites(settings.blocklist || []);
        }
    });
}

function addBlockedSite() {
    const input = document.getElementById('new-blocked-site');
    const domain = input.value.trim();
    
    if (!domain) {
        showMessage('Please enter a valid domain', 'error');
        return;
    }
    
    // Basic domain validation
    if (!isValidDomain(domain)) {
        showMessage('Please enter a valid domain (e.g., example.com)', 'error');
        return;
    }
    
    // Get current settings
    chrome.runtime.sendMessage({
        action: "getSettings"
    }, function(response) {
        if (response && response.settings) {
            const settings = response.settings;
            
            // Check if already in blocklist
            if (settings.blocklist.some(site => site.urlPattern === domain)) {
                showMessage('Site already in blocklist', 'error');
                return;
            }
            
            // Add to blocklist
            const newEntry = {
                id: Date.now().toString(), // Simple ID generation
                urlPattern: domain,
                createdAt: Date.now(),
                temporaryAccessOptions: [
                    {duration: 1440, challengeType: 'typing'}
                ]
            };
            
            settings.blocklist.push(newEntry);
            
            // Save updated settings
            chrome.runtime.sendMessage({
                action: "updateSettings",
                settings: settings
            }, function(response) {
                if (response && response.success) {

                    // Clear input
                    document.getElementById('new-blocked-site').value = '';

                    // Reload the blocked sites list
                    loadBlockedSites(settings.blocklist);

                    showMessage('Site added to blocklist!', 'success');
                } else {
                    showMessage('Error adding site', 'error');
                }
            });
        } else {
            showMessage('Error getting settings', 'error');
        }
    });
}


function loadBlockedSites(blocklist = []) {
    const listElement = document.getElementById('blocked-sites-list');
    
    // Clear current list
    listElement.innerHTML = '';
    
    if (blocklist.length === 0) {
        const noSitesItem = document.createElement('li');
        noSitesItem.className = 'message';
        noSitesItem.textContent = 'No sites blocked yet';
        listElement.appendChild(noSitesItem);
        return;
    }
    
    // Add each site to the list
    blocklist.forEach(entry => {
        const li = document.createElement('li');
        li.className = 'blocked-site-item';
        
        li.innerHTML = `
            <span class="site-domain" title="${entry.urlPattern}">${entry.urlPattern}</span>
            <button class="btn btn-danger delete-btn" data-id="${entry.id}">Remove</button>
        `;
        
        listElement.appendChild(li);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn[data-id]').forEach(button => {
        button.addEventListener('click', function() {
            const id = this.getAttribute('data-id');
            removeBlockedSite(id);
        });
    });
}


function removeBlockedSite(id) {
    chrome.runtime.sendMessage({
        action: "getSettings"
    }, function(response) {
        if (response && response.settings) {
            const settings = response.settings;
            
            // Filter out the site with the specified ID
            settings.blocklist = settings.blocklist.filter(entry => entry.id !== id);
            
            // Update settings
            chrome.runtime.sendMessage({
                action: "updateSettings",
                settings: settings
            }, function(updateResponse) {
                if (updateResponse && updateResponse.success) {
                    // Reload the blocked sites list
                    loadBlockedSites(settings.blocklist);
                    showMessage('Site removed from blocklist', 'success');
                } else {
                    showMessage('Error removing site', 'error');
                }
            });
        } else {
            showMessage('Error getting settings', 'error');
        }
    });
}


function saveSettings() {
    // Get current settings
    chrome.runtime.sendMessage({
        action: "getSettings"
    }, function(response) {
        if (response && response.settings) {
            const settings = response.settings;
            
            // Update challenge types
            settings.challengeTypes = {
                'typing': {
                    difficulty: 3,
                    duration: 1440  // Fixed 24-hour duration for the typing challenge
                }
            };
            
            // Save updated settings
            chrome.runtime.sendMessage({
                action: "updateSettings",
                settings: settings
            }, function(saveResponse) {
                if (saveResponse && saveResponse.success) {
                    showMessage('Settings saved successfully!', 'success');
                } else {
                    showMessage('Error saving settings', 'error');
                }
            });
        } else {
            showMessage('Error getting settings', 'error');
        }
    });
}

function isValidDomain(domain) {
    // Simple domain validation regex
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](\.[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9])*.?$/;
    return domainRegex.test(domain);
}

function showMessage(text, type = 'info') {
    // Remove any existing message
    const existingMessage = document.querySelector('.message:not(.blocked-site-item):not(.whitelisted-site-item)');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = text;
    
    document.querySelector('.container').appendChild(messageDiv);
    
    // Remove message after 3 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}