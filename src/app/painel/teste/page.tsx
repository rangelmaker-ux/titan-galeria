import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { accountAccess, ACCESS_COLUMNS } from "@/lib/access";
import { StartTrial } from "./start-trial";
export default async function TrialPage(){
 const db=createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect("/entrar");
 await db.rpc("claim_titan_purchase");
 const {data}=await db.from("photographers").select(ACCESS_COLUMNS).eq("id",user.id).single();const access=accountAccess(data);
 if(access==="active"||access==="trial")redirect("/painel");if(access==="expired")redirect("/painel/assinatura");
 return <div className="mx-auto max-w-3xl py-6"><p className="text-xs uppercase tracking-[.2em] text-neutral-500">Bem-vindo à Titan Galeria</p><h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Três dias para experimentar tudo.</h1><p className="mt-4 leading-relaxed text-neutral-600">Seu teste gratuito inclui todas as ferramentas. As 72 horas começam quando você clicar em Testar. Sem cartão e sem cobrança automática.</p><div className="my-8 grid gap-4 sm:grid-cols-2">{[["Galerias e entregas","Organize álbuns, envie fotos e vídeos e compartilhe links com seus clientes."],["Sua apresentação","Personalize capas, fontes, layouts, perfil e marca-d’água."],["Seleção e venda","Receba favoritos e pedidos; venda arquivos e pacotes vinculados a cada álbum."],["Receba no seu Pix","O cliente paga diretamente a você. Confira o comprovante e libere os arquivos manualmente."],["Seu Google Drive","Conecte seu Drive para guardar os originais na sua própria conta."],["Acompanhe seu trabalho","Veja pedidos, pagamentos confirmados e arquivos escolhidos em um só lugar."]].map(([title,text])=><article key={title} className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm leading-relaxed text-neutral-500">{text}</p></article>)}</div><StartTrial/><p className="mt-5 text-sm text-neutral-500">Ao terminar o prazo, as ferramentas serão bloqueadas até a confirmação da assinatura. Seus dados não serão apagados. <Link href="/painel/assinatura" className="underline">Prefiro assinar agora</Link>.</p></div>;
}
