import { NextResponse } from "next/server";
import { fetchClasses, getConnectedRealm } from "@/lib/qbo";

export async function GET() {
  const realmId = await getConnectedRealm();
  if (!realmId) {
    return NextResponse.json(
      { error: "QuickBooks not connected" },
      { status: 401 }
    );
  }

  try {
    const classes = await fetchClasses(realmId);
    return NextResponse.json({
      classes: classes.map((c) => ({
        id: c.Id,
        name: c.Name,
        fullyQualifiedName: c.FullyQualifiedName,
        active: c.Active,
      })),
    });
  } catch (err) {
    console.error("QBO classes error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch classes" },
      { status: 500 }
    );
  }
}
