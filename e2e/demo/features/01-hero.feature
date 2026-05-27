Feature: 01 hero
  # The site's master tour — ~45 s end-to-end. Beats the narration aligns to:
  #   · Land in the room, let the idle wave fire so the cluster colour-code
  #     reads (cyan vs magenta sweep) and the room feels alive.
  #   · Open a project rack → close.
  #   · Open the central control_console → close (the dashboard widgets land
  #     in the recording during the slow dwell on the panel).
  #   · Open the contact ping → close, ending back on the hero scene.
  # The recording captures the four primary interactions plus the room's
  # ambient behaviour in one continuous take.

  Scenario: Master tour
    Given I am on the home page
    When I wait for the idle wave to fire
    When I click the "EconOS" project rack
    Then I see the project card for "EconOS"
    When I close the panel
    Then no panel is open
    When I click the trading terminal
    Then I see the trading terminal
    When I close the panel
    Then no panel is open
    When I click the ping button
    Then I see the contact form
    When I close the panel
    Then no panel is open
