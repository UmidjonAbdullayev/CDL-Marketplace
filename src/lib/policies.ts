export const POLICY_VERSION = "v1.0";

export const PLATFORM_POLICY_RULES = [
  "Users may not bypass CDL Exchange after discovering a driver, seller, buyer, recruiter, agency, or carrier on the platform.",
  "Users may not exchange direct contact information before an official platform unlock, interest, purchase, or approved connection.",
  "Users may not use CDL Exchange to scrape, copy, resell, export, or duplicate listings outside the platform.",
  "Users may not upload fake, duplicate, outdated, stolen, or non-consented driver information.",
  "Sellers must confirm they have permission from the driver before listing or sharing driver information.",
  "Buyers must use driver information only for legitimate recruiting or hiring purposes.",
  "Users may not harass drivers, recruiters, carriers, or marketplace members.",
  "Users may not misrepresent company identity, MC authority, recruiting status, or driver availability.",
  "CDL Exchange may suspend or terminate accounts for policy violations.",
  "CDL Exchange may review listings, messages, unlocks, disputes, and activity logs for fraud prevention and marketplace safety."
] as const;

export type PolicyDocId = "marketplace" | "fair_use" | "anti_circumvention";

export const POLICY_DOCUMENTS: Record<
  PolicyDocId,
  { title: string; intro: string; sections: { heading: string; body: string }[] }
> = {
  marketplace: {
    title: "Marketplace User Policy",
    intro:
      "This policy governs how carriers, recruiting agencies, and solo recruiters use CDL Exchange to discover, evaluate, and engage driver candidates through the platform.",
    sections: [
      {
        heading: "Platform purpose",
        body:
          "CDL Exchange is a driver lead marketplace for legitimate recruiting and hiring coordination. Users participate as carriers, agencies, or independent recruiters — not as buyers or sellers of people."
      },
      {
        heading: "Account integrity",
        body:
          "You must register with accurate company or personal information. Misrepresenting MC authority, DOT credentials, agency status, or recruiting permissions is prohibited."
      },
      {
        heading: "Information use",
        body:
          "Driver information accessed through CDL Exchange may only be used for recruiting and hiring workflows initiated on the platform. Unauthorized export, resale, or off-platform solicitation is prohibited."
      },
      {
        heading: "Enforcement",
        body:
          "CDL Exchange may review listings, messages, unlocks, disputes, and activity logs. Accounts violating this policy may be suspended or terminated without refund where permitted by law."
      }
    ]
  },
  fair_use: {
    title: "Fair Use Policy",
    intro:
      "Fair use ensures CDL Exchange remains trustworthy for drivers, carriers, and recruiting partners.",
    sections: [
      {
        heading: "Respectful conduct",
        body:
          "Users may not harass drivers, recruiters, carriers, or marketplace members. Professional communication is required in all platform interactions."
      },
      {
        heading: "Listing quality",
        body:
          "Users may not upload fake, duplicate, outdated, stolen, or non-consented driver information. Sellers must confirm driver permission before listing."
      },
      {
        heading: "Platform limits",
        body:
          "Automated scraping, bulk copying, or systematic extraction of marketplace data is prohibited. Plan limits on hires, interests, and CRM features must be respected."
      },
      {
        heading: "Monitoring",
        body:
          "CDL Exchange monitors usage patterns to prevent abuse, fraud, and circumvention. Unusual activity may trigger review or temporary restrictions."
      }
    ]
  },
  anti_circumvention: {
    title: "Anti-Circumvention Rules",
    intro:
      "These rules protect marketplace integrity and ensure recruiting fees support platform safety, escrow, and verification services.",
    sections: [
      {
        heading: "No off-platform bypass",
        body:
          "Users may not bypass CDL Exchange after discovering a driver, seller, buyer, recruiter, agency, or carrier on the platform to avoid fees, contracts, or safety controls."
      },
      {
        heading: "Contact unlock rules",
        body:
          "Users may not exchange direct contact information before an official platform unlock, expressed interest, approved hiring process, or other authorized connection event."
      },
      {
        heading: "Data restrictions",
        body:
          "Users may not scrape, copy, resell, export, or duplicate listings outside the platform. Bulk exports require eligible plans and remain subject to audit."
      },
      {
        heading: "Remedies",
        body:
          "Violations may result in account suspension, termination, forfeiture of platform access, and referral to compliance review. Repeat offenders may be permanently banned."
      }
    ]
  }
};
