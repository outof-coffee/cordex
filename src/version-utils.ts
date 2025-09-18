/**
 * Gets the current Discord bot version
 * @returns The version string, hard-coded to "0.0.1" for now
 */
export const getBotVersion = (): string => {
  return '0.0.1';
};

/**
 * Determines if Discord slash command registration should be run based on version comparison and staleness
 * @param storedVersion - The stored Version entity, or null if none exists
 * @param currentVersion - The current bot version, defaults to getBotVersion()
 * @returns True if commands should be re-registered
 */
export const shouldRegisterCommands = (storedVersion: any | null, currentVersion?: string): boolean => {
  const botVersion = currentVersion || getBotVersion();
  
  // If no stored version, this is first run - register commands
  if (storedVersion === null) {
    return true;
  }
  
  // If version has changed, register commands
  if (storedVersion.version !== botVersion) {
    return true;
  }
  
  // TODO: shore this up later, not today - Version entity with isStale() method
  // If version is the same but stale (>5 days), register commands as fallback
  // if (storedVersion.isStale()) {
  //   return true;
  // }
  
  // Version is same and not stale, skip registration
  return false;
};
