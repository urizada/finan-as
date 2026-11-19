/** Minúsculas, sem acento e sem espaços sobrando: "  Comissão " → "comissao". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "uber, 99 ,Gasolina,, uber" → ["uber", "99", "gasolina"] (normalizadas, sem repetir). */
export function separarPalavrasChave(texto: string): string[] {
  const vistas = new Set<string>();
  for (const parte of texto.split(',')) {
    const p = normalizar(parte);
    if (p) vistas.add(p);
  }
  return [...vistas];
}
