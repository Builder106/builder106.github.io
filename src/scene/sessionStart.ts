// Captures the wall-clock millisecond at which the JS bundle first
// executes. The TradingTerminal's SESSION_UPTIME widget (landscape
// variant of the telemetry pill) reads this to display how long the
// visitor has been on the site.
//
// Module-level evaluation runs exactly once per page load, so any
// number of consumers can import this and they all see the same
// timestamp. Imported eagerly from App.tsx so the value is pinned at
// app start, not at the time the lazy panel chunk first loads.

export const SESSION_START_MS: number = Date.now();
