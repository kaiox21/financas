"use client";

/**
 * Último recurso: erro no próprio layout raiz. Substitui todo o documento, por
 * isso precisa renderizar suas próprias tags <html> e <body>. Estilos inline de
 * propósito — se o CSS falhar em carregar, esta tela ainda precisa aparecer.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
          background: "#fff",
          color: "#171717",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>
          Algo deu muito errado
        </h1>
        <p style={{ fontSize: 14, color: "#666", maxWidth: 360, margin: 0 }}>
          O aplicativo encontrou um erro inesperado. Tente recarregar.
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            fontWeight: 500,
            background: "#171717",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          Tentar de novo
        </button>
        {error.digest ? (
          <p style={{ fontSize: 12, color: "#999", margin: 0 }}>
            Código do erro: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
