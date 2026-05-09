export interface ExperienceEntry {
  role: string;
  org: string;
  period: string;
  bullets: string[];
}

export const experience: ExperienceEntry[] = [
  {
    role: "Web Development Lead",
    org: "STAIJA",
    period: "Mar 2025 — Aug 2025",
    bullets: [
      "Spearheaded construction of the STAIJA website",
      "Halved intern ramp time (12 → 6 weeks) by launching an onboarding program and pair-programming culture",
    ],
  },
  {
    role: "Research Assistant",
    org: "Wesleyan College of Letters / Traveler's Lab",
    period: "Feb 2024 — May 2024",
    bullets: [
      "Co-developed Constantinopolitana: Database of East Rome (CDER), a spatial encyclopedia focused on the Carolingian Empire",
      "Analyzed three Carolingian chronicles using nodegoat and QGIS for visualization and mapping",
    ],
  },
  {
    role: "Project Manager Coordinator",
    org: "Wesleyan University",
    period: "Oct 2023 — Dec 2023",
    bullets: [
      "Used Adobe Workfront to plan, track, and report on 100 projects, improving completion rate by 15%",
      "Audited 50 prior projects and cleaned up the database, cutting load times by 25%",
    ],
  },
  {
    role: "HNG 9.0 Intern",
    org: "HNG Internship",
    period: "Oct 2022 — Nov 2022",
    bullets: [
      "Conducted three code reviews per week, contributing to a 20% improvement in overall code quality",
      "Partnered with intern teams to build and test scalable React.js web applications",
    ],
  },
];
