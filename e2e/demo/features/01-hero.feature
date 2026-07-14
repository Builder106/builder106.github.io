Feature: 01 hero
  # Master tour — target ~88 s of Playwright recording.
  # Combined with the 6 s Blender intro this fills the full ~94 s narration.
  #
  # Beat map (Playwright-local time, DEMO_DWELL_MS=2500):
  #   0:00  Boot + scene establishes
  #   0:12  Room sweep: hover two racks so the cursor reads as "exploring"
  #   0:18  Click EconOS — demonstrates the project-card mechanic
  #   0:24  Click Helm — second rack, different wing of the room
  #   0:33  Close + idle countdown begins (15 s threshold)
  #   0:55  Idle wave sweeps through all servers (~7 s visible sweep)
  #   1:02  Click the control console — uptime / telemetry panel
  #   1:12  Brief hover tour: two more racks
  #   1:19  Ping — contact form reveal
  #   1:28  Close + hold the final wide shot until After hook tail fires

  Scenario: Master tour
    Given I am on the home page

    # ── Establish the room ─────────────────────────────────────────────────────
    When I hover the "EconOS" project rack
    When I hover the "ClearHash" project rack

    # ── Rack interaction demo ──────────────────────────────────────────────────
    When I click the "EconOS" project rack
    Then I see the project card for "EconOS"
    When I close the panel
    Then no panel is open
    When I click the "Helm" project rack
    Then I see the project card for "Helm"
    When I close the panel
    Then no panel is open

    # ── Idle wave ─────────────────────────────────────────────────────────────
    When I wait for the idle wave to fire

    # ── Control console ───────────────────────────────────────────────────────
    When I click the trading terminal
    Then I see the trading terminal
    When I close the panel
    Then no panel is open

    # ── Brief hover tour before contact ───────────────────────────────────────
    When I hover the "Quarry" project rack
    When I hover the "Enclave" project rack

    # ── Contact ping ──────────────────────────────────────────────────────────
    When I click the ping button
    Then I see the contact form
    When I close the panel
    Then no panel is open
