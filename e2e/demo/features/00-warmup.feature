Feature: 00 warmup
  # Playwright's single-worker + slowMo + video:"on" combination has a quirk:
  # one of the first 1-2 test slots records a 0-byte video. Position varies.
  # Add throwaway warmup scenarios; the reporter detects them by slug prefix
  # (00-warmup-...) and discards their webm + per-test folder so the real
  # demos aren't affected.

  Scenario: Warmup A
    Given I am on the home page

  Scenario: Warmup B
    Given I am on the home page
