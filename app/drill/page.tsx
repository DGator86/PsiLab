import { isDrillType } from "@/lib/drill";
import DrillClient from "./DrillClient";

export const dynamic = "force-dynamic";

export default async function DrillPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const drillType = type && isDrillType(type) ? type : "zener4";
  return <DrillClient key={drillType} drillType={drillType} />;
}
