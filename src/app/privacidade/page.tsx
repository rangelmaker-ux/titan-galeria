export const metadata = { title: "Política de Privacidade — Titan Galeria" };

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <span className="text-sm uppercase tracking-widest text-neutral-500">Titan Galeria</span>
      <h1 className="mt-2 text-3xl font-semibold">Política de Privacidade</h1>
      <p className="mt-2 text-sm text-neutral-500">Última atualização: 29 de outubro de 2026</p>

      <div className="prose prose-neutral mt-10 max-w-none space-y-8 text-sm leading-relaxed text-neutral-700">
        <section>
          <p>
            A Titan Galeria é uma plataforma usada por fotógrafos e videomakers para entregar
            galerias de fotos e vídeos aos próprios clientes, vender downloads e impressões, e
            manter um portfólio público. Esta página explica quais dados coletamos, como usamos
            e com quem compartilhamos — tanto dos fotógrafos que usam a plataforma quanto dos
            clientes finais deles que acessam uma galeria.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">1. Quais dados coletamos</h2>
          <p className="mt-2 font-medium text-ink">Do fotógrafo (quem assina a plataforma):</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Nome, e-mail e senha (autenticação, via Supabase Auth)</li>
            <li>Nome de exibição, foto de perfil, bio, Instagram, WhatsApp e chave Pix, se informados</li>
            <li>As fotos e vídeos que ele envia para suas galerias</li>
            <li>Dados de cobrança da assinatura da plataforma, processados pelo Stripe (não guardamos número de cartão)</li>
            <li>Se ele conectar o próprio Google Drive: um token de acesso que nos permite criar e gravar arquivos na pasta "Titan Galeria" dentro da conta dele</li>
          </ul>
          <p className="mt-3 font-medium text-ink">Do cliente final (quem acessa uma galeria):</p>
          <ul className="mt-1 list-disc pl-5">
            <li>Nome completo informado ao acessar uma galeria com venda (usado para conferir o pagamento via Pix)</li>
            <li>E-mail, quando informado no checkout</li>
            <li>Quais fotos ele favoritou ou selecionou para compra</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">2. Como usamos o Google Drive</h2>
          <p className="mt-2">
            Fotógrafos podem, opcionalmente, conectar a própria conta do Google Drive à Titan
            Galeria. Usamos exclusivamente o escopo <code>drive.file</code> do Google, que nos dá
            acesso apenas aos arquivos e pastas que a própria Titan Galeria cria dentro da conta —
            nunca aos demais arquivos do Drive do fotógrafo. Concretamente, isso significa:
          </p>
          <ul className="mt-2 list-disc pl-5">
            <li>Criamos uma pasta "Titan Galeria" na raiz do Drive conectado</li>
            <li>Organizamos subpastas dentro dela conforme as tags que o fotógrafo escolhe (ex: "Casamento", "Aniversário")</li>
            <li>Enviamos ali os arquivos originais (alta resolução) das fotos e vídeos que o fotógrafo sobe nas galerias dele</li>
            <li>Lemos esses mesmos arquivos de volta só quando necessário: para gerar a prévia da galeria ou para liberar o download depois que um cliente paga por aquele arquivo</li>
          </ul>
          <p className="mt-2">
            Não acessamos, listamos ou modificamos qualquer outro arquivo do Google Drive do
            fotógrafo. O fotógrafo pode desconectar essa permissão a qualquer momento nas
            configurações da conta ou diretamente em
            {" "}
            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline">
              myaccount.google.com/permissions
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">3. Onde os dados ficam armazenados</h2>
          <ul className="mt-2 list-disc pl-5">
            <li><strong>Supabase</strong> — banco de dados (contas, galerias, pedidos, produtos)</li>
            <li><strong>Cloudflare R2</strong> — prévias das fotos/vídeos exibidas publicamente na galeria, com marca d'água</li>
            <li><strong>Google Drive do fotógrafo</strong> (quando conectado) ou uma conta Google administrada pela Titan Galeria (quando não conectado) — arquivos originais em alta resolução, nunca expostos publicamente</li>
            <li><strong>Stripe</strong> — dados de pagamento da assinatura da plataforma</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">4. Com quem compartilhamos</h2>
          <p className="mt-2">
            Não vendemos nem compartilhamos dados pessoais com terceiros para fins de publicidade.
            Os dados passam apenas pelos provedores necessários para o funcionamento do serviço
            (Supabase, Cloudflare, Stripe, Google) e, quando aplicável, pelo próprio fotógrafo
            dono da galeria — já que ele precisa ver quem comprou, favoritou ou solicitou arquivos
            na galeria dele.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">5. Seus direitos</h2>
          <p className="mt-2">
            Você pode pedir a correção ou exclusão dos seus dados, ou perguntar o que temos
            armazenado sobre você, entrando em contato pelo e-mail abaixo. Fotógrafos podem
            editar ou apagar seus próprios dados diretamente nas configurações da conta.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">6. Contato</h2>
          <p className="mt-2">
            Dúvidas sobre esta política ou sobre seus dados:{" "}
            <a href="mailto:rangelmaker@gmail.com" className="underline">rangelmaker@gmail.com</a>
          </p>
        </section>
      </div>
    </main>
  );
}
