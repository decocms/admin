import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { client } from "../lib/rpc.ts";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Play,
  StopCircle,
  Workflow,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button.tsx";

function WorkflowsDemo() {
  const { mutateAsync: startWorkflow, isPending: isStarting, data: startData } =
    useMutation({
      mutationFn: () =>
        client.DECO_CHAT_WORKFLOWS_START_MY_WORKFLOW({ name: "Demo User" }),
    });

  return (
    <div className="bg-slate-50 dark:bg-slate-900 relative overflow-hidden min-h-screen">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-50/30 via-transparent to-emerald-50/30 dark:from-green-950/20 dark:via-transparent dark:to-emerald-950/20">
      </div>

      <div className="container mx-auto px-4 py-8 relative">
        {/* Back Button */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Home</span>
          </Link>
        </div>

        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-xl mb-6">
            <Workflow className="w-8 h-8 text-green-600 dark:text-green-300" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Workflows
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Combine código determinístico com IA para automatizar processos
            complexos
          </p>
        </header>

        {/* Demo Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-100 to-emerald-200 dark:from-emerald-900 dark:to-emerald-800 rounded-lg flex items-center justify-center mr-3">
                <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  MY_WORKFLOW
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Workflow de demonstração
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6">
              <p className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                <span className="text-green-600 dark:text-green-400">
                  Parâmetros:
                </span>{" "}
                {'{ name: "Demo User" }'}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                onClick={() => startWorkflow()}
                disabled={isStarting}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isStarting
                  ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white">
                      </div>
                      Iniciando Workflow...
                    </>
                  )
                  : (
                    <>
                      <Play className="w-4 h-4" />
                      Iniciar Workflow
                    </>
                  )}
              </Button>

              {/* Response */}
              {startData && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                        Workflow Iniciado
                      </h3>
                      <p className="text-green-700 dark:text-green-300 font-mono text-sm">
                        Instance ID: {startData.id}
                      </p>
                      <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                        Status: Iniciado com sucesso
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isStarting && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600">
                    </div>
                    <p className="text-green-700 dark:text-green-300">
                      Iniciando workflow...
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Híbrido: Código + IA
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Partes determinísticas executam via código (baratas, rápidas,
                confiáveis). Partes que precisam de inteligência usam IA para
                lidar com dados desestruturados e tomadas de decisão.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Controle e Monitoramento
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Monitore progresso, pause para aprovação humana, retome de onde
                parou. Ideal para tarefas complexas e de longa duração que
                precisam de supervisão.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/demo/workflows",
    component: WorkflowsDemo,
    getParentRoute: () => parentRoute,
  });
