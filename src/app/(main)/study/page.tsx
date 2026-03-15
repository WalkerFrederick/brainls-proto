import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Study" };

export default function StudyListPage() {
  redirect("/home");
}
