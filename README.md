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
  print físico em tamanho específico), vinculados a uma galeria. O cliente paga via Pix direto ao profissional, que confere e libera manualmente os arquivos do pedido.
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
— um único plano com acesso completo (sem níveis de recurso, já que cada
fotógrafo usa o próprio Google Drive), variando só a cadência de cobrança:
mensal (R$ 37), trimestral (R$ 97) ou anual (R$ 197).

1. No [Catálogo de produtos](https://dashboard.stripe.com/test/products) do
   Stripe, crie 1 produto "Titan Galeria" com **3 preços recorrentes** (BRL):
   mensal (R$ 37), a cada 3 meses (R$ 97) e anual (R$ 197).
2. Copie o **Price ID** de cada um (`price_...`, aparece ao abrir o produto)
   pro `.env.local`: `STRIPE_PRICE_MENSAL`, `STRIPE_PRICE_TRIMESTRAL`,
   `STRIPE_PRICE_ANUAL`. Os valores exibidos em `/precos` e no painel vêm de
   `src/lib/plans.ts` — ajuste lá se mudar o preço.
3. No mesmo endpoint de webhook do passo anterior (**Developers > Webhooks**),
   adicione também os eventos `customer.subscription.created`,
   `customer.subscription.updated` e `customer.subscription.deleted` (além
   de `checkout.session.completed`) — usam o mesmo `STRIPE_WEBHOOK_SECRET`.
4. Rode `supabase/migrations/0003_subscriptions.sql`, `0006_plano_gratuito_repasses.sql`,
   `0008_admin_planos_manuais.sql` e `0010_plano_unico.sql` no SQL Editor do
   Supabase (adiciona as colunas de plano/assinatura em `photographers` e os
   triggers que impõem os limites do plano gratuito no banco).

> Quem não assina continua no plano gratuito (5 fotos ou 1 vídeo de até
> 15MB por mês) — não é mais vendido como opção, só o ponto de partida de
> uma conta nova até ela assinar.

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

## Fluxo atual: Pix direto ao profissional

O Stripe continua responsável apenas pelas assinaturas SaaS. Os novos pedidos de fotos e impressões não criam Checkout, não passam pela conta Stripe da Titan e não geram repasses administrativos. Pedidos Stripe antigos continuam compatíveis com o webhook.

1. O profissional cadastra Pix e WhatsApp em **Meus ganhos**.
2. Em **Produtos**, vincula cada oferta a uma galeria: preço por arquivo escolhido, pacote dos arquivos já enviados ou impressão. Produtos anteriores sem vínculo ficam ocultos até a escolha da galeria.
3. O cliente informa nome completo igual ao comprovante, escolhe os arquivos e cria um pedido. O preço vem do banco; o pedido e a seleção são gravados atomicamente pela função `create_manual_order`, acessível somente ao servidor.
4. O cliente copia a chave Pix e envia o comprovante no WhatsApp do profissional. O link abre a conversa, sem enviar mensagem automaticamente.
5. O profissional confere o crédito no próprio banco e confirma em **Meus ganhos** ou na galeria. Somente os arquivos do pedido são liberados; compra de impressão não concede download digital. Um pacote congela a seleção na data do pedido, sem incluir uploads futuros.

Os pedidos diretos usam cookie HttpOnly específico do pedido e um token aleatório. Nome ou ID do pedido sozinhos não dão acesso. O cliente deve voltar ao mesmo navegador: não foi criado login de comprador ou sincronização entre dispositivos. Excluir produto o arquiva no catálogo, preservando os pedidos existentes.

Antes de publicar o código, aplicar `supabase/migrations/0007_pix_direto_produtos_galeria.sql` no projeto correto. A migração só adiciona campos/índices e função; preserva produtos, pedidos e repasses históricos. Não publicar este código antes da migração.

## Uploads e modelos de galeria

- Fotos: prévia JPEG reduzida (lado maior até 1600 px; até 3 MB) pelo endpoint autenticado `/api/upload/preview`. O original continua indo direto ao Drive. Avatar usa o mesmo fluxo com imagem de até 512 px e já salva o perfil.
- Vídeo: original direto ao Drive e prévia direta ao R2, sem passar arquivos grandes pelo limite de corpo da Vercel. A política CORS do bucket deve permitir o domínio real do site, PUT e Content-Type. Nunca configurar origem `*` por conveniência.
- XHR informa bytes enviados; a interface reserva etapas para preparação e registro, sem mostrar 100% antes da confirmação. O lote usa dois envios simultâneos, contagem e progresso individual/total. Não houve medição percentual de ganho de velocidade.
- Se a resposta do Drive se perder, o servidor consulta a mesma sessão, validada por token assinado vinculado ao usuário, galeria, tamanho e validade. A tentativa reaproveita prévia, original e sessão quando disponíveis; o registro reconhece o mesmo arquivo do Drive.
- Grade, Mosaico e Minimalista têm miniaturas e prévia com os arquivos da galeria. A escolha é confirmada antes de salvar. Sem fotos, a tela identifica o exemplo como ilustrativo.
- Álbuns usam pastas compactas e capa pela primeira foto enviada, sem depender da ordenação posterior.

## Validação

`node --test tests/*.test.cjs` verifica autorização de pedidos, seleção/valores, tokens, downloads, recuperação de upload, limites do endpoint, avatar e compatibilidade Stripe. Serviços externos são simulados nesses testes. Rodar também `npx tsc --noEmit` e `npm run build`.

Verificação real necessária antes da publicação: envio de arquivo → Drive/R2 → registro Supabase; pedido → Pix externo → conferência do profissional → liberação somente da seleção → download original. Conferir permissão negativa de outro fotógrafo e comprador. Os screenshots com dados fictícios não substituem esse teste.

## Administração de planos

`rangelmaker@gmail.com` tem Estúdio permanente por regra no banco. A concessão não depende de uma assinatura Stripe. Em `/painel/admin`, o administrador consulta contas e concede ou remove planos negociados fora da plataforma. A concessão permanece ativa até sua remoção; os registros ficam em `plan_grants_log`.

`billing_plan` guarda o plano de cobrança, `manual_plan` a concessão e `plan` o acesso efetivo. O trigger mantém a precedência administrador → concessão manual → cobrança. Eventos Stripe atualizam a cobrança sem retirar acessos manuais ou do administrador. Uma concessão não cancela cobranças Stripe existentes.

Aplicar também `supabase/migrations/0008_admin_planos_manuais.sql` antes do deploy. A migração protege colunas de plano contra alteração pelo navegador; edição normal de perfil, avatar, Pix e WhatsApp continua permitida. Funções privilegiadas ficam no schema privado, com wrappers executáveis somente pelo servidor. `tests/admin-plans.sql` verifica concessão/revogação, proteção do administrador, auditoria e permissões com rollback integral das fixtures.

O acesso foi redesenhado em `/entrar`: painel de fotos com transição CSS, imagens locais otimizadas pelo Next Image e respeito a redução de movimento. O teste visual de login/cadastro em 1280 × 720 confirmou altura da página igual à área visível, sem rolagem nessa resolução.


## Teste gratuito de três dias e compra por e-mail

O gratuito é um teste completo de 72 horas, iniciado uma única vez pelo botão **Testar por três dias** em `/painel/teste`. A data final é gravada no servidor. O painel exibe a expiração; após o prazo, o middleware bloqueia páginas e APIs das ferramentas e políticas RLS restritivas impedem acesso direto aos dados pela API do Supabase. Perfil básico para cobrança, assinatura, login e saída permanecem disponíveis. O navegador não pode alterar colunas de teste ou de liberação paga. Administrador permanente e concessão manual Titan não expiram com o teste.

Aplicar `0014_teste_tres_dias.sql` antes deste código. A migração remove a antiga cota de 5 fotos/1 vídeo: durante o teste todas as ferramentas estão disponíveis. Para contas existentes sem assinatura, o prazo começa no primeiro clique em Testar. Os dados não são apagados quando expira. Entregas já compradas pelos clientes continuam protegidas pelos tokens/pedidos existentes.

`/assinar` permite comprar antes de cadastrar, informando o e-mail que receberá o acesso. Se já estiver conectado, a compra usa o e-mail da própria conta no painel de assinatura. O webhook valida a assinatura Stripe, consulta o estado atual da assinatura/fatura e reconhece somente os Price IDs configurados para Titan. A liberação exige fatura paga, assinatura ativa e prazo pago ainda válido. `billing_entitlements` registra a compra mesmo sem conta; o cadastro/validação do mesmo e-mail reivindica esse acesso. Um ID de usuário isolado nos metadados nunca libera acesso: o e-mail do Stripe deve coincidir. Para compras autenticadas de contas antigas sem verificação por mensagem, o ID gravado pelo checkout do servidor também deve corresponder à conta. A associação já reivindicada permanece vinculada à conta original.

Eventos necessários no webhook `/api/webhooks/stripe`: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Preserve os eventos legados de pedidos Stripe. O endpoint de cobrança e seus eventos devem ser conferidos na mesma conta e no mesmo modo das chaves/Prices do deploy; não misturar conta de teste com produção.

Falhas de sincronização retornam HTTP 500 para permitir nova tentativa do Stripe. Eventos atrasados não restauram assinatura cancelada. `paid_until` limita o uso ao período pago confirmado e a renovação depende da confirmação seguinte. A confirmação de checkout no navegador não concede acesso.

Validação: `tests/trial-billing.test.cjs` e `tests/access-middleware.test.cjs` cobrem limite temporal, bloqueios e eventos de cobrança. `tests/trial-billing.sql` testa o início idempotente de 72 horas, bloqueio direto por RLS, proteção de colunas, fatura pendente versus paga, compra antes do cadastro, e-mail confirmado, cancelamento/evento atrasado e exceções manual/admin, com rollback integral. Não usar fixtures de pagamento como evidência de uma transação real no Stripe.

A compra antes do cadastro permanece protegida por `ENABLE_PREACCOUNT_PURCHASES=true`, a ser ativada somente após configurar SMTP, confirmação de e-mail e o webhook correto. Sem essa configuração, `/assinar` conduz ao cadastro/login e o endpoint não cria checkout anônimo. Em contas antigas com confirmação automática, uma compra autenticada só é atribuída à conta vinculada pelo checkout do servidor e com o mesmo e-mail do Stripe. Uma compra sem conta exige confirmação realmente enviada (`confirmation_sent_at`), não apenas `email_confirmed_at` preenchido automaticamente. Não desativar essa proteção para contornar a configuração de e-mail.


## E-mail de confirmação personalizado

Assunto e HTML ficam em `supabase/templates/confirm-signup-subject.txt` e `supabase/templates/confirm-signup.html`. O botão usa `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. A rota valida o token com Supabase, estabelece a sessão por cookies, reivindica eventual compra e envia a pessoa a `/painel`; o middleware abre a apresentação do teste ou o painel liberado, conforme a conta. Não aceita redirecionamentos externos e evita cache/referrer de tokens. Links inválidos/expirados levam a uma página de ajuda com reenvio.

Em produção, Site URL deve ser `https://titan-galeria.vercel.app` e a lista de redirecionamento inclui somente o retorno oficial `/auth/confirm`. Configure SMTP antes de ativar Confirm email e aplicar o template: o serviço padrão do Supabase não entrega mensagens a clientes fora da equipe. A aprovação do proprietário para exigir confirmação já foi dada; o provedor de envio ainda precisa ser definido. Não habilitar a compra antes do cadastro até finalizar o envio e o webhook.
