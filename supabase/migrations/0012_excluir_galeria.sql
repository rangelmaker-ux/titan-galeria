-- Exclusão de galeria: em vez de apagar a linha de verdade (o que, pelas
-- constraints da migration 0001, apagaria em cascata os PEDIDOS/PAGAMENTOS
-- daquela galeria também), marcamos como arquivada. A galeria some da lista
-- do fotógrafo e do link público, mas o histórico financeiro continua no
-- banco pra consulta/comprovante depois. A pasta no Drive e as prévias no
-- R2 são excluídas de verdade (isso é só armazenamento, não registro
-- financeiro) — ver DELETE em /api/galerias/[id].
begin;

alter table public.galleries add column if not exists deleted_at timestamptz;

commit;
