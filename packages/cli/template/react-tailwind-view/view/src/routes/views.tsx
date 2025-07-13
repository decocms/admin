import { createRoute, type RootRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  BarChart3,
  Bell,
  Calendar,
  Eye,
  Layout,
  Moon,
  Palette,
  Settings,
  Sun,
  User,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";

function ViewsDemo() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedTab, setSelectedTab] = useState("dashboard");
  const [progress, setProgress] = useState(65);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const incrementProgress = () => {
    setProgress((prev) => Math.min(prev + 10, 100));
  };

  const resetProgress = () => {
    setProgress(20);
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900 relative overflow-hidden min-h-screen">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-transparent to-pink-50/30 dark:from-purple-950/20 dark:via-transparent dark:to-pink-950/20">
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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-xl mb-6">
            <Layout className="w-8 h-8 text-purple-600 dark:text-purple-300" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
            Views
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Esta página React interativa É uma view - interfaces responsivas e
            dinâmicas em ação
          </p>
        </header>

        {/* Interactive Demo */}
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900 dark:to-purple-800 rounded-lg flex items-center justify-center mr-3">
                  <Eye className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                    View Interativa
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Elementos visuais respondendo em tempo real
                  </p>
                </div>
              </div>

              {/* Theme Toggle */}
              <Button
                onClick={toggleTheme}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                {isDarkMode
                  ? <Sun className="w-4 h-4" />
                  : <Moon className="w-4 h-4" />}
                {isDarkMode ? "Light" : "Dark"}
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
              {[
                { id: "dashboard", label: "Dashboard", icon: BarChart3 },
                { id: "calendar", label: "Agenda", icon: Calendar },
                { id: "profile", label: "Perfil", icon: User },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 font-medium transition-colors duration-200 ${
                    selectedTab === tab.id
                      ? "border-purple-600 text-purple-600 dark:text-purple-400"
                      : "border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dynamic Content */}
            <div className="space-y-6">
              {selectedTab === "dashboard" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-800 dark:text-blue-200">
                        Usuários Ativos
                      </h3>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        1,234
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-4 rounded-lg">
                      <h3 className="font-semibold text-green-800 dark:text-green-200">
                        Workflows
                      </h3>
                      <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                        89
                      </p>
                    </div>
                    <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 p-4 rounded-lg">
                      <h3 className="font-semibold text-purple-800 dark:text-purple-200">
                        Tools
                      </h3>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        156
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        Progresso do Sistema
                      </h3>
                      <span className="text-sm text-slate-600 dark:text-slate-300">
                        {progress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-4">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      >
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={incrementProgress} size="sm">
                        Incrementar
                      </Button>
                      <Button
                        onClick={resetProgress}
                        variant="outline"
                        size="sm"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === "calendar" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-7 gap-2 text-center">
                    {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((
                      day,
                    ) => (
                      <div
                        key={day}
                        className="font-semibold text-slate-600 dark:text-slate-300 p-2"
                      >
                        {day}
                      </div>
                    ))}
                    {Array.from({ length: 35 }, (_, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors duration-200 ${
                          i === 15
                            ? "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                            : ""
                        }`}
                      >
                        {i > 6 && i < 32 ? i - 6 : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTab === "profile" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        Demo User
                      </h3>
                      <p className="text-slate-600 dark:text-slate-300">
                        demo@deco.chat
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Nome
                      </label>
                      <input
                        type="text"
                        value="Demo User"
                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        readOnly
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Email
                      </label>
                      <input
                        type="email"
                        value="demo@deco.chat"
                        className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Interface Responsiva
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Esta página se adapta a diferentes tamanhos de tela e modos de
                tema, demonstrando como views podem ser dinâmicas e interativas,
                respondendo a ações do usuário em tempo real.
              </p>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6">
              <h3 className="font-semibold text-slate-900 dark:text-white mb-2">
                Componentes Vivos
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Cada elemento visual pode ser conectado a dados reais via tools
                e workflows. Dashboards, formulários e visualizações que se
                atualizam conforme o sistema evolui.
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
    path: "/demo/views",
    component: ViewsDemo,
    getParentRoute: () => parentRoute,
  });
