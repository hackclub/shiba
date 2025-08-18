import { MovingBackground } from "@/components/HomeScreen";
import { useRouter } from "next/router";

export default function Page() {
  const router = useRouter();
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        backgroundColor: "#dab5ff",
      }}
    >
      <MovingBackground />
      <p> User : {router.query.slug}</p>
    </main>
  );
}
