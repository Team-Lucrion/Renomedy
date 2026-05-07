const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix for @clerk/expo nested @clerk/shared subpath exports not resolving
// Metro can't handle the glob pattern in exports map: "./*" -> "./dist/runtime/*.js"
const originalResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Handle @clerk/shared subpath imports that use the glob exports pattern
  if (moduleName.startsWith('@clerk/shared/')) {
    const subpath = moduleName.replace('@clerk/shared/', '');
    // Try to find it in the @clerk/expo's nested @clerk/shared first
    const clerkSharedInExpo = path.resolve(
      __dirname,
      'node_modules/@clerk/expo/node_modules/@clerk/shared/dist/runtime',
      subpath + '.js'
    );
    const fs = require('fs');
    if (fs.existsSync(clerkSharedInExpo)) {
      return { filePath: clerkSharedInExpo, type: 'sourceFile' };
    }
    // Fallback to top-level @clerk/shared
    const clerkSharedTop = path.resolve(
      __dirname,
      'node_modules/@clerk/shared/dist/runtime',
      subpath + '.js'
    );
    if (fs.existsSync(clerkSharedTop)) {
      return { filePath: clerkSharedTop, type: 'sourceFile' };
    }
  }

  // Use default resolver for everything else
  if (originalResolver) {
    return originalResolver(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
