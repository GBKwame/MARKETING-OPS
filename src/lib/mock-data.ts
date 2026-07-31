export const WORKSPACE = "Carezza Growth Team";

export const CHANNELS = [
  "Facebook",
  "Instagram",
  "TikTok",
  "WhatsApp",
  "LinkedIn",
  "Google Ads",
  "Field Visit",
  "Radio",
  "Flyer Drop",
];

export const APPROACHES_BY_CHANNEL: Record<string, string[]> = {
  Facebook: ["Organic Post", "Group Post", "Paid Ad", "Reel", "Story"],
  Instagram: ["Organic Post", "Reel", "Story", "Paid Ad"],
  TikTok: ["Organic Video", "Paid Ad", "Live"],
  WhatsApp: ["Broadcast", "Group Post", "Status", "1:1 Message"],
  LinkedIn: ["Organic Post", "Article", "Paid Ad", "InMail"],
  "Google Ads": ["Search Ad", "Display Ad", "YouTube Ad"],
  "Field Visit": ["Church Visit", "School Visit", "Community Meeting", "Door-to-door"],
  Radio: ["Interview", "Jingle", "Sponsorship"],
  "Flyer Drop": ["Neighborhood", "Event", "Marketplace"],
};

export const BRANCHES = ["Accra HQ", "Kumasi", "Takoradi", "Tamale"];
export const CAMPAIGNS = [
  "Caregiver Recruitment Q3",
  "Home Care Awareness",
  "Grace Chapel Outreach",
  "Ramadan Wellness",
  "Back-to-School Nannies",
];