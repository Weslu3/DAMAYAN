import { redirect } from "next/navigation";

export default function SiteManagerLoginRedirect() {
  // Perform server-side redirect directly to the consolidated login page
  redirect("/login");
}
