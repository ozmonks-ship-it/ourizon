import { profileFromSession } from "./collaborationApi";

export function timeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function firstNameFromUser(user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string {
  const profile = profileFromSession({
    id: "",
    email: user.email,
    user_metadata: user.user_metadata,
  });
  const displayName = profile.display_name?.trim();
  if (displayName) {
    return displayName.split(/\s+/)[0];
  }

  const emailLocal = user.email?.split("@")[0]?.trim();
  if (emailLocal) {
    return emailLocal.charAt(0).toUpperCase() + emailLocal.slice(1);
  }

  return "there";
}
