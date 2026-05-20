Feature: 01 hero
  # The headline demo. ~30 seconds: boot → land in the room → click a project
  # rack → close → open the central trading terminal → close → tap PING.
  # Covers the four primary interactions in one narrative.

  Scenario: Recruiter explores the room
    Given I am on the home page
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
