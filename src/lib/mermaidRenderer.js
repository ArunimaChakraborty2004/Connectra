/**
 * Dynamic Lazy Loader for Mermaid.js Architecture & Diagram Visualizer
 * Avoids multi-megabyte bundle overhead by loading from high-availability CDN on-demand.
 */

let mermaidPromise = null;

export async function getMermaid(isDark = false) {
  if (typeof window === 'undefined') return null;

  if (window.mermaid) {
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      });
    } catch {}
    return window.mermaid;
  }

  if (!mermaidPromise) {
    mermaidPromise = new Promise((resolve) => {
      if (document.getElementById('mermaid-cdn-script')) {
        const interval = setInterval(() => {
          if (window.mermaid) {
            clearInterval(interval);
            try {
              window.mermaid.initialize({
                startOnLoad: false,
                theme: isDark ? 'dark' : 'default',
                securityLevel: 'loose',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              });
            } catch {}
            resolve(window.mermaid);
          }
        }, 50);
        setTimeout(() => {
          clearInterval(interval);
          resolve(window.mermaid || null);
        }, 5000);
        return;
      }

      const script = document.createElement('script');
      script.id = 'mermaid-cdn-script';
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        if (window.mermaid) {
          try {
            window.mermaid.initialize({
              startOnLoad: false,
              theme: isDark ? 'dark' : 'default',
              securityLevel: 'loose',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            });
          } catch {}
          resolve(window.mermaid);
        } else {
          resolve(null);
        }
      };
      script.onerror = () => {
        console.warn('Failed to load Mermaid CDN script');
        resolve(null);
      };
      document.head.appendChild(script);
    });
  }

  return mermaidPromise;
}

/**
 * Downloads a raw SVG element as a standalone .svg file
 */
export function exportSvgToFile(svgElement, fileName = 'architecture-diagram.svg') {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = fileName;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}

/**
 * Converts an SVG element to high-res PNG (2x scale) and triggers download
 */
export function exportSvgToPng(svgElement, fileName = 'architecture-diagram.png') {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  img.onload = () => {
    const scale = 2; // High-DPI 2x scale
    const canvas = document.createElement('canvas');
    canvas.width = (img.width || 800) * scale;
    canvas.height = (img.height || 600) * scale;
    const ctx = canvas.getContext('2d');
    
    // Fill canvas background
    ctx.fillStyle = '#140e0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const pngUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(pngUrl);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  img.src = url;
}
