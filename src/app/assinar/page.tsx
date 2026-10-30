import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PurchaseForm from "./purchase-form";
export default async function PurchasePage(){ const db=createClient();const{data:{user}}=await db.auth.getUser();if(user)redirect("/painel/assinatura");if(process.env.ENABLE_PREACCOUNT_PURCHASES!=="true")redirect("/entrar");return <PurchaseForm/>; }
