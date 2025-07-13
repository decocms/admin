import { ChevronRight, Layout, Settings, Workflow } from "lucide-react";
import { Link } from "@tanstack/react-router";

function App() {
  return (
    <div className="bg-slate-50 dark:bg-slate-900 relative overflow-hidden min-h-screen">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 dark:from-blue-950/20 dark:via-transparent dark:to-purple-950/20">
      </div>

      <div className="container mx-auto px-4 py-12 relative min-h-screen flex flex-col justify-center">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="mb-8">
            <a
              href="https://deco.chat/about"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block group relative transform transition-all duration-300 hover:scale-110 hover:rotate-2 cursor-pointer"
            >
              <div className="absolute w-64 h-64 bg-gradient-to-r from-green-500 to-green-600 opacity-0 group-hover:opacity-20 blur-xl rounded-full transition-opacity duration-300 top-0 left-0">
              </div>
              <img
                src="/logo.png"
                alt="Deco Logo"
                className="w-64 h-64 object-contain group-hover:brightness-110 transition-all duration-300 relative z-10"
              />
            </a>
          </div>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Esse é um MCP que contém ferramentas, workflows e views.
            <br />
            E com isso dá para fazer tudo.
          </p>
        </header>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Tools Card */}
          <Link to="/demo/call-tool" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-800 transition-all duration-300 hover:scale-105 cursor-pointer min-h-[280px] flex flex-col justify-between">
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-blue-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Settings className="w-8 h-8 text-blue-600 dark:text-blue-300" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
                  Tools
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
                  Ferramentas poderosas para interagir com APIs, bancos de dados
                  e serviços externos de forma seamless
                </p>
              </div>
              <div className="flex items-center mt-6 text-blue-600 dark:text-blue-400 text-base font-medium">
                <span>Explorar</span>
                <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </Link>

          {/* Workflows Card */}
          <Link to="/demo/workflows" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 hover:shadow-lg hover:border-green-200 dark:hover:border-green-800 transition-all duration-300 hover:scale-105 cursor-pointer min-h-[280px] flex flex-col justify-between">
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Workflow className="w-8 h-8 text-green-600 dark:text-green-300" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
                  Workflows
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
                  Automatize processos complexos com workflows inteligentes que
                  conectam múltiplas ferramentas
                </p>
              </div>
              <div className="flex items-center mt-6 text-green-600 dark:text-green-400 text-base font-medium">
                <span>Automatizar</span>
                <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </Link>

          {/* Views Card */}
          <Link to="/demo/views" className="group">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-800 transition-all duration-300 hover:scale-105 cursor-pointer min-h-[280px] flex flex-col justify-between">
              <div>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Layout className="w-8 h-8 text-purple-600 dark:text-purple-300" />
                </div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white mb-4">
                  Views
                </h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg">
                  Interfaces interativas e responsivas para visualizar dados e
                  controlar seus sistemas
                </p>
              </div>
              <div className="flex items-center mt-6 text-purple-600 dark:text-purple-400 text-base font-medium">
                <span>Visualizar</span>
                <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform duration-300" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
