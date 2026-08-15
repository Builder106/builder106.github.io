export function isAutomatedEnvironment(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.webdriver ||
    /HeadlessChrome|Lighthouse|PageSpeed|Chrome-Lighthouse/i.test(navigator.userAgent)
  );
}
