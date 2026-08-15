let isSoftwareCache: boolean | null = null;

export function isSoftwareWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  if (isSoftwareCache !== null) return isSoftwareCache;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      (canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (canvas.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) {
      isSoftwareCache = false;
      return false;
    }
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) {
      const renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
      const vendor = String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || '');
      if (
        /SwiftShader|llvmpipe|Software|Mesa/i.test(renderer) ||
        (/Google/i.test(vendor) && /SwiftShader|Renderer/i.test(renderer))
      ) {
        isSoftwareCache = true;
        return true;
      }
    }
  } catch {
    isSoftwareCache = false;
    return false;
  }
  isSoftwareCache = false;
  return false;
}

export function isAutomatedEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  // 1. Explicit automated flags / user agents
  if (
    navigator.webdriver ||
    /HeadlessChrome|Lighthouse|PageSpeed|Chrome-Lighthouse|Google-PageSpeed/i.test(
      navigator.userAgent
    )
  ) {
    return true;
  }

  // 2. Headless browser / CI software WebGL rasterizer check (SwiftShader / llvmpipe)
  if (isSoftwareWebGL()) {
    return true;
  }

  return false;
}
