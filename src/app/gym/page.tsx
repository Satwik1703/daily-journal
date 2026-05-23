import { redirect } from "next/navigation";
import { todayLocal } from "@/lib/dates";

export default function GymRoot() {
  redirect(`/gym/${todayLocal()}`);
}
