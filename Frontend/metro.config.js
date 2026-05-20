const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);
const clerkSharedResolutionCache = new Map();

// Fix for @clerk/expo nested @clerk/shared subpath exports not resolving
// Metro can't handle the glob pattern in exports map: "./*" -> "./dist/runtime/*.js"
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @clerk/shared subpath imports that use the glob exports pattern
  if (moduleName.startsWith('@clerk/shared/')) {
    if (clerkSharedResolutionCache.has(moduleName)) {
      const cached = clerkSharedResolutionCache.get(moduleName);
      if (cached) {
        return cached;
      }
    } else {
      const subpath = moduleName.replace('@clerk/shared/', '');
      // Try to find it in the @clerk/expo's nested @clerk/shared first
      const clerkSharedInExpo = path.resolve(
        __dirname,
        'node_modules/@clerk/expo/node_modules/@clerk/shared/dist/runtime',
        subpath + '.js'
      );
      if (fs.existsSync(clerkSharedInExpo)) {
        const resolved = { filePath: clerkSharedInExpo, type: 'sourceFile' };
        clerkSharedResolutionCache.set(moduleName, resolved);
        return resolved;
      }
      // Fallback to top-level @clerk/shared
      const clerkSharedTop = path.resolve(
        __dirname,
        'node_modules/@clerk/shared/dist/runtime',
        subpath + '.js'
      );
      if (fs.existsSync(clerkSharedTop)) {
        const resolved = { filePath: clerkSharedTop, type: 'sourceFile' };
        clerkSharedResolutionCache.set(moduleName, resolved);
        return resolved;
      }

      clerkSharedResolutionCache.set(moduleName, null);
    }
  }

  // Use default resolver for everything else
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
