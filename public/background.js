/* global chrome */

console.log("background working");

// Open the side panel when the extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Configure the side panel to open on extension icon click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// This function will be injected into the page to collect data.
function loadWebPageInfo() {
    console.log("Process url: " + window.location.href);

    const webInfo = {
        webUrl: window.location.href,
        title: document.title,
        forms: [],
        inputs: [],
        buttons: [],
        scripts: [],
        metaTags: [],
        cookies: document.cookie,
        jsElements: [],
        comments: [],
        headers: {},       // Will be populated by webRequest listener
        errorPages: [],    // placeholder (not used currently)
        ftpDirectories: [], // New field for FTP scanning results
        mixedContent: []   // New field to store mixed content info
    };

    // Extract forms
    document.querySelectorAll('form').forEach((form) => {
        webInfo.forms.push({
            action: form.getAttribute('action') || 'N/A',
            method: form.getAttribute('method') || 'GET',
            fields: Array.from(form.querySelectorAll('input, textarea')).map((field) => ({
                name: field.getAttribute('name') || 'N/A',
                type: field.getAttribute('type') || 'N/A',
                value: field.getAttribute('value') || 'N/A',
            })),
        });
    });

    // Extract inputs
    document.querySelectorAll('input').forEach((input) => {
        webInfo.inputs.push({
            name: input.getAttribute('name') || 'N/A',
            type: input.getAttribute('type') || 'N/A',
            value: input.getAttribute('value') || 'N/A',
        });
    });

    // Extract buttons
    document.querySelectorAll('button').forEach((button) => {
        webInfo.buttons.push({
            text: button.innerText || 'N/A',
            type: button.getAttribute('type') || 'N/A',
        });
    });

    // Extract scripts
    document.querySelectorAll('script').forEach((script) => {
        const content = script.innerText.trim();
        // Capture up to 500 characters (instead of 200) for better context
        webInfo.scripts.push({
            src: script.getAttribute('src') || 'inline',
            content: content.slice(0, 500) || 'N/A',
        });

        // Parse inline scripts for JavaScript patterns
        const jsPatterns = [];
        if (/eval\(/.test(content)) jsPatterns.push("eval() detected");
        if (/localStorage\.getItem\(/.test(content)) jsPatterns.push("localStorage usage detected");
        if (/role|permission/.test(content)) jsPatterns.push("Role/Permission check detected");

        if (jsPatterns.length > 0) {
            webInfo.jsElements.push({
                snippet: content.slice(0, 500),
                patterns: jsPatterns,
            });
        }
    });

    // Extract meta tags
    document.querySelectorAll('meta').forEach((meta) => {
        webInfo.metaTags.push({
            name: meta.getAttribute('name') || 'N/A',
            content: meta.getAttribute('content') || 'N/A',
        });
    });

    // Extract HTML comments
    document.body.innerHTML.replace(/<!--(.*?)-->/gs, (match, content) => {
        webInfo.comments.push(content.trim());
    });

    // Basic error page detection
    if (document.title.toLowerCase().includes('error') || 
        document.title.toLowerCase().includes('not found') ||
        document.body.innerHTML.includes('404') ||
        document.body.innerHTML.includes('500') ||
        document.body.innerHTML.includes('403')) {
        
        webInfo.isErrorPage = true;
        webInfo.errorDetails = {
            title: document.title,
            bodySnippet: document.body.innerText.slice(0, 500)
        };
    }

    // Detect mixed content
    if (window.location.protocol === 'https:') {
        // Find all resources loaded by the page
        const mixedContentItems = [];
        
        // Check images
        document.querySelectorAll('img').forEach((img) => {
            const src = img.getAttribute('src');
            if (src && src.startsWith('http:')) {
                mixedContentItems.push({
                    type: 'image',
                    url: src,
                    element: `<img src="${src}">`
                });
            }
        });
        
        // Check scripts
        document.querySelectorAll('script').forEach((script) => {
            const src = script.getAttribute('src');
            if (src && src.startsWith('http:')) {
                mixedContentItems.push({
                    type: 'script',
                    url: src,
                    element: `<script src="${src}"></script>`
                });
            }
        });
        
        // Check stylesheets
        document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('http:')) {
                mixedContentItems.push({
                    type: 'stylesheet',
                    url: href,
                    element: `<link rel="stylesheet" href="${href}">`
                });
            }
        });
        
        // Check iframes
        document.querySelectorAll('iframe').forEach((iframe) => {
            const src = iframe.getAttribute('src');
            if (src && src.startsWith('http:')) {
                mixedContentItems.push({
                    type: 'iframe',
                    url: src,
                    element: `<iframe src="${src}"></iframe>`
                });
            }
        });
        
        // Check other resources (audio, video, etc.)
        document.querySelectorAll('audio source, video source, embed, object').forEach((element) => {
            const src = element.getAttribute('src') || element.getAttribute('data');
            if (src && src.startsWith('http:')) {
                mixedContentItems.push({
                    type: element.tagName.toLowerCase(),
                    url: src,
                    element: element.outerHTML
                });
            }
        });
        
        // Check for inline styles with http URLs
        document.querySelectorAll('[style]').forEach((element) => {
            const style = element.getAttribute('style');
            if (style && style.includes('http:')) {
                mixedContentItems.push({
                    type: 'inline-style',
                    url: 'inline',
                    element: `<${element.tagName.toLowerCase()} style="${style}">`
                });
            }
        });
        
        // Check background images in CSS
        try {
            // This is a more advanced check for CSS backgrounds, but might not catch everything
            Array.from(document.styleSheets).forEach(styleSheet => {
                try {
                    if (styleSheet.href && styleSheet.href.startsWith('http:')) {
                        mixedContentItems.push({
                            type: 'external-stylesheet',
                            url: styleSheet.href,
                            element: `<link rel="stylesheet" href="${styleSheet.href}">`
                        });
                    }
                    
                    if (!styleSheet.cssRules) return; // Cannot read cssRules due to CORS
                    
                    Array.from(styleSheet.cssRules).forEach(rule => {
                        if (rule.cssText && rule.cssText.includes('http:')) {
                            mixedContentItems.push({
                                type: 'css-rule',
                                url: 'embedded',
                                element: rule.cssText
                            });
                        }
                    });
                } catch (e) {
                    // Ignore CORS errors when accessing cssRules
                }
            });
        } catch (e) {
            console.error("Error checking stylesheets for mixed content:", e);
        }
        
        // Add unique mixed content items to the webInfo object
        const uniqueUrls = new Set();
        mixedContentItems.forEach(item => {
            if (!uniqueUrls.has(item.url)) {
                uniqueUrls.add(item.url);
                webInfo.mixedContent.push(item);
            }
        });
    }

    return webInfo;
}

