import { NextResponse } from "next/server";
export async function POST() { return NextResponse.json({error:"O repasse pela plataforma foi encerrado. Os novos pagamentos são feitos diretamente ao profissional."},{status:410}); }
