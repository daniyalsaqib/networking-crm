import dynamic from "next/dynamic";

const NetworkMapClient = dynamic(
  () => import("../components/NetworkMapClient"),
  { ssr: false }
);

export default function Page() {
  return <NetworkMapClient />;
}