// Function to check a single path in page context
function checkSinglePath(path, baseUrl) {
  return new Promise(async (resolve) => {
    try {
      // Construct the full URL
      const url = new URL(path, baseUrl).href;
      console.log(`Checking path: ${url}`);
      
      // Create a controller to set a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        // Use standard fetch with minimal options to avoid CORS issues
        const response = await fetch(url, { 
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
          mode: 'no-cors' // This helps with CORS issues but we might not get full response info
        });
        
        clearTimeout(timeoutId);
        
        // If we get here, the URL is accessible
        // Try to get content if we can
        let contentSnippet = '';
        let hasDirectoryListing = false;
        let hasSensitiveContent = false;
        
        try {
          // Getting the text may fail in no-cors mode
          const html = await response.text();
          contentSnippet = html.slice(0, 200);
          
          // Check for directory listing indicators
          hasDirectoryListing = 
            html.includes('Index of') || 
            html.includes('Directory Listing') ||
            html.match(/<pre>.*<\/pre>/s) ||
            html.includes('<title>Index of') ||
            html.includes('Parent Directory') ||
            (html.includes('ftp') && html.includes('file')) ||
            (html.match(/href=["'][^"']+\.bak["']/i)); // .bak files are often sensitive
          
          // Check for sensitive content indicators with a more robust approach
          const sensitivePatterns = [
            'password', 'username', 'user', 'admin', 'root', 'config', 
            'secret', 'private', 'key', 'token', 'auth', 'credential',
            'api', 'access', 'secure', 'db', 'database', 'backup', 'bak',
            'confidential', 'restricted', 'internal', 'classified', 'sensitive',
            'acquisition', '.env', '.git', '.svn', '.bak', '.old', '.tmp',
            'package.json', 'config.json', 'wp-config', '.htaccess', 'web.config'
          ];
          
          hasSensitiveContent = sensitivePatterns.some(pattern => 
            html.toLowerCase().includes(pattern.toLowerCase())
          );
        } catch (textError) {
          console.log(`Could not get text content for ${url}:`, textError);
        }
        
        // In no-cors mode we might not get response.ok, so treat the response as a success
        resolve({
          path: path,
          accessible: true,
          directoryListingEnabled: hasDirectoryListing,
          responseCode: response.status || 200, // Default to 200 if status is not available
          contentSnippet: contentSnippet,
          hasSensitiveContent: hasSensitiveContent,
          contentType: response.headers && response.headers.get('content-type') || 'unknown'
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        
        // If it's not an abort error, the resource might exist but is protected
        if (fetchError.name === 'AbortError') {
          console.log(`Timeout checking path ${path}`);
          resolve(null);
        } else {
          // For security tools, even errors can be valuable information
          // 403 Forbidden means the resource exists but access is denied
          // 404 Not Found means the resource doesn't exist
          const status = fetchError.status || (fetchError.message.includes('404') ? 404 : 
                                               fetchError.message.includes('403') ? 403 : 0);
          
          if (status === 403) {
            // A 403 response is interesting - the resource exists but is protected
            resolve({
              path: path,
              accessible: false,
              directoryListingEnabled: false,
              responseCode: 403,
              contentSnippet: 'Access Forbidden',
              hasSensitiveContent: true, // Protected resources are often sensitive
              contentType: 'unknown'
            });
          } else {
            resolve(null);
          }
        }
      }
    } catch (error) {
      console.log(`Error checking path ${path}:`, error.message);
      resolve(null);
    }
  });
}

// This function will be injected and run in the page context
function scanFtpPathsInPageContext(paths, baseUrl) {
  console.log(`Running security path scan in page context for ${baseUrl}`);
  
  // First check if the current page is already a directory listing
  function checkCurrentPage() {
    const html = document.documentElement.outerHTML.toLowerCase();
    const url = window.location.href.toLowerCase();
    
    // Check if this page has indicators of being a directory listing
    const isDirListing = 
      url.includes('/ftp') || 
      url.includes('/files') || 
      url.includes('/upload') ||
      html.includes('index of') ||
      html.includes('directory listing') ||
      html.includes('parent directory') ||
      (document.querySelectorAll('pre').length > 0 && 
       document.querySelectorAll('a[href]').length > 5) ||
      document.title.toLowerCase().includes('file server');
      
    // Check for sensitive content
    const hasSensitiveContent = 
      html.includes('password') ||
      html.includes('config') ||
      html.includes('backup') ||
      html.includes('admin') ||
      html.includes('private') ||
      html.includes('.bak') ||
      html.includes('.env') ||
      html.includes('.git');
    
    // If this page is a directory listing, report it
    if (isDirListing || hasSensitiveContent) {
      // Get list of files being linked to
      const files = [];
      document.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          files.push({
            name: link.textContent.trim(),
            path: href
          });
        }
      });
      
      return [{
        path: window.location.pathname,
        accessible: true,
        directoryListingEnabled: isDirListing,
        responseCode: 200,
        contentSnippet: document.title || "Directory listing found",
        hasSensitiveContent: hasSensitiveContent || files.some(f => 
          f.name.endsWith('.bak') || 
          f.name.includes('config') || 
          f.name.includes('.env')),
        files: files,
        contentType: 'text/html'
      }];
    }
    
    return [];
  }
  
  // First try the current page check (most reliable)
  const currentPageResults = checkCurrentPage();
  if (currentPageResults.length > 0) {
    console.log("Current page appears to be a directory listing");
    return currentPageResults;
  }
  
  // If that doesn't work, fall back to fetch-based checking
  console.log(`Testing ${paths.length} paths...`);
  
  // Function to create batches of promises to avoid overwhelming the browser
  function createBatches(array, batchSize) {
    let batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
  
  // Process paths in manageable batches
  return new Promise(async (resolve) => {
    // Use existing path checking logic...
    const results = [];
    const batches = createBatches(paths, 10); // Process 10 paths at a time
    
    for (const batch of batches) {
      const batchPromises = batch.map(path => checkSinglePath(path, baseUrl));
      const batchResults = await Promise.all(batchPromises);
      
      // Add non-null results to our collection
      results.push(...batchResults.filter(result => result !== null));
      
      // Small delay between batches to prevent overwhelming the browser
      await new Promise(r => setTimeout(r, 100));
    }
    
    console.log(`Scan complete, found ${results.length} accessible resources`);
    resolve(results);
  });
}

