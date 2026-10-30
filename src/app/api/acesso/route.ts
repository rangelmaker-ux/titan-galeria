import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountAccess, ACCESS_COLUMNS } from "@/lib/access";
export const dynamic="force-dynamic";
export async function GET(){const db=createClient();const{data:{user}}=await db.auth.getUser();if(!user)return NextResponse.json({error:"Entre na sua conta."},{status:401});const{data,error}=await db.from("photographers").select(ACCESS_COLUMNS).eq("id",user.id).single();if(error)return NextResponse.json({error:"Não foi possível conferir o acesso."},{status:503});return NextResponse.json({state:accountAccess(data),expiresAt:data.trial_ends_at},{headers:{"Cache-Control":"no-store"}})}
