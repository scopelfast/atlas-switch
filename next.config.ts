import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  devIndicators: false,
  /** pdfkit carrega `.afm` em disco; empacotar quebra caminhos (ex.: `C:\\ROOT\\node_modules\\…`). */
  serverExternalPackages: ['pdfkit'],
  /**
   * PPR / clientSegmentCache em canary + Turbopack podem emitir `<link rel="preload">` sem `as` válido
   * (aviso no Chrome na consola). Desactivado até o ecossistema estabilizar.
   *
   * Em Next 15.6 canary o Chrome ainda pode avisar `<link rel=preload> must have a valid as value` por CSS
   * injectado com `as="stylesheet"` (deveria ser `as="style"`). É limitação upstream; actualizar o Next quando
   * houver release com fix (ex.: vercel/next.js#84569) ou usar build estável remove o ruído na consola.
   */
  experimental: {
    ppr: false,
    clientSegmentCache: false,
  },
};

export default nextConfig;
