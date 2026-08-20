import { redirect } from "next/navigation";

export default function ProfilePage() {
  redirect("/insights?section=portrait");
}
