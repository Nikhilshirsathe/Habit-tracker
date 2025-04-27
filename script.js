// Check screen orientation
function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
        document.body.innerHTML = `
            <div class="orientation-warning">
                <h2>Please rotate your device</h2>
                <p>This app is designed for landscape mode only</p>
                <div class="rotate-icon">🔄</div>
            </div>
        `;
    }
}

// Check orientation on load and resize
window.addEventListener('load', checkOrientation);
window.addEventListener('resize', checkOrientation); 