// Function to check common FTP directories (to be executed after the initial page scan)
async function checkFtpDirectories(origin) {
  console.log("Checking security-sensitive directories for:", origin);
  
  // Comprehensive path list ordered by likelihood of discovery
  // This list combines common sensitive resources across different platforms
  const directoryPaths = [
    // Common exposed/sensitive directories
    '/ftp',
    '/admin',
    '/uploads',
    '/files',
    '/backup',
    '/config',
    '/api',
    
    // Common sensitive files
    '/robots.txt',
    '/.env',
    '/package.json',
    '/package.json.bak',
    '/config.json',
    
    // Web API endpoints that might leak info
    '/api/users',
    '/api/products',
    '/api/orders',
    '/api/v1/auth',
    
    // SPA routes that might be sensitive
    '/#/admin',
    '/#/dashboard',
    '/#/score-board',
    '/#/ftp',
    
    // Additional general directories and files
    '/upload',
    '/backups',
    '/documents',
    '/data',
    '/logs',
    '/assets/uploads',
    '/images/uploads',
    '/tmp',
    '/temp',
    '/private',
    '/secret',
    '/hidden',
    '/secure',
    '/protected',
    
    // Configuration and system files
    '/.htaccess',
    '/.htpasswd',
    '/.git/config',
    '/.git/HEAD',
    '/.svn/entries',
    '/config.php',
    '/config.js',
    '/web.config',
    '/wp-config.php',
    
    // Database files and backups
    '/database.sql',
    '/db.sqlite',
    '/backup.sql',
    '/dump.sql',
    
    // Log files and debug information
    '/error_log',
    '/error.log',
    '/debug.log',
    '/access.log',
    '/server-status',
    '/server-info',
    '/phpinfo.php',
    '/info.php',
    
    // API documentation
    '/swagger',
    '/api-docs',
    '/api/swagger',
    '/graphql',
    
    // Admin panels
    '/admin/login',
    '/admin/dashboard',
    '/management',
    '/administrator',
    '/phpmyadmin',
    '/cpanel',
    '/wp-admin',
    
    // Installation and setup files
    '/install',
    '/setup',
    '/readme.txt',
    '/README.md',
    '/CHANGELOG.txt',
    '/CONTRIBUTING.md'
  ];
  
  try {
    // Get current active tab
    const tabs = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found to execute directory scanning");
      return [];
    }
    
    // Execute the scan in the context of the current page
    const scanResults = await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: scanFtpPathsInPageContext,
      args: [directoryPaths, origin]
    });
    
    console.log("Security scan completed, results:", scanResults);
    
    if (scanResults && scanResults[0] && scanResults[0].result) {
      return scanResults[0].result;
    }
    return [];
  } catch (error) {
    console.error("Error in security directory scanning:", error);
    return [];
  }
}

