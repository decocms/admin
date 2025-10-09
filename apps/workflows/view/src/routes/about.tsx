/**
 * ABOUT / LANDING PAGE
 *
 * Static landing page for non-authenticated users
 * Shows how to use Workflowz and invites to login
 */

import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "../main";
import { Zap, Play, Code2, Sparkles, ArrowRight } from "lucide-react";

function AboutPage() {
  return (
    <div
      style={{ minHeight: "100vh", backgroundColor: "#0a0e1a", color: "#fff" }}
    >
      {/* Hero Section */}
      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "80px 32px" }}
      >
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "32px",
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <span
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: "#4ade80",
                boxShadow: "0 0 20px rgba(74, 222, 128, 0.5)",
              }}
              className="animate-pulse"
            />
            <h1 style={{ fontSize: "56px", fontWeight: "bold", margin: 0 }}>
              Workflowz
            </h1>
          </div>

          {/* Tagline */}
          <p
            style={{
              fontSize: "28px",
              color: "#d1d5db",
              maxWidth: "900px",
              margin: "0 auto",
              lineHeight: "1.5",
            }}
          >
            Crie workflows com IA.{" "}
            <span style={{ color: "#4ade80" }}>Gere steps</span>,{" "}
            <span style={{ color: "#22d3ee" }}>execute código</span>,{" "}
            <span style={{ color: "#a855f7" }}>visualize resultados</span>.
          </p>

          {/* CTA */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              paddingTop: "32px",
            }}
          >
            <a
              href="/oauth/start"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "20px 40px",
                backgroundColor: "#00ff88",
                color: "#000",
                fontSize: "20px",
                fontWeight: "bold",
                borderRadius: "16px",
                textDecoration: "none",
                boxShadow: "0 10px 40px rgba(0, 255, 136, 0.2)",
                transition: "all 0.2s",
              }}
              className="hover:shadow-green-500/30"
            >
              Começar Agora
              <ArrowRight size={24} />
            </a>
            <a
              href="https://github.com/deco-cx/workflowz"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "20px 40px",
                backgroundColor: "#1f2937",
                color: "#fff",
                fontSize: "20px",
                fontWeight: "600",
                borderRadius: "16px",
                textDecoration: "none",
                border: "1px solid #374151",
                transition: "all 0.2s",
              }}
              className="hover:bg-gray-700"
            >
              GitHub
            </a>
          </div>
        </div>

        {/* Features Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "32px",
            marginTop: "96px",
          }}
        >
          <div
            style={{
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #1f2937",
              backgroundColor: "#0f1419",
              transition: "all 0.3s",
            }}
            className="hover:border-green-500/50"
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(74, 222, 128, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Sparkles style={{ color: "#4ade80" }} size={24} />
            </div>
            <h3
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "12px",
              }}
            >
              Geração com IA
            </h3>
            <p style={{ color: "#9ca3af", lineHeight: "1.7" }}>
              Descreva o que você quer e a IA gera o step completo com código,
              schema e visualizações customizadas.
            </p>
          </div>

          <div
            style={{
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #1f2937",
              backgroundColor: "#0f1419",
              transition: "all 0.3s",
            }}
            className="hover:border-cyan-500/50"
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(34, 211, 238, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Code2 style={{ color: "#22d3ee" }} size={24} />
            </div>
            <h3
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "12px",
              }}
            >
              Editor Visual
            </h3>
            <p style={{ color: "#9ca3af", lineHeight: "1.7" }}>
              Edite código gerado, veja logs de execução e debug com interface
              linda inspirada no Notion e Spotify.
            </p>
          </div>

          <div
            style={{
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid #1f2937",
              backgroundColor: "#0f1419",
              transition: "all 0.3s",
            }}
            className="hover:border-purple-500/50"
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "rgba(168, 85, 247, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Play style={{ color: "#a855f7" }} size={24} />
            </div>
            <h3
              style={{
                fontSize: "24px",
                fontWeight: "bold",
                marginBottom: "12px",
              }}
            >
              Execute & Monitore
            </h3>
            <p style={{ color: "#9ca3af", lineHeight: "1.7" }}>
              Rode workflows passo-a-passo ou em sequência. Monitore execução em
              tempo real com interface estilo player.
            </p>
          </div>
        </div>

        {/* How It Works */}
        <div style={{ marginTop: "128px" }}>
          <h2
            style={{
              fontSize: "40px",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "64px",
            }}
          >
            Como Funciona
          </h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "48px",
              maxWidth: "800px",
              margin: "0 auto",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#00ff88",
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "24px",
                }}
              >
                1
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Descreva Sua Tarefa
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: "18px",
                    lineHeight: "1.7",
                  }}
                >
                  Digite o que você quer fazer: "Gerar um poema sobre uma
                  cidade", "Contar tarefas no banco", ou "Analisar sentimento de
                  documento".
                </p>
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#22d3ee",
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "24px",
                }}
              >
                2
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  IA Gera o Step
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: "18px",
                    lineHeight: "1.7",
                  }}
                >
                  A IA cria um step completo com código de execução, schemas de
                  entrada/saída, e visualizações customizadas.
                </p>
              </div>
            </div>

            <div
              style={{ display: "flex", alignItems: "flex-start", gap: "24px" }}
            >
              <div
                style={{
                  flexShrink: 0,
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "#a855f7",
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  fontSize: "24px",
                }}
              >
                3
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "28px",
                    fontWeight: "bold",
                    marginBottom: "8px",
                  }}
                >
                  Execute & Itere
                </h3>
                <p
                  style={{
                    color: "#9ca3af",
                    fontSize: "18px",
                    lineHeight: "1.7",
                  }}
                >
                  Rode o step, veja resultados, edite se necessário. Encadeie
                  steps usando @ referências. Exporte/importe workflows
                  completos.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div
          style={{
            marginTop: "128px",
            padding: "48px",
            borderRadius: "16px",
            border: "1px solid #1f2937",
            backgroundColor: "#0f1419",
          }}
        >
          <h2
            style={{
              fontSize: "36px",
              fontWeight: "bold",
              textAlign: "center",
              marginBottom: "48px",
            }}
          >
            Recursos Poderosos
          </h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "24px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Zap style={{ color: "#4ade80", flexShrink: 0 }} size={20} />
              <span style={{ color: "#d1d5db" }}>
                Click-to-reference: Insira outputs facilmente
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Zap style={{ color: "#4ade80", flexShrink: 0 }} size={20} />
              <span style={{ color: "#d1d5db" }}>
                Views customizadas: Alterne JSON/Visual
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Zap style={{ color: "#4ade80", flexShrink: 0 }} size={20} />
              <span style={{ color: "#d1d5db" }}>
                Export/Import: Compartilhe workflows
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Zap style={{ color: "#4ade80", flexShrink: 0 }} size={20} />
              <span style={{ color: "#d1d5db" }}>
                Editor de código: Edite inline
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Zap style={{ color: "#4ade80", flexShrink: 0 }} size={20} />
              <span style={{ color: "#d1d5db" }}>
                Player: Navegue como música
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Zap style={{ color: "#4ade80", flexShrink: 0 }} size={20} />
              <span style={{ color: "#d1d5db" }}>
                Monitor: Status em tempo real
              </span>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div
          style={{
            marginTop: "128px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <h2 style={{ fontSize: "48px", fontWeight: "bold", margin: 0 }}>
            Pronto para Criar?
          </h2>
          <p style={{ fontSize: "24px", color: "#9ca3af" }}>
            Comece a criar workflows com IA em segundos.
          </p>
          <div>
            <a
              href="/oauth/start"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "24px 48px",
                backgroundColor: "#00ff88",
                color: "#000",
                fontSize: "24px",
                fontWeight: "bold",
                borderRadius: "16px",
                textDecoration: "none",
                boxShadow: "0 10px 40px rgba(0, 255, 136, 0.2)",
                transition: "all 0.2s",
              }}
            >
              Começar Grátis
              <ArrowRight size={28} />
            </a>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: "128px",
            paddingTop: "48px",
            borderTop: "1px solid #1f2937",
            textAlign: "center",
            color: "#6b7280",
          }}
        >
          <p>
            Feito com{" "}
            <a
              href="https://deco.cx"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#4ade80", textDecoration: "none" }}
              className="hover:underline"
            >
              deco.cx
            </a>
            • Powered by AI •{" "}
            <a
              href="https://github.com/deco-cx/workflowz"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "#4ade80", textDecoration: "none" }}
              className="hover:underline"
            >
              Open Source
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default createRoute({
  path: "/about",
  component: AboutPage,
  getParentRoute: () => rootRoute,
});
