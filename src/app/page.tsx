import { redirect } from "next/navigation";

import { getCurrentUser, getPostAuthRedirect } from "@/lib/auth";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? await getPostAuthRedirect(user.id) : "/login");
}
