# Titan Galeria

MVP de SaaS pra fotógrafos/videomakers, inspirado no [SmugMug](https://www.smugmug.com/)
(mesmo objetivo — entregar, aprovar e vender fotos/vídeos — layout e marca
próprios, em português). Feito com Next.js + Supabase + Cloudflare R2 + Stripe.

## O que já funciona (MVP completo)

- **Conta do fotógrafo** — cadastro/login (Supabase Auth), perfil público
  (`/p/<slug>`) com bio, Instagram e WhatsApp.
- **Galerias** — criar galeria, enviar fotos e vídeos direto pro navegador
  (upload assinado pro R2, sem passar pelo servidor), excluir mídia.
- **Entrega/aprovação do cliente** — link único por galeria (`/g/<token>`),
  senha opcional, cliente favorita fotos (sem precisar criar conta, só
  informa o nome).
- **Loja** — três tipos de produto (download de 1 foto, download de todas,
  print físico em tamanho específico), checkout via Stripe, liberação do
  link de download assinado depois do pagamento confirmado (webhook).
- **Portfólio público** — lista as galerias marcadas como "publicadas".
- **Assinatura SaaS** — o fotógrafo assina um de três planos (Essencial,
  Profissional, Estúdio) pra usar a plataforma, via Stripe Billing
  (`/precos`, `/painel/assinatura`), separado do checkout avulso do cliente
  final.

## Limitações conhecidas desta v1 (próximos passos)

- **Marca d'água em vídeo**: as prévias de FOTO ganham marca d'água
  desenhada no navegador (canvas), mas vídeo é servido sem reprocessamento
  (mesma qualidade do original) — fazer isso direito exige um pipeline de
  transcodificação (ffmpeg num worker/Lambda), fora do escopo deste MVP.
- **Print físico é só registro manual**: o pedido de print fica marcado
  como pago e visível no painel, mas não existe integração automática com
  gráfica/laboratório de revelação — o fotógrafo precisa providenciar a
  impressão e marcar como enviado manualmente.
- **Carrinho de um item por vez**: cada compra é uma sessão separada do
  Stripe Checkout (sem carrinho com múltiplos produtos numa única compra).
- **Sem apps mobile** (o SmugMug tem; aqui é só web, responsivo).
- **Sessão da galeria por senha** usa um cookie simples (não é um JWT
  assinado) — suficiente pra v1, mas vale endurecer antes de um uso com
  muito volume.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind · Supabase (Postgres +
Auth) · Cloudflare R2 (armazenamento, compatível com S3) · Stripe
(pagamentos) · Vercel (deploy sugerido).

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurando o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode o conteúdo de `supabase/migrations/0001_init.sql`.
3. Em **Project Settings > API**, copie `URL`, `anon public key` e
   `service_role key` pro seu `.env.local`.
4. Em **Authentication > Providers**, deixe "Email" habilitado (padrão).
   Se quiser pular a confirmação por e-mail durante o desenvolvimento,
   desative "Confirm email" em **Authentication > Settings**.

### 3. Configurando o R2

O Titan Galeria usa **dois buckets** — um privado (originais, nunca
público) e um público (prévias com marca d'água):

1. No painel da Cloudflare, vá em **R2** e crie dois buckets, ex.:
   `titan-galeria-privado` e `titan-galeria-publico`.
2. No bucket público, habilite o acesso público (Settings > Public
   Access > Allow Access, ou conecte um domínio customizado). Copie a URL
   base pública (ex.: `https://pub-xxxx.r2.dev` ou seu domínio) pra
   `R2_PUBLIC_BASE_URL`, e o hostname (sem `https://`) pra
   `R2_PUBLIC_HOSTNAME` (usado no `next.config.mjs` pra liberar o
   `next/image`).
3. Em **R2 > Manage API Tokens**, crie um token com permissão de leitura e
   escrita nos dois buckets. Copie `Account ID`, `Access Key ID` e
   `Secret Access Key` pro `.env.local`.
4. Preencha `R2_BUCKET_PRIVATE` e `R2_BUCKET_PUBLIC` com os nomes exatos
   dos buckets criados.

### 4. Configurando o Stripe

1. Crie uma conta em [stripe.com](https://stripe.com) (pode começar em modo
   de teste).
2. Em **Developers > API keys**, copie a **Secret key** pra
   `STRIPE_SECRET_KEY`.
3. Em **Developers > Webhooks**, crie um endpoint apontando pra
   `https://SEU-DOMINIO/api/webhooks/stripe`, escutando o evento
   `checkout.session.completed`. Copie o **Signing secret** pra
   `STRIPE_WEBHOOK_SECRET`.
   - Em desenvolvimento local, use `stripe listen --forward-to
     localhost:3000/api/webhooks/stripe` (Stripe CLI) pra testar sem
     precisar expor sua máquina.

### 5. Configurando o Stripe (assinaturas)

Além do checkout avulso (cliente final comprando fotos/prints, seção acima),
a Titan Galeria cobra uma **mensalidade do fotógrafo** pra usar a ferramenta
— três planos (Essencial, Profissional, Estúdio), sem comissão por venda.

1. No [Catálogo de produtos](https://dashboard.stripe.com/test/products) do
   Stripe, crie 3 produtos **recorrentes** (mensal, BRL): "Essencial",
   "Profissional" e "Estúdio", com os valores que você quer cobrar.
2. Copie o **Price ID** de cada um (`price_...`, aparece ao abrir o produto)
   pro `.env.local`: `STRIPE_PRICE_ESSENCIAL`, `STRIPE_PRICE_PROFISSIONAL`,
   `STRIPE_PRICE_ESTUDIO`. Os valores exibidos em `/precos` e no painel vêm
   de `src/lib/plans.ts` — ajuste lá se mudar o preço.
3. No mesmo endpoint de webhook do passo anterior (**Developers > Webhooks**),
   adicione também os eventos `customer.subscription.created`,
   `customer.subscription.updated` e `customer.subscription.deleted` (além
   de `checkout.session.completed`) — usam o mesmo `STRIPE_WEBHOOK_SECRET`.
4. Rode `supabase/migrations/0003_subscriptions.sql` no SQL Editor do
   Supabase (adiciona as colunas de plano/assinatura em `photographers` e os
   triggers que impõem os limites de cada plano no banco).

> **Limitações conhecidas desta v1**: os limites de **armazenamento**
> (10GB/100GB/ilimitado) e de **usuários/equipe** (até 5 logins no Estúdio)
> do quadro de planos ainda não são reforçados automaticamente — só o
> limite de galerias e de tipo de produto do plano Essencial.

### 6. Configurando o Google Drive

Os arquivos ORIGINAIS em alta resolução ficam no Google Drive (pasta própria
por galeria), não no R2 — só os previews com marca d'água continuam no R2,
pra manter o custo de armazenamento baixo. Isso usa uma única conta de Drive
(a do dono da plataforma), não uma conta por fotógrafo.

1. Crie (ou use) um projeto em [console.cloud.google.com](https://console.cloud.google.com).
2. Em **APIs e serviços > Biblioteca**, habilite a **Google Drive API**.
3. Em **APIs e serviços > Tela de permissão OAuth** (Google Auth Platform),
   configure como app **Externo**, preencha nome/e-mail de suporte, e
   adicione sua própria conta do Google em **Usuários de teste** (o app fica
   em modo "Testando", o que é suficiente pra uso próprio).
4. Em **Clientes**, crie um **ID do cliente OAuth** do tipo **Aplicativo da
   Web**, com `https://developers.google.com/oauthplayground` como URI de
   redirecionamento autorizado. Copie `Client ID` e `Client secret` pro
   `.env.local` (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
5. Gere o refresh token no [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/):
   - No ícone de engrenagem (canto superior direito), marque **Use your own
     OAuth credentials** e cole o Client ID/secret do passo anterior.
   - Em "Input your own scopes", cole `https://www.googleapis.com/auth/drive`
     e clique **Authorize APIs**, fazendo login com a conta de Drive que vai
     guardar os arquivos.
   - Clique **Exchange authorization code for tokens** e copie o
     `refresh_token` pro `.env.local` (`GOOGLE_REFRESH_TOKEN`).
6. No seu Google Drive, crie uma pasta raiz (ex.: "Titan Galeria"), abra ela
   e copie o ID que aparece na URL
   (`drive.google.com/drive/folders/SEU_ID_AQUI`) pro `.env.local`
   (`GOOGLE_DRIVE_ROOT_FOLDER_ID`). Dentro dela, uma subpasta é criada
   automaticamente pra cada galeria no primeiro upload.

> Mídia enviada antes dessa migração (que ainda só tem `r2_key_original`, sem
> `drive_file_id`) continua funcionando normalmente — o download cai num
> fallback que busca do R2.

### 7. Rodando localmente

```bash
cp .env.example .env.local
# preencha .env.local com os valores acima
npm run dev
```

### 8. Deploy

O jeito mais simples é [Vercel](https://vercel.com): conecte o repositório,
configure as mesmas variáveis de ambiente do `.env.local` no painel do
projeto, e defina `NEXT_PUBLIC_SITE_URL` como a URL final de produção.

## Estrutura

```
src/
  app/
    page.tsx                    # landing page
    entrar/                     # login/cadastro do fotógrafo
    painel/                     # área logada do fotógrafo
      galerias/[id]/            # gerenciar uma galeria (upload, config, pedidos)
      produtos/                 # catálogo de produtos (downloads/prints)
      configuracoes/            # perfil público
    g/[token]/                  # galeria de entrega (link compartilhável)
    p/[slug]/                   # portfólio público do fotógrafo
    api/                        # rotas de servidor (upload, checkout, webhooks…)
  components/
    public/                     # componentes da galeria pública (cliente final)
  lib/
    supabase/                   # clientes Supabase (browser/server/service role)
    r2.ts                       # upload/download assinado no Cloudflare R2
    stripe.ts                   # cliente Stripe
supabase/migrations/0001_init.sql  # schema completo do banco
```

## Checkout com Pix e gerenciamento de assinatura

O checkout de produtos usa os métodos dinâmicos do Stripe. Em uma conta elegível, habilite Pix em https://dashboard.stripe.com/settings/payment_methods e mantenha os produtos em BRL. A remoção da restrição a cartão prepara a integração; não habilita o método na conta nem garante que ele apareça para qualquer transação. Consulte https://docs.stripe.com/payments/pix e https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods.

No endpoint de webhook existente, habilite também os eventos `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` e `checkout.session.expired`, além dos eventos de checkout e assinatura já configurados. Pedidos só são pagos quando `payment_status` é `paid`. Falha de persistência retorna HTTP 500 para permitir reenvio. Repetições não regravam a data do pagamento nem alteram pedidos já atendidos. Uma confirmação paga que chegue após um cancelamento ainda confirma o pedido.

A galeria consulta a confirmação a cada três segundos por até três minutos ao retornar do checkout, independentemente do modo ao vivo. A liberação continua sendo feita pelo webhook, com validação do pagamento nas rotas de download.

Para assinantes ativos, em teste, em atraso ou com cobrança pendente, o botão de troca abre o Billing Portal em vez de criar outra assinatura. Configure o portal do Stripe para permitir alterações entre os preços existentes. O plano atual e os valores devem ser conferidos no portal antes da confirmação. Os preços atuais foram preservados.

Validação local de cobrança, com banco e Stripe simulados: `node --test tests/payments.test.cjs`. Isso não substitui uma compra de teste no Stripe com confirmação no Supabase e download real. Verificar antes de publicar: Pix exibido no checkout em BRL; QR Code/copia e cola; pedido pendente sem download; confirmação assinada do webhook; um único pedido pago em Meus ganhos; download original; falha/expiração sem liberação; troca da assinatura existente no portal; repasse manual inalterado.