// Helper function to identify security headers
function isSecurityHeader(headerName) {
    const securityHeaders = [
        'strict-transport-security',
        'content-security-policy',
        'x-content-type-options',
        'x-frame-options',
        'x-xss-protection',
        'referrer-policy',
        'feature-policy',
        'permissions-policy',
        'access-control-allow-origin',
        'access-control-allow-methods',
        'access-control-allow-headers',
        'access-control-allow-credentials',
        'cross-origin-embedder-policy',
        'cross-origin-opener-policy',
        'cross-origin-resource-policy'
    ];
    
    return securityHeaders.includes(headerName.toLowerCase());
}

// Track the current URL to detect page changes
let currentUrl = "";

// Listen for webRequest headers
chrome.webRequest.onHeadersReceived.addListener(
    function(details) {
        console.log("Headers received from:", details.url);
        
        // Process headers if this is for the main frame (the webpage itself)
        if (details.type === "main_frame") {
            // Update current URL when a main frame request is made
            currentUrl = details.url;
            
            const securityHeaders = {};
            
            // Extract all headers so we don't miss anything
            if (details.responseHeaders) {
                details.responseHeaders.forEach(header => {
                    securityHeaders[header.name.toLowerCase()] = header.value;
                });
            }
            
            console.log("Headers collected for URL:", currentUrl, securityHeaders);
            
            // Clear any previous security headers and store the current ones
            chrome.storage.local.set({ 
                currentUrl: currentUrl,
                securityHeaders: securityHeaders 
            });
            
            // Also update webPageInfo if it exists
            chrome.storage.local.get("webPageInfo", function(data) {
                if (data.webPageInfo) {
                    // Make sure we're updating headers for the current page
                    if (currentUrl.includes(new URL(data.webPageInfo.webUrl).hostname)) {
                        const updatedInfo = {...data.webPageInfo, headers: securityHeaders};
                        chrome.storage.local.set({ webPageInfo: updatedInfo });
                        console.log("Updated webPageInfo with headers for:", currentUrl);
                    } else {
                        console.log("URL mismatch, not updating webPageInfo headers");
                    }
                }
            });
        }
    },
    { urls: ["<all_urls>"] },
    ["responseHeaders"]
);

