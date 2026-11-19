import { useEffect, useState } from 'react';
import { repositorio } from './repositorio';

/**
 * Roda uma consulta no repositório e repete sempre que algum dado muda.
 * Uso: const contas = useConsulta(() => repositorio.contas.listar(), []);
 */
export function useConsulta<T>(consulta: () => Promise<T>, deps: unknown[]): T | undefined {
  const [valor, setValor] = useState<T>();
  useEffect(() => {
    let ativo = true;
    const rodar = () => consulta().then((v) => { if (ativo) setValor(v); });
    rodar();
    const parar = repositorio.aoMudar(rodar);
    return () => { ativo = false; parar(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return valor;
}
