import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { client } from "../lib/rpc.ts";
import { ArrowLeft, CheckCircle, Play, Settings, Terminal } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button.tsx";

function CallToolDemo() {
  const { mutateAsync, isPending, data } = useMutation({
    mutationFn: () => client.MY_TOOL({ name: "John Doe" }),
  });

  return (
    <div className="bg-slate-50 dark:bg-slate-900 relative overflow-hidden min-h-screen">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 dark:from-blue-950/20 dark:via-transparent dark:to-purple-950/20">
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl mb-6">
            <Settings className="w-8 h-8 text-blue-600 dark:text-blue-300" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Tools
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Ferramentas que conectam IA, workflows e views com APIs, bancos e
            serviços externos
          </p>
        </header>

        {/* Demo Card */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 shadow-lg">
            <div className="flex items-center mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-lg flex items-center justify-center mr-3">
                <Terminal className="w-5 h-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  MY_TOOL
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Ferramenta de demonstração
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-6">
              <p className="text-slate-700 dark:text-slate-300 font-mono text-sm">
                <span className="text-blue-600 dark:text-blue-400">
                  Parâmetros:
                </span>{" "}
                {'{ name: "John Doe" }'}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <Button
                onClick={() => mutateAsync()}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isPending
                  ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white">
                      </div>
                      Executando...
                    </>
                  )
                  : (
                    <>
                      <Play className="w-4 h-4" />
                      Executar Ferramenta
                    </>
                  )}
              </Button>

              {/* Response */}
              {data && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200 mb-1">
                        Resposta
                      </h3>
                      <p className="text-green-700 dark:text-green-300 font-mono text-sm">
                        {data.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isPending && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600">
                    </div>
                    <p className="text-blue-700 dark:text-blue-300">
                      Processando solicitação...
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
                Conectores Universais
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Tools são pontes entre seu sistema e o mundo externo. IA,
                workflows e views podem usar as mesmas ferramentas para
                consultar APIs, bancos de dados ou executar ações específicas.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Reutilização Inteligente
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Crie uma vez, use em qualquer lugar. A mesma tool que a IA usa
                para tomar decisões pode ser chamada por um workflow
                automatizado ou por uma interface de usuário.
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
    path: "/demo/call-tool",
    component: CallToolDemo,
    getParentRoute: () => parentRoute,
  });
