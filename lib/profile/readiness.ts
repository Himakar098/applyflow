import type { Profile } from "@/lib/types";

export function computeReadiness(profile: Profile) {
  const scope = profile.preferredLocationScope ?? "";
  const hasScopedLocation =
    scope === "world"
      ? true
      : scope === "country"
        ? Boolean(profile.preferredLocationCountry)
        : scope === "state"
          ? Boolean(profile.preferredLocationState || profile.preferredLocationCountry)
          : scope === "city"
            ? Boolean(
                profile.preferredLocationCity ||
                  profile.preferredLocationState ||
                  profile.preferredLocationCountry,
              )
            : false;
  const hasLocationPrefs = profile.preferredLocations.length > 0 || hasScopedLocation;

  const checks = {
    contact: Boolean(profile.fullName) && Boolean(profile.email || profile.phone),
    roles: profile.targetRoles.length > 0,
    locations: hasLocationPrefs,
    projects: profile.projects.length >= 2,
    experience: profile.workExperience.length >= 1,
    skills:
      [profile.skills.languages, profile.skills.tools, profile.skills.cloud, profile.skills.databases].filter(
        (arr) => arr && arr.length > 0,
      ).length >= 2,
  };

  const total = Object.keys(checks).length;
  const passed = Object.values(checks).filter(Boolean).length;
  const missing: string[] = [];

  if (!checks.contact) missing.push("Add name + email or phone");
  if (!checks.roles) missing.push("Add target roles");
  if (!checks.locations) missing.push("Add preferred location scope");
  if (!checks.projects) missing.push("Add at least 2 projects");
  if (!checks.experience) missing.push("Add at least 1 work experience");
  if (!checks.skills) missing.push("Add skills in two categories");

  return { score: Math.round((passed / total) * 100), missing };
}
