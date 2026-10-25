import { NextResponse } from "next/server";

const APK_DOWNLOAD_URL = "https://github.com/SystemTechnologiesCompany/stc-foundit/releases/download/v1.0/STC.FoundIt.apk";

export function GET() {
  return NextResponse.redirect(APK_DOWNLOAD_URL, 302);
}