// Fallback fetch approach in case webRequest doesn't work
function tryFetchHeadersForTab(tab) {
    if (tab.url && !tab.url.startsWith("chrome://")) {
        try {
            console.log("Trying fetch fallback for: " + tab.url);
            fetch(tab.url, { method: 'HEAD' })
                .then(response => {
                    const headers = {};
                    response.headers.forEach((value, name) => {
                        headers[name.toLowerCase()] = value;
                    });
                    
                    console.log("Headers from fetch fallback:", headers);
                    
                    // Store the current URL with the headers
                    chrome.storage.local.set({ 
                        currentUrl: tab.url,
                        securityHeaders: headers 
                    });
                    
                    // Update webPageInfo if it exists and matches current URL
                    chrome.storage.local.get("webPageInfo", function(data) {
                        if (data.webPageInfo && 
                            tab.url.includes(new URL(data.webPageInfo.webUrl).hostname) &&
                            Object.keys(data.webPageInfo.headers || {}).length === 0) {
                            
                            const updatedInfo = {...data.webPageInfo, headers: headers};
                            chrome.storage.local.set({ webPageInfo: updatedInfo });
                            console.log("Updated webPageInfo with fetch headers:", updatedInfo);
                        }
                    });
                })
                .catch(error => {
                    console.error("Fetch fallback error:", error);
                });
        } catch (e) {
            console.error("Error in fetch fallback:", e);
        }
    }
}

// Event listener for tab updates
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    console.log("Tab update event listener triggered");

    if (changeInfo.status === "complete" && tab.active) {
        if (!tab.url?.startsWith("chrome://")) {
            console.log("Injecting loadWebPageInfo script...");
            
            // Always clear previous webPageInfo data when loading a new page
            chrome.storage.local.set({ webPageInfo: null });
            
            chrome.scripting.executeScript({
                target: { tabId },
                func: loadWebPageInfo,
            })
            .then(async (queryResult) => {
                const result = queryResult[0]?.result || {};
                console.log("Retrieved webPageInfo:", result);
                
                // Get current URL and headers if available
                chrome.storage.local.get(["currentUrl", "securityHeaders"], function(data) {
                    // Only use stored headers if they match the current URL
                    if (data.currentUrl && data.securityHeaders && 
                        data.currentUrl.includes(new URL(result.webUrl).hostname)) {
                        result.headers = data.securityHeaders;
                        console.log("Added matching securityHeaders to webPageInfo:", result);
                    } else {
                        // Clear headers if they don't match current URL
                        result.headers = {};
                        console.log("No matching headers found. Using empty headers object.");
                    }
                    
                    // Save the updated webPageInfo
                    chrome.storage.local.set({ webPageInfo: result });
                    
                    // Try fetch fallback if headers are empty
                    if (Object.keys(result.headers || {}).length === 0) {
                        tryFetchHeadersForTab(tab);
                    }
                });
                
                // After collecting initial data, perform directory scanning
                try {
                    if (tab.url) {
                        const origin = new URL(tab.url).origin;
                        console.log("Running security directory checks for origin:", origin);
                        
                        // Execute the FTP check
                        const ftpResults = await checkFtpDirectories(origin);
                        console.log("Security directory results:", ftpResults);
                        
                        // Update the stored data with FTP results
                        chrome.storage.local.get("webPageInfo", function(data) {
                            if (data.webPageInfo) {
                                const updatedInfo = {
                                    ...data.webPageInfo, 
                                    ftpDirectories: ftpResults
                                };
                                chrome.storage.local.set({ webPageInfo: updatedInfo });
                                console.log("Updated webPageInfo with directory scan results:", ftpResults);
                            }
                        });
                    }
                } catch (error) {
                    console.error("Error in directory scanning:", error);
                }
            })
            .catch((err) => console.error("Injection error:", err));

            chrome.sidePanel.setOptions({
                tabId,
                path: 'index.html',
                enabled: true,
            });
        }
    }
});

