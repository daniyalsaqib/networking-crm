import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;
  return session.user; // { id, name, email }
}
