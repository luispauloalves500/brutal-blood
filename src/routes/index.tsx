import { createFileRoute } from "@tanstack/react-router";
import { BrutalBlood } from "@/components/game/BrutalBlood";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BrutalBlood />;
}