// Listen for messages from popup/content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "getHeaders") {
        chrome.storage.local.get(["webPageInfo", "currentUrl", "securityHeaders"], function(data) {
            // Only return headers if they match the current URL
            if (data.webPageInfo && data.currentUrl && 
                data.currentUrl.includes(new URL(data.webPageInfo.webUrl).hostname)) {
                sendResponse({
                    headers: data.webPageInfo?.headers || {},
                    url: data.webPageInfo?.webUrl || "Unknown"
                });
            } else if (data.currentUrl && data.securityHeaders) {
                sendResponse({
                    headers: data.securityHeaders,
                    url: data.currentUrl
                });
            } else {
                sendResponse({
                    headers: {},
                    url: "Unknown"
                });
            }
        });
        return true; // Required for async sendResponse
    }
    
    // Add a new message handler for getting the full web page info including FTP results
    if (request.action === "getWebPageInfo") {
        chrome.storage.local.get("webPageInfo", function(data) {
            sendResponse(data.webPageInfo || {});
        });
        return true; // Required for async sendResponse
    }
    
    // New action to force refresh headers
    if (request.action === "refreshHeaders") {
        if (request.url) {
            try {
                fetch(request.url, { method: 'HEAD' })
                    .then(response => {
                        const headers = {};
                        response.headers.forEach((value, name) => {
                            headers[name.toLowerCase()] = value;
                        });
                        
                        // Update stored headers
                        chrome.storage.local.set({ 
                            currentUrl: request.url,
                            securityHeaders: headers 
                        });
                        
                        // Update webPageInfo
                        chrome.storage.local.get("webPageInfo", function(data) {
                            if (data.webPageInfo) {
                                const updatedInfo = {...data.webPageInfo, headers: headers};
                                chrome.storage.local.set({ webPageInfo: updatedInfo });
                                console.log("Force updated headers:", headers);
                            }
                        });
                        
                        sendResponse({ success: true, headers: headers });
                    })
                    .catch(error => {
                        console.error("Refresh headers error:", error);
                        sendResponse({ success: false, error: error.message });
                    });
            } catch (e) {
                console.error("Error in refresh headers:", e);
                sendResponse({ success: false, error: e.message });
            }
            return true;
        }
        sendResponse({ success: false, error: "No URL provided" });
        return true;
    }
    
    // Action to manually trigger security directory scan
    if (request.action === "scanDirectories") {
        if (request.url) {
            try {
                const origin = new URL(request.url).origin;
                checkFtpDirectories(origin)
                    .then(results => {
                        console.log("Manual directory scan results:", results);
                        
                        // Update webPageInfo with scan results
                        chrome.storage.local.get("webPageInfo", function(data) {
                            if (data.webPageInfo) {
                                const updatedInfo = {
                                    ...data.webPageInfo, 
                                    ftpDirectories: results
                                };
                                chrome.storage.local.set({ webPageInfo: updatedInfo });
                            }
                        });
                        
                        sendResponse({ success: true, results: results });
                    })
                    .catch(error => {
                        console.error("Manual directory scan error:", error);
                        sendResponse({ success: false, error: error.message });
                    });
                return true;
            } catch (e) {
                console.error("Error in manual directory scan:", e);
                sendResponse({ success: false, error: e.message });
            }
        }
        sendResponse({ success: false, error: "No URL provided" });
        return true;
    }
});