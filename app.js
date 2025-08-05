// Configuration for Cloudflare Worker
const WORKER_URL = 'https://your-worker.your-subdomain.workers.dev';

let downloadStats = JSON.parse(localStorage.getItem('downloadStats')) || {
    totalDownloads: 0,
    totalBytes: 0,
    successfulDownloads: 0
};

// Update stats display
function updateStatsDisplay() {
    const statsDisplay = document.getElementById('statsDisplay');
    const totalSize = formatBytes(downloadStats.totalBytes);
    
    statsDisplay.innerHTML = `
        <p><strong>Total Downloads:</strong> ${downloadStats.totalDownloads}</p>
        <p><strong>Successful Downloads:</strong> ${downloadStats.successfulDownloads}</p>
        <p><strong>Total Data:</strong> ${totalSize}</p>
        <p><strong>Success Rate:</strong> ${downloadStats.totalDownloads > 0 ? 
            Math.round((downloadStats.successfulDownloads / downloadStats.totalDownloads) * 100) : 0}%</p>
    `;
}

// Format bytes to human readable format
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Start download process
async function startDownload() {
    const fileUrl = document.getElementById('fileUrl').value;
    if (!fileUrl) {
        alert('Please enter a valid file URL');
        return;
    }

    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const downloadSpeed = document.getElementById('downloadSpeed');
    
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    downloadSpeed.textContent = 'Starting download...';

    try {
        downloadStats.totalDownloads++;
        
        const startTime = Date.now();
        let lastTime = startTime;
        let lastLoaded = 0;

        // Call Cloudflare Worker for file streaming
        const response = await fetch(WORKER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'download',
                url: fileUrl
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const contentLength = response.headers.get('Content-Length');
        const total = parseInt(contentLength, 10);
        let loaded = 0;

        const reader = response.body.getReader();
        const chunks = [];

        while (true) {
            const { done, value } = await reader.read();
            
            if (done) break;
            
            chunks.push(value);
            loaded += value.length;

            // Update progress
            if (total) {
                const progress = Math.round((loaded / total) * 100);
                progressBar.style.width = progress + '%';
                progressText.textContent = progress + '%';
                
                // Calculate download speed
                const currentTime = Date.now();
                const timeDiff = (currentTime - lastTime) / 1000;
                const bytesDiff = loaded - lastLoaded;
                
                if (timeDiff > 0.5) { // Update speed every 500ms
                    const speed = bytesDiff / timeDiff;
                    downloadSpeed.textContent = `Speed: ${formatBytes(speed)}/s`;
                    lastTime = currentTime;
                    lastLoaded = loaded;
                }
            }
        }

        // Combine chunks and create download link
        const blob = new Blob(chunks);
        const url = window.URL.createObjectURL(blob);
        const filename = getFilenameFromUrl(fileUrl);
        
        // Trigger download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        // Update statistics
        downloadStats.successfulDownloads++;
        downloadStats.totalBytes += loaded;
        localStorage.setItem('downloadStats', JSON.stringify(downloadStats));
        
        progressText.textContent = 'Download completed!';
        downloadSpeed.textContent = 'File saved successfully';
        
    } catch (error) {
        console.error('Download error:', error);
        progressText.textContent = 'Download failed';
        downloadSpeed.textContent = error.message;
    }
    
    updateStatsDisplay();
}

// Extract filename from URL
function getFilenameFromUrl(url) {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop();
        return filename || 'downloaded-file';
    } catch {
        return 'downloaded-file';
    }
}

// Initialize stats display on page load
document.addEventListener('DOMContentLoaded', updateStatsDisplay);
