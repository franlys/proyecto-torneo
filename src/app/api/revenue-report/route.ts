// POST /api/revenue-report
// Recibe el webhook de ArenaCrypto cuando un torneo termina.
// Guarda el reporte de comisión en revenue_reports.
//
// Seguridad: valida x-ac-secret contra AC_WEBHOOK_SECRET en las env vars de Kronix.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  // Verify the request comes from ArenaCrypto
  const secret = req.headers.get("x-ac-secret");
  if (!secret || secret !== process.env.AC_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    pt_tournament_id,
    tournament_name,
    total_volume,
    kronix_volume,
    commission_rate,
    commission_amount,
    date,
  } = body;

  if (!pt_tournament_id || commission_amount === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabase.from("revenue_reports").insert({
    pt_tournament_id,
    tournament_name,
    total_volume:      Number(total_volume ?? 0),
    kronix_volume:     Number(kronix_volume ?? 0),
    commission_rate:   Number(commission_rate ?? 0.01),
    commission_amount: Number(commission_amount ?? 0),
    period_end:        date ?? new Date().toISOString(),
    source:            "arenacrypto",
  });

  if (error) {
    console.error("[revenue-report] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(
    `[revenue-report] Torneo ${pt_tournament_id} — comisión: $${commission_amount}`
  );

  return NextResponse.json({ ok: true, received: commission_amount });
}
