import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Só puxa os ícones/gráficos realmente usados, em vez do barril inteiro —
    // menos JS por rota, hidratação e troca de tela mais rápidas.
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@base-ui/react",
      "date-fns",
    ],
  },
};

export default nextConfig;
