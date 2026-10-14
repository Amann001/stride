import { redirect } from "next/navigation";

import { ANDROID_APP } from "@/lib/android-app";

// A link that never changes (stride-amanswamy.vercel.app/download/android) and always gives
// the newest APK, so links already shared with friends keep working after an update.
export function GET() {
  redirect(ANDROID_APP.url);
}
