/** Monta o payload Pix "copia e cola" (BR Code / EMV) a partir da chave do
 * fotógrafo, pro cliente pagar escaneando o QR Code ou colando no app do
 * banco. Sem dependência externa — é só montagem de campos TLV (tipo +
 * tamanho + valor) e um CRC16 no final, conforme o manual do Banco Central
 * (https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf). */

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** Só ASCII, maiúsculo, sem acento — os campos de texto do BR Code não
 * aceitam acentuação nem caracteres especiais. */
function sanitize(text: string, maxLength: number): string {
  const limpo = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .toUpperCase();
  return (limpo || "TITAN GALERIA").slice(0, maxLength);
}

/** CRC16-CCITT (false), polinômio 0x1021, inicial 0xFFFF — é o algoritmo
 * que o campo 63 do BR Code exige. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(params: {
  pixKey: string;
  merchantName: string;
  merchantCity?: string;
  amountCents: number;
  txid: string;
}): string {
  const merchantAccount = tlv("00", "BR.GOV.BCB.PIX") + tlv("01", params.pixKey.trim());
  const additionalData = tlv("05", sanitize(params.txid, 25).replace(/\s/g, "") || "***");

  const semCrc =
    tlv("00", "01") + // payload format indicator
    tlv("01", "11") + // código estático
    tlv("26", merchantAccount) +
    tlv("52", "0000") + // merchant category code
    tlv("53", "986") + // moeda: BRL
    tlv("54", (params.amountCents / 100).toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", sanitize(params.merchantName, 25)) +
    tlv("60", sanitize(params.merchantCity || "BRASIL", 15)) +
    tlv("62", additionalData) +
    "6304";

  return semCrc + crc16(semCrc);
}
