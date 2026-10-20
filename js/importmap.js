const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify({
    "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js"
    }
});
document.head.appendChild(script);
