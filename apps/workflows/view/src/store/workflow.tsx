import { createStore, StoreApi, useStore } from "zustand";
import { createContext, useContext, useState, useMemo } from "react";
import { client } from "@/lib/rpc";
import { persist } from "zustand/middleware";
import { useSearch } from "@tanstack/react-router";

const STORAGE_KEY = "workflowz-storage";

type Workflow = NonNullable<
  Awaited<ReturnType<typeof client.DECO_RESOURCE_WORKFLOW_READ>>
>;
type WorkflowStep = NonNullable<
  Awaited<ReturnType<typeof client.DECO_RESOURCE_WORKFLOW_READ>>
>["data"]["steps"][number];

interface State {
  workflow: Workflow;
  currentStepIndex: number;
}

interface Actions {
  setCurrentStepIndex: (index: number) => void;
  updateWorkflow: (updates: Partial<Workflow>) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  updateDependencyToolCalls: () => void;
  addStep: (step: WorkflowStep) => void;
  removeStep: (stepId: string) => void;
  clearStore: () => void;
}

interface Store extends State {
  actions: Actions;
}

const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export const WorkflowStoreProvider = ({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: Workflow;
}) => {
  const [store] = useState(() =>
    createStore<Store>()(
      persist(
        (set, get) => ({
          workflow,
          currentStepIndex: 0,
          actions: {
            setCurrentStepIndex: (index: number) => {
              set(() => ({
                currentStepIndex: index,
              }));
            },
            updateWorkflow: (updates: Partial<Workflow>) => {
              set(() => ({
                workflow: { ...get().workflow, ...updates },
              }));
            },
            updateStep: (stepId: string, updates: Partial<WorkflowStep>) => {
              set(() => ({
                workflow: {
                  ...get().workflow,
                  data: {
                    ...get().workflow.data,
                    steps: get().workflow.data.steps.map(
                      (step: WorkflowStep) =>
                        step.name === stepId ? { ...step, ...updates } : step,
                    ),
                  },
                },
              }));
            },
            addStep: (step: WorkflowStep) => {
              set(() => ({
                workflow: {
                  ...get().workflow,
                  data: {
                    ...get().workflow.data,
                    steps: [...get().workflow.data.steps, step],
                  },
                },
                currentStepIndex: get().workflow.data.steps.length,
              }));
            },
            removeStep: (stepId: string) => {
              set(() => ({
                workflow: {
                  ...get().workflow,
                  data: {
                    ...get().workflow.data,
                    steps: get().workflow.data.steps.filter(
                      (step: WorkflowStep) => step.name !== stepId,
                    ),
                  },
                },
                currentStepIndex: get().workflow.data.steps.length,
              }));
            },
            updateDependencyToolCalls: () => {
              type DependencyEntry = NonNullable<
                WorkflowStep["dependencies"]
              >[number];
              const allToolsMap = new Map<string, DependencyEntry>();
              get().workflow.data.steps.forEach((step: WorkflowStep) => {
                step.dependencies?.forEach((dependency: DependencyEntry) => {
                  const key = `${dependency.integrationId}`;
                  if (!allToolsMap.has(key)) {
                    allToolsMap.set(key, dependency);
                  }
                });
              });

              const dependencyToolCalls = Array.from(allToolsMap.values());

              console.log(
                `📦 Updated dependencyToolCalls: ${dependencyToolCalls.length} unique tools`,
              );

              const updatedWorkflow = {
                ...workflow,
                dependencyToolCalls,
                updatedAt: new Date().toISOString(),
              };

              set(() => ({
                workflow: updatedWorkflow,
              }));
            },
            clearStore: () => {
              set(() => ({
                workflow: {
                  ...get().workflow,
                  data: {
                    ...get().workflow.data,
                    steps: [],
                  },
                },
                currentStepIndex: 0,
              }));
            },
          },
        }),
        {
          name: STORAGE_KEY,
          partialize: (state) => ({
            workflow: state.workflow,
          }),
        },
      ),
    ),
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
};

const WORKFLOW = {
  id: "workflow_1759939720696_7oo47sqry",
  name: "Analise Politica por Estado",
  description: "New workflow",
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {},
  },
  steps: [
    {
      id: "step_1759939748244_slbq2rim5",
      title: "List Federal Units",
      description: "Lists all federal units (UFs) from IBGE",
      status: "completed",
      toolCalls: ["IBGE_LIST_FEDERAL_UNITS"],
      inputSchema: {
        type: "object",
        properties: {},
      },
      outputSchema: {
        type: "object",
        properties: {
          data: {
            type: "array",
            description: "List of federal units",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Federal unit ID",
                },
                acronym: {
                  type: "string",
                  description: "Federal unit acronym (UF)",
                },
                name: {
                  type: "string",
                  description: "Federal unit name",
                },
              },
              required: ["id", "acronym", "name"],
            },
          },
        },
        required: ["data"],
      },
      input: {},
      output: {},
      logs: [],
      duration: 3945,
      code: "export default async function (input, ctx) {\n  try {\n    const response = await ctx.env['i:84b039cf-8f52-49f3-b152-0edf86949c0f'].IBGE_LIST_FEDERAL_UNITS({});\n    return { data: response.data };\n  } catch (error) {\n    return { data: [], error: String(error) };\n  }\n}",
      createdAt: "2025-10-08T16:09:08.244Z",
      updatedAt: "2025-10-08T19:52:08.516Z",
    },
    {
      id: "step_1759944204619_vnoy7ipmv",
      title: "Match Federal Unit by Acronym",
      description:
        "Receives a UF acronym and matches it with the federal units list, returning the complete UF data (id, acronym, name)",
      status: "completed",
      toolCalls: ["None (Simple JavaScript)"],
      inputSchema: {
        type: "object",
        properties: {
          acronym: {
            type: "string",
            description:
              "The UF acronym to search for (e.g., 'SP', 'RJ', 'MG')",
          },
          federalUnitsList: {
            type: "array",
            description: "List of federal units from previous step",
            items: {
              type: "object",
              properties: {
                id: {
                  type: "number",
                  description: "Federal unit ID",
                },
                acronym: {
                  type: "string",
                  description: "Federal unit acronym",
                },
                name: {
                  type: "string",
                  description: "Federal unit name",
                },
              },
            },
          },
        },
        required: ["acronym", "federalUnitsList"],
      },
      outputSchema: {
        type: "object",
        properties: {
          found: {
            type: "boolean",
            description: "Whether a matching UF was found",
          },
          uf: {
            type: ["object", "null"],
            description: "The matched federal unit data",
            properties: {
              id: {
                type: "number",
                description: "Federal unit ID",
              },
              acronym: {
                type: "string",
                description: "Federal unit acronym",
              },
              name: {
                type: "string",
                description: "Federal unit name",
              },
            },
          },
          error: {
            type: "string",
            description: "Error message if any",
          },
        },
        required: ["found", "uf"],
      },
      input: {
        acronym: "RJ",
        federalUnitsList: "@step_1759939748244_slbq2rim5.output.data",
      },
      output: {},
      logs: [],
      duration: 3152,
      code: "export default async function (input, ctx) {\n  try {\n    const acronymToMatch = input.acronym?.toUpperCase()?.trim();\n    const federalUnits = input.federalUnitsList || [];\n    \n    if (!acronymToMatch) {\n      return { \n        found: false, \n        uf: null,\n        error: 'No acronym provided' \n      };\n    }\n    \n    const matchedUF = federalUnits.find(uf => \n      uf.acronym?.toUpperCase()?.trim() === acronymToMatch\n    );\n    \n    if (matchedUF) {\n      return {\n        found: true,\n        uf: {\n          id: matchedUF.id,\n          acronym: matchedUF.acronym,\n          name: matchedUF.name\n        }\n      };\n    }\n    \n    return {\n      found: false,\n      uf: null,\n      error: `No federal unit found with acronym: ${acronymToMatch}`\n    };\n  } catch (error) {\n    return { \n      found: false, \n      uf: null, \n      error: String(error) \n    };\n  }\n}",
      inputViews: {
        acronym: {
          "Seletor de UF":
            "<div id=\"view-root\" style=\"padding: 24px; background: #0f1419; border-radius: 12px; color: #fff; font-family: system-ui; max-width: 600px; margin: 0 auto;\">\n  <div style=\"margin-bottom: 24px;\">\n    <h2 style=\"margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #fff;\">Selecionar UF</h2>\n    <p style=\"margin: 0; color: #9ca3af; font-size: 14px;\">Escolha o acronym da Unidade Federativa</p>\n  </div>\n\n  <label style=\"display: block; color: #9ca3af; font-size: 14px; font-weight: 500; margin-bottom: 8px;\">\n    Filtrar UF\n  </label>\n  <input \n    id=\"search-input\" \n    type=\"text\" \n    placeholder=\"Digite para filtrar (ex: SP, São Paulo)...\" \n    style=\"width: 100%; padding: 12px; background: #111827; border: 1px solid #1f2937; border-radius: 8px; color: #fff; font-size: 16px; margin-bottom: 16px; box-sizing: border-box;\" \n  />\n\n  <div id=\"uf-list\" style=\"max-height: 400px; overflow-y: auto; margin-bottom: 16px; border: 1px solid #1f2937; border-radius: 8px; background: #111827;\">\n    <div style=\"padding: 24px; text-align: center; color: #9ca3af;\">\n      Carregando UFs...\n    </div>\n  </div>\n\n  <div id=\"selected-info\" style=\"padding: 16px; background: #111827; border: 1px solid #1f2937; border-radius: 8px; margin-bottom: 16px; display: none;\">\n    <div style=\"color: #9ca3af; font-size: 12px; margin-bottom: 4px;\">Selecionado:</div>\n    <div id=\"selected-text\" style=\"color: #00ff88; font-size: 18px; font-weight: 600;\"></div>\n  </div>\n\n  <button \n    id=\"submit-btn\" \n    disabled\n    style=\"padding: 12px 24px; background: #374151; color: #6b7280; border: none; border-radius: 8px; cursor: not-allowed; font-weight: 600; font-size: 16px; width: 100%; transition: all 0.2s;\"\n  >\n    Selecione uma UF\n  </button>\n\n  <script>\n    document.addEventListener('DOMContentLoaded', function() {\n      console.log('🎨 [InputView] Initializing UF Selector...');\n      \n      const previousStepData = window.viewData || {};\n      console.log('📥 [InputView] Previous step data:', previousStepData);\n      \n      let selectedAcronym = null;\n      let allUFs = [];\n      \n      const searchInput = document.getElementById('search-input');\n      const ufList = document.getElementById('uf-list');\n      const selectedInfo = document.getElementById('selected-info');\n      const selectedText = document.getElementById('selected-text');\n      const submitBtn = document.getElementById('submit-btn');\n      \n      // Load UFs from previous step data\n      function loadUFs() {\n        if (!previousStepData || !previousStepData.data || !Array.isArray(previousStepData.data)) {\n          console.warn('⚠️ [InputView] No UF data available from previous step');\n          ufList.innerHTML = '<div style=\"padding: 24px; text-align: center; color: #ef4444;\">Nenhuma UF disponível. Execute o passo anterior primeiro.</div>';\n          return;\n        }\n        \n        allUFs = previousStepData.data;\n        console.log('✅ [InputView] Loaded ' + allUFs.length + ' UFs');\n        renderUFs(allUFs);\n      }\n      \n      // Render UF list\n      function renderUFs(ufs) {\n        if (ufs.length === 0) {\n          ufList.innerHTML = '<div style=\"padding: 24px; text-align: center; color: #9ca3af;\">Nenhuma UF encontrada</div>';\n          return;\n        }\n        \n        ufList.innerHTML = '';\n        \n        ufs.forEach(function(uf) {\n          const item = document.createElement('div');\n          item.style.cssText = 'padding: 16px; border-bottom: 1px solid #1f2937; cursor: pointer; transition: background 0.2s; display: flex; justify-content: space-between; align-items: center;';\n          \n          item.innerHTML = '<div><div style=\"font-weight: 600; font-size: 16px; color: #fff; margin-bottom: 4px;\">' + \n            uf.acronym + \n            '</div><div style=\"font-size: 14px; color: #9ca3af;\">' + \n            uf.name + \n            '</div></div><div id=\"check-' + uf.id + '\" style=\"display: none; color: #00ff88; font-size: 20px;\">✓</div>';\n          \n          item.onmouseover = function() {\n            if (selectedAcronym !== uf.acronym) {\n              item.style.background = '#1f2937';\n            }\n          };\n          \n          item.onmouseout = function() {\n            if (selectedAcronym !== uf.acronym) {\n              item.style.background = 'transparent';\n            }\n          };\n          \n          item.onclick = function() {\n            selectUF(uf);\n          };\n          \n          ufList.appendChild(item);\n        });\n      }\n      \n      // Select UF\n      function selectUF(uf) {\n        console.log('🎯 [InputView] Selected UF:', uf);\n        selectedAcronym = uf.acronym;\n        \n        // Update visual selection\n        const allItems = ufList.querySelectorAll('div[id^=\"check-\"]');\n        allItems.forEach(function(check) {\n          check.style.display = 'none';\n        });\n        \n        const allItemDivs = ufList.children;\n        for (let i = 0; i < allItemDivs.length; i++) {\n          allItemDivs[i].style.background = 'transparent';\n        }\n        \n        const selectedItem = document.getElementById('check-' + uf.id);\n        if (selectedItem) {\n          selectedItem.style.display = 'block';\n          selectedItem.parentElement.parentElement.style.background = '#1f2937';\n        }\n        \n        // Update selected info\n        selectedInfo.style.display = 'block';\n        selectedText.textContent = uf.acronym + ' - ' + uf.name;\n        \n        // Enable submit button\n        submitBtn.disabled = false;\n        submitBtn.style.background = '#00ff88';\n        submitBtn.style.color = '#000';\n        submitBtn.style.cursor = 'pointer';\n        submitBtn.textContent = 'Confirmar Seleção';\n      }\n      \n      // Filter UFs\n      searchInput.oninput = function() {\n        const query = searchInput.value.toLowerCase().trim();\n        \n        if (query === '') {\n          renderUFs(allUFs);\n          return;\n        }\n        \n        const filtered = allUFs.filter(function(uf) {\n          return uf.acronym.toLowerCase().includes(query) || \n                 uf.name.toLowerCase().includes(query);\n        });\n        \n        console.log('🔍 [InputView] Filtered to ' + filtered.length + ' UFs for query: ' + query);\n        renderUFs(filtered);\n      };\n      \n      // Submit handler\n      submitBtn.onclick = function() {\n        if (!selectedAcronym) {\n          alert('Por favor, selecione uma UF');\n          return;\n        }\n        \n        console.log('📤 [InputView] Submitting acronym:', selectedAcronym);\n        \n        window.parent.postMessage({\n          type: 'inputViewSubmit',\n          data: { acronym: selectedAcronym }\n        }, '*');\n        \n        // Visual feedback\n        submitBtn.textContent = 'Enviado ✓';\n        submitBtn.style.background = '#4ade80';\n        setTimeout(function() {\n          submitBtn.textContent = 'Confirmar Seleção';\n          submitBtn.style.background = '#00ff88';\n        }, 2000);\n      };\n      \n      // Initialize\n      loadUFs();\n      \n      console.log('✅ [InputView] UF Selector initialized successfully');\n    });\n  </script>\n</div>",
        },
      },
      createdAt: "2025-10-08T17:23:24.619Z",
      updatedAt: "2025-10-08T20:53:38.275Z",
    },
    {
      id: "step_1759946000000_search_surveys",
      title: "Search Surveys for UF with Details",
      description:
        "Searches for surveys (pesquisas) related to the selected UF, gets the first one found and fetches its complete details including questions and answers",
      status: "completed",
      toolCalls: ["SEARCH_PESQUISAS", "GET_PESQUISA_DETAILS"],
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The UF acronym to search surveys for",
          },
          limit: {
            type: "number",
            description: "Maximum number of results to return",
            default: 20,
          },
        },
        required: ["query"],
      },
      outputSchema: {
        type: "object",
        properties: {
          found: {
            type: "boolean",
            description: "Whether a survey was found",
          },
          basicInfo: {
            type: ["object", "null"],
            description: "Basic survey info from search",
          },
          details: {
            type: ["object", "null"],
            description: "Complete survey details",
            properties: {
              pesquisa: {
                type: ["object", "null"],
                description: "Detailed survey information",
              },
              perguntas: {
                type: "array",
                description: "List of questions",
                items: {
                  type: "object",
                },
              },
              respostas: {
                type: "array",
                description: "List of answers",
                items: {
                  type: "object",
                },
              },
            },
          },
          totalFound: {
            type: "number",
            description: "Total number of surveys found in search",
          },
          error: {
            type: "string",
            description: "Error message if any",
          },
        },
        required: ["found", "basicInfo", "details", "totalFound"],
      },
      input: {
        query: "@step_1759944204619_vnoy7ipmv.output.uf.acronym",
        limit: 20,
      },
      output: {},
      logs: [],
      duration: 1989,
      code: "export default async function (input, ctx) {\n  try {\n    // Step 1: Search for surveys\n    const searchResponse = await ctx.env['i:84b039cf-8f52-49f3-b152-0edf86949c0f'].SEARCH_PESQUISAS({\n      query: input.query,\n      limit: input.limit || 20\n    });\n    \n    const pesquisas = searchResponse.pesquisas || [];\n    const count = searchResponse.count || 0;\n    \n    if (pesquisas.length === 0) {\n      return {\n        found: false,\n        basicInfo: null,\n        details: null,\n        totalFound: 0,\n        error: `No surveys found for UF: ${input.query}`\n      };\n    }\n    \n    // Step 2: Get details of the first survey found\n    const firstSurvey = pesquisas[0];\n    const detailsResponse = await ctx.env['i:84b039cf-8f52-49f3-b152-0edf86949c0f'].GET_PESQUISA_DETAILS({\n      pesquisaId: firstSurvey.id\n    });\n    \n    return {\n      found: true,\n      basicInfo: firstSurvey,\n      details: {\n        pesquisa: detailsResponse.pesquisa,\n        perguntas: detailsResponse.perguntas || [],\n        respostas: detailsResponse.respostas || []\n      },\n      totalFound: count\n    };\n  } catch (error) {\n    return {\n      found: false,\n      basicInfo: null,\n      details: null,\n      totalFound: 0,\n      error: String(error)\n    };\n  }\n}",
      outputViews: {
        "Pesquisa Eleitoral":
          '<div id="view-root" style="padding: 24px; background: #0f1419; color: #fff; font-family: system-ui; max-width: 1400px; margin: 0 auto; min-height: 100vh;">\n  <style>\n    .bar-chart { display: flex; align-items: center; gap: 12px; margin: 8px 0; }\n    .bar-chart-label { min-width: 180px; color: #d1d5db; font-size: 13px; }\n    .bar-chart-bar-container { flex: 1; background: #1f2937; border-radius: 6px; height: 32px; position: relative; overflow: hidden; }\n    .bar-chart-bar { height: 100%; border-radius: 6px; transition: width 0.3s ease; display: flex; align-items: center; padding: 0 8px; font-size: 12px; font-weight: 600; }\n    .bar-positive { background: linear-gradient(90deg, #10b981, #059669); }\n    .bar-negative { background: linear-gradient(90deg, #ef4444, #dc2626); }\n    .bar-neutral { background: linear-gradient(90deg, #6366f1, #4f46e5); }\n    .bar-candidate { background: linear-gradient(90deg, #8b5cf6, #7c3aed); }\n    .accordion-header { background: #1f2937; padding: 12px 16px; border-radius: 6px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s; }\n    .accordion-header:hover { background: #374151; }\n    .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease; }\n    .accordion-content.open { max-height: 2000px; }\n    .profile-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }\n    .profile-item { background: #1f2937; padding: 12px; border-radius: 6px; }\n    .profile-label { color: #9ca3af; font-size: 12px; margin-bottom: 4px; }\n    .profile-value { color: #d1d5db; font-weight: 600; font-size: 14px; }\n  </style>\n\n  <div id="header" style="margin-bottom: 32px; border-bottom: 2px solid #1f2937; padding-bottom: 20px;">\n    <h1 style="color: #00ff88; font-size: 32px; font-weight: bold; margin: 0 0 12px 0; display: flex; align-items: center; gap: 12px;">\n      <span>📊</span>\n      <span id="survey-title">Pesquisa Eleitoral</span>\n    </h1>\n    <div id="survey-meta" style="display: flex; gap: 12px; flex-wrap: wrap; margin-top: 16px;"></div>\n  </div>\n\n  <div id="error-container" style="display: none; padding: 20px; background: #7f1d1d; border-left: 4px solid #f87171; border-radius: 8px; margin-bottom: 20px;">\n    <p id="error-message" style="margin: 0; color: #fecaca; font-weight: 500;"></p>\n  </div>\n\n  <div id="not-found" style="display: none; padding: 40px; background: #111827; border-radius: 12px; text-align: center;">\n    <p style="color: #9ca3af; font-size: 20px; margin: 0;">Nenhuma pesquisa encontrada</p>\n  </div>\n\n  <div id="content-container" style="display: none;">\n    <!-- Survey Methodology Section -->\n    <div id="methodology-section" style="background: #111827; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #1f2937;"></div>\n\n    <!-- Sample Profile Section -->\n    <div id="sample-profile-section" style="background: #111827; border-radius: 12px; padding: 24px; margin-bottom: 24px; border: 1px solid #1f2937;">\n      <h3 style="color: #22d3ee; font-size: 20px; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">\n        <span>👥</span> Perfil da Amostra\n      </h3>\n      <div id="sample-profile-content"></div>\n    </div>\n\n    <!-- Answers Section with Visual Charts -->\n    <div id="answers-section" style="margin-bottom: 24px;">\n      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">\n        <h3 style="color: #22d3ee; font-size: 20px; margin: 0; display: flex; align-items: center; gap: 8px;">\n          <span>📈</span> Resultados\n        </h3>\n        <span id="answers-count" style="background: #374151; color: #d1d5db; padding: 6px 16px; border-radius: 6px; font-size: 14px; font-weight: 600;"></span>\n      </div>\n      <div id="answers-list"></div>\n    </div>\n\n    <!-- Questions Section (Collapsed by default) -->\n    <div id="questions-section" style="margin-bottom: 24px;">\n      <div class="accordion-header" onclick="toggleAccordion(\'questions-accordion\')">\n        <h3 style="color: #a855f7; font-size: 18px; margin: 0; display: flex; align-items: center; gap: 8px;">\n          <span>❓</span> Perguntas (<span id="questions-count">0</span>)\n        </h3>\n        <span id="questions-accordion-icon" style="color: #9ca3af; font-size: 20px;">▼</span>\n      </div>\n      <div id="questions-accordion" class="accordion-content">\n        <div id="questions-list" style="padding: 16px; background: #0f1419; border-radius: 0 0 8px 8px;"></div>\n      </div>\n    </div>\n\n    <!-- Actions -->\n    <div style="margin-top: 32px; display: flex; gap: 12px; flex-wrap: wrap;">\n      <button id="copy-btn" style="padding: 12px 24px; background: #00ff88; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3); transition: all 0.2s;">\n        📋 Copiar Dados JSON\n      </button>\n      <button id="toggle-raw-btn" style="padding: 12px 24px; background: #374151; color: #d1d5db; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;">\n        🔍 Ver Dados Brutos\n      </button>\n    </div>\n\n    <div id="raw-data" style="display: none; margin-top: 20px; background: #111827; border-radius: 12px; padding: 20px; border: 1px solid #1f2937;">\n      <pre id="raw-json" style="margin: 0; color: #d1d5db; font-size: 12px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;"></pre>\n    </div>\n  </div>\n\n  <script>\n    function toggleAccordion(id) {\n      const content = document.getElementById(id);\n      const icon = document.getElementById(id + \'-icon\');\n      if (content.classList.contains(\'open\')) {\n        content.classList.remove(\'open\');\n        icon.textContent = \'▼\';\n      } else {\n        content.classList.add(\'open\');\n        icon.textContent = \'▲\';\n      }\n    }\n\n    function createBarChart(label, value, maxValue, type = \'neutral\') {\n      const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;\n      return `\n        <div class="bar-chart">\n          <div class="bar-chart-label">${label}</div>\n          <div class="bar-chart-bar-container">\n            <div class="bar-chart-bar bar-${type}" style="width: ${percentage}%">\n              ${value.toFixed(1)}%\n            </div>\n          </div>\n        </div>\n      `;\n    }\n\n    function renderResponseChart(responseData) {\n      let html = \'\';\n      const entries = Object.entries(responseData);\n      const maxValue = Math.max(...entries.map(([_, v]) => typeof v === \'number\' ? v : 0));\n\n      entries.forEach(([key, value]) => {\n        if (typeof value === \'number\') {\n          let type = \'candidate\';\n          if (key.toLowerCase().includes(\'aprovo\') || key.toLowerCase().includes(\'positiva\') || key.toLowerCase().includes(\'bom\')) {\n            type = \'positive\';\n          } else if (key.toLowerCase().includes(\'desaprovo\') || key.toLowerCase().includes(\'negativa\') || key.toLowerCase().includes(\'ruim\')) {\n            type = \'negative\';\n          }\n          html += createBarChart(key, value, maxValue, type);\n        }\n      });\n      return html;\n    }\n\n    document.addEventListener(\'DOMContentLoaded\', function() {\n      const data = window.viewData || {};\n      \n      console.log(\'📊 [SurveyView] Rendering with data:\', data);\n      \n      if (!data || Object.keys(data).length === 0) {\n        console.error(\'❌ [SurveyView] No data received!\');\n        document.getElementById(\'error-container\').style.display = \'block\';\n        document.getElementById(\'error-message\').textContent = \'Erro: Nenhum dado recebido\';\n        return;\n      }\n\n      if (data.error) {\n        console.error(\'❌ [SurveyView] Error in data:\', data.error);\n        document.getElementById(\'error-container\').style.display = \'block\';\n        document.getElementById(\'error-message\').textContent = data.error;\n        return;\n      }\n\n      if (!data.found) {\n        console.log(\'ℹ️ [SurveyView] No survey found\');\n        document.getElementById(\'not-found\').style.display = \'block\';\n        if (data.totalFound !== undefined) {\n          document.getElementById(\'not-found\').querySelector(\'p\').textContent = `Nenhuma pesquisa encontrada (Total: ${data.totalFound})`;\n        }\n        return;\n      }\n\n      document.getElementById(\'content-container\').style.display = \'block\';\n\n      const basicInfo = data.basicInfo || {};\n      const details = data.details || {};\n      const pesquisa = details.pesquisa || {};\n\n      // Set title\n      const title = basicInfo.title || pesquisa.title || \'Pesquisa Eleitoral\';\n      document.getElementById(\'survey-title\').textContent = title;\n\n      // Render meta badges\n      const metaContainer = document.getElementById(\'survey-meta\');\n      const metaItems = [\n        { icon: \'🏢\', label: \'Instituto\', value: basicInfo.institute || pesquisa.institute },\n        { icon: \'📅\', label: \'Referência\', value: basicInfo.reference_date },\n        { icon: \'📰\', label: \'Publicação\', value: basicInfo.publication_date },\n        { icon: \'👥\', label: \'Amostra\', value: basicInfo.sample_size ? `${basicInfo.sample_size} entrevistados` : null },\n        { icon: \'📊\', label: \'Margem\', value: basicInfo.margin_of_error ? `±${basicInfo.margin_of_error}%` : null },\n        { icon: \'📍\', label: \'Local\', value: basicInfo.division_name },\n      ];\n\n      metaItems.forEach(item => {\n        if (item.value) {\n          const badge = document.createElement(\'div\');\n          badge.style.cssText = \'background: #1f2937; padding: 12px 16px; border-radius: 8px; border: 1px solid #374151; min-width: 180px;\';\n          badge.innerHTML = `\n            <div style="color: #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">\n              ${item.icon} ${item.label}\n            </div>\n            <div style="color: #f3f4f6; font-weight: 600; font-size: 15px;">${item.value}</div>\n          `;\n          metaContainer.appendChild(badge);\n        }\n      });\n\n      // Render methodology\n      const methodologySection = document.getElementById(\'methodology-section\');\n      methodologySection.innerHTML = `\n        <h3 style="color: #22d3ee; font-size: 20px; margin: 0 0 16px 0; display: flex; align-items: center; gap: 8px;">\n          <span>🔬</span> Metodologia\n        </h3>\n        <div class="profile-grid">\n          <div class="profile-item">\n            <div class="profile-label">Método</div>\n            <div class="profile-value">${basicInfo.methodology || \'N/A\'}</div>\n          </div>\n          <div class="profile-item">\n            <div class="profile-label">Período de Coleta</div>\n            <div class="profile-value">${pesquisa.collection_start_date || \'N/A\'} a ${pesquisa.collection_end_date || \'N/A\'}</div>\n          </div>\n          <div class="profile-item">\n            <div class="profile-label">Nível de Confiança</div>\n            <div class="profile-value">${pesquisa.confidence_level || \'N/A\'}%</div>\n          </div>\n          <div class="profile-item">\n            <div class="profile-label">Status</div>\n            <div class="profile-value" style="text-transform: capitalize;">${pesquisa.status || \'N/A\'}</div>\n          </div>\n        </div>\n      `;\n\n      // Render sample profile\n      const sampleProfileContent = document.getElementById(\'sample-profile-content\');\n      let profileHTML = \'\';\n\n      // Gender\n      if (pesquisa.pool_profile_gender) {\n        profileHTML += \'<h4 style="color: #f59e0b; font-size: 16px; margin: 16px 0 12px 0;">Gênero</h4>\';\n        profileHTML += renderResponseChart(pesquisa.pool_profile_gender);\n      }\n\n      // Age range\n      if (pesquisa.pool_profile_age_range) {\n        profileHTML += \'<h4 style="color: #f59e0b; font-size: 16px; margin: 16px 0 12px 0;">Faixa Etária</h4>\';\n        profileHTML += renderResponseChart(pesquisa.pool_profile_age_range);\n      }\n\n      // Education\n      if (pesquisa.pool_profile_education_level) {\n        profileHTML += \'<h4 style="color: #f59e0b; font-size: 16px; margin: 16px 0 12px 0;">Escolaridade</h4>\';\n        profileHTML += renderResponseChart(pesquisa.pool_profile_education_level);\n      }\n\n      // Income\n      if (pesquisa.pool_profile_monthly_family_income) {\n        profileHTML += \'<h4 style="color: #f59e0b; font-size: 16px; margin: 16px 0 12px 0;">Renda Familiar Mensal</h4>\';\n        profileHTML += renderResponseChart(pesquisa.pool_profile_monthly_family_income);\n      }\n\n      // Religion\n      if (pesquisa.pool_profile_religion) {\n        profileHTML += \'<h4 style="color: #f59e0b; font-size: 16px; margin: 16px 0 12px 0;">Religião</h4>\';\n        profileHTML += renderResponseChart(pesquisa.pool_profile_religion);\n      }\n\n      sampleProfileContent.innerHTML = profileHTML || \'<p style="color: #9ca3af;">Dados do perfil da amostra não disponíveis</p>\';\n\n      // Render questions\n      const perguntas = details.perguntas || [];\n      document.getElementById(\'questions-count\').textContent = perguntas.length;\n      \n      const questionsList = document.getElementById(\'questions-list\');\n      if (perguntas.length === 0) {\n        questionsList.innerHTML = \'<p style="color: #6b7280; padding: 16px; text-align: center;">Nenhuma pergunta disponível</p>\';\n      } else {\n        let questionsHTML = \'\';\n        perguntas.forEach((pergunta, index) => {\n          questionsHTML += `\n            <div style="background: #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 12px; border-left: 4px solid #a855f7;">\n              <div style="color: #a855f7; font-weight: 600; font-size: 16px; margin-bottom: 8px;">\n                ${index + 1}. ${pergunta.title || \'Sem título\'}\n              </div>\n              <div style="color: #d1d5db; font-size: 14px; line-height: 1.6; margin-bottom: 8px;">\n                ${pergunta.question_text || \'\'}\n              </div>\n              <div style="color: #9ca3af; font-size: 12px;">\n                Tipo: ${pergunta.question_type || \'N/A\'}\n              </div>\n            </div>\n          `;\n        });\n        questionsList.innerHTML = questionsHTML;\n      }\n\n      // Render answers with charts\n      const respostas = details.respostas || [];\n      document.getElementById(\'answers-count\').textContent = `${respostas.length} pergunta(s)`;\n      \n      const answersList = document.getElementById(\'answers-list\');\n      if (respostas.length === 0) {\n        answersList.innerHTML = \'<p style="color: #6b7280; padding: 16px; background: #111827; border-radius: 8px; text-align: center;">Nenhuma resposta disponível</p>\';\n      } else {\n        let answersHTML = \'\';\n        respostas.forEach((resposta, index) => {\n          const questionTitle = resposta.question_title || `Pergunta ${index + 1}`;\n          const questionType = resposta.question_type || \'\';\n          const relatedPersons = resposta.related_persons || [];\n          \n          answersHTML += `\n            <div style="background: #111827; border-radius: 12px; padding: 24px; margin-bottom: 20px; border: 1px solid #1f2937;">\n              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">\n                <div>\n                  <h4 style="color: #00ff88; font-size: 18px; margin: 0 0 8px 0; font-weight: 600;">\n                    ${questionTitle}\n                  </h4>\n                  ${relatedPersons.length > 0 ? `<div style="color: #9ca3af; font-size: 13px;">👤 ${relatedPersons.join(\', \')}</div>` : \'\'}\n                </div>\n                <span style="background: #374151; color: #d1d5db; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">\n                  ${questionType}\n                </span>\n              </div>\n              <div style="margin-top: 20px;">\n                ${renderResponseChart(resposta.response_json || {})}\n              </div>\n              ${resposta.demographic_crosstabs ? `\n                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #1f2937;">\n                  <div class="accordion-header" onclick="toggleAccordion(\'demo-${index}\')" style="margin: 0;">\n                    <span style="color: #9ca3af; font-size: 14px; font-weight: 600;">📊 Ver dados demográficos</span>\n                    <span id="demo-${index}-icon" style="color: #9ca3af; font-size: 16px;">▼</span>\n                  </div>\n                  <div id="demo-${index}" class="accordion-content">\n                    <div style="padding: 16px; background: #0f1419; border-radius: 0 0 8px 8px; margin-top: 8px; color: #9ca3af; font-size: 13px;">\n                      <pre style="overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; color: #d1d5db;">${JSON.stringify(resposta.demographic_crosstabs, null, 2)}</pre>\n                    </div>\n                  </div>\n                </div>\n              ` : \'\'}\n            </div>\n          `;\n        });\n        answersList.innerHTML = answersHTML;\n      }\n\n      // Copy button\n      const copyBtn = document.getElementById(\'copy-btn\');\n      copyBtn.onclick = () => {\n        navigator.clipboard.writeText(JSON.stringify(data, null, 2));\n        copyBtn.textContent = \'✅ Copiado!\';\n        copyBtn.style.background = \'#22d3ee\';\n        setTimeout(() => {\n          copyBtn.textContent = \'📋 Copiar Dados JSON\';\n          copyBtn.style.background = \'#00ff88\';\n        }, 2000);\n      };\n\n      // Toggle raw data\n      const toggleRawBtn = document.getElementById(\'toggle-raw-btn\');\n      const rawDataDiv = document.getElementById(\'raw-data\');\n      const rawJson = document.getElementById(\'raw-json\');\n      rawJson.textContent = JSON.stringify(data, null, 2);\n\n      toggleRawBtn.onclick = () => {\n        if (rawDataDiv.style.display === \'none\') {\n          rawDataDiv.style.display = \'block\';\n          toggleRawBtn.textContent = \'🔼 Ocultar Dados Brutos\';\n          toggleRawBtn.style.background = \'#1f2937\';\n        } else {\n          rawDataDiv.style.display = \'none\';\n          toggleRawBtn.textContent = \'🔍 Ver Dados Brutos\';\n          toggleRawBtn.style.background = \'#374151\';\n        }\n      };\n\n      console.log(\'✅ [SurveyView] Render complete\');\n    });\n  </script>\n</div>',
      },
      createdAt: "2025-10-08T17:40:00.000Z",
      updatedAt: "2025-10-09T19:48:37.626Z",
    },
    {
      id: "step_1759945000000_ibge_indicators",
      title: "Fetch IBGE Indicators",
      description:
        "Fetches well-known IBGE indicators (population, area, density, education, economy) for the selected UF and returns a simplified array with name, value, and unit",
      status: "completed",
      toolCalls: ["IBGE_LIST_SURVEY_RESULTS"],
      inputSchema: {
        type: "object",
        properties: {
          ufId: {
            type: "number",
            description: "The federal unit ID to fetch indicators for",
          },
        },
        required: ["ufId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          indicators: {
            type: "array",
            description:
              "Simplified list of indicators with name, value, and unit",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Indicator name in Portuguese",
                },
                value: {
                  type: "string",
                  description: "Indicator value",
                },
                unit: {
                  type: "string",
                  description: "Unit of measurement",
                },
              },
              required: ["name", "value", "unit"],
            },
          },
          count: {
            type: "number",
            description: "Number of indicators fetched",
          },
          error: {
            type: "string",
            description: "Error message if any",
          },
        },
        required: ["indicators", "count"],
      },
      input: {
        ufId: "@step_1759944204619_vnoy7ipmv.output.uf.id",
      },
      output: {},
      error: "Failed to fetch",
      logs: [],
      duration: 34563,
      code: 'export default async function (input, ctx) {\n  try {\n    const WELL_KNOWN_INDICATORS = [\n      { id: "medium-monthly-wage", surveyId: "19", indicators: ["143558"], period: "2022", name: "Salário médio mensal", unit: "salários mínimos" },\n      { id: "enrollment-primary-education", surveyId: "13", indicators: ["77881"], period: "2022", name: "Matrículas - ensino infantil", unit: "matrículas" },\n      { id: "enrollment-secondary-education", surveyId: "13", indicators: ["5908"], period: "2022", name: "Matrículas - ensino fundamental", unit: "matrículas" },\n      { id: "enrollment-high-education", surveyId: "13", indicators: ["5913"], period: "2022", name: "Matrículas - ensino médio", unit: "matrículas" },\n      { id: "employed-salaried-personnel", surveyId: "19", indicators: ["143536"], period: "2022", name: "Pessoal ocupado assalariado", unit: "pessoas" },\n      { id: "population", surveyId: "10101", indicators: ["96385"], period: "2022", name: "População", unit: "habitantes" },\n      { id: "area", surveyId: "10101", indicators: ["96414"], period: "2022", name: "Área territorial", unit: "km²" },\n      { id: "density", surveyId: "10102", indicators: ["122231"], period: "2022", name: "Densidade demográfica", unit: "hab/km²" },\n      { id: "dwellings", surveyId: "10102", indicators: ["122281"], period: "2022", name: "Domicílios", unit: "domicílios" },\n      { id: "christians-population", surveyId: "10101", indicators: ["290028"], period: "2022", name: "Número de cristãos", unit: "pessoas" },\n      { id: "black-population-percentage", surveyId: "10101", indicators: ["290258"], period: "2022", name: "População negra (% do total)", unit: "%" },\n      { id: "white-population-percentage", surveyId: "10101", indicators: ["290257"], period: "2022", name: "População branca (% do total)", unit: "%" }\n    ];\n    \n    const ufId = input.ufId.toString();\n    const indicators = [];\n    \n    // Fetch each indicator\n    for (const indicator of WELL_KNOWN_INDICATORS) {\n      try {\n        const response = await ctx.env[\'i:84b039cf-8f52-49f3-b152-0edf86949c0f\'].IBGE_LIST_SURVEY_RESULTS({\n          surveyId: indicator.surveyId,\n          periods: [indicator.period],\n          indicatorId: indicator.indicators[0],\n          localitiesIds: [ufId],\n          scope: "base"\n        });\n        \n        // Extract value from response\n        if (response.results && response.results.length > 0) {\n          const result = response.results[0];\n          if (result.res && result.res.length > 0) {\n            const localityData = result.res[0];\n            const value = localityData.res && localityData.res[indicator.period];\n            \n            if (value !== null && value !== undefined) {\n              indicators.push({\n                name: indicator.name,\n                value: value.toString(),\n                unit: indicator.unit\n              });\n            }\n          }\n        }\n      } catch (error) {\n        console.error(`Error fetching indicator ${indicator.name}:`, error);\n        // Continue with next indicator even if one fails\n      }\n    }\n    \n    return {\n      indicators,\n      count: indicators.length\n    };\n  } catch (error) {\n    return {\n      indicators: [],\n      count: 0,\n      error: String(error)\n    };\n  }\n}',
      createdAt: "2025-10-08T17:30:00.000Z",
      updatedAt: "2025-10-09T19:05:26.392Z",
    },
    {
      id: "step_1759942500000_newstep3",
      title: "Get Most Voted Parties",
      description:
        "Query database to get the top 10 most voted parties in the specified UF (state) with total votes and number of candidates",
      status: "completed",
      toolCalls: ["DATABASES_RUN_SQL"],
      inputSchema: {
        type: "object",
        properties: {
          uf: {
            type: "string",
            description: "The UF (state) code to filter the voting data",
          },
        },
        required: ["uf"],
      },
      outputSchema: {
        type: "object",
        properties: {
          parties: {
            type: "array",
            description:
              "List of top 10 most voted parties with their statistics",
            items: {
              type: "object",
            },
          },
          count: {
            type: "number",
            description: "Number of parties returned",
          },
          error: {
            type: "string",
            description: "Error message if query fails",
          },
        },
        required: ["parties", "count"],
      },
      input: {
        uf: "@step_1759944204619_vnoy7ipmv.output.uf.acronym",
      },
      output: {},
      logs: [],
      duration: 2701,
      code: "export default async function (input, ctx) {\n  try {\n    const sql = `\n      SELECT \n        sg_partido,\n        nm_partido,\n        SUM(qt_votos_nominais_validos) as total_votos,\n        COUNT(DISTINCT sq_candidato) as num_candidatos\n      FROM votacao_candidato_munzona_2024_brasil\n      WHERE sg_uf = ?\n      GROUP BY sg_partido, nm_partido\n      ORDER BY total_votos DESC\n      LIMIT 10\n    `;\n    \n    const response = await ctx.env['i:workspace-management'].DATABASES_RUN_SQL({\n      sql: sql,\n      params: [input.uf]\n    });\n    \n    const results = response.result?.[0]?.results || [];\n    \n    return { \n      parties: results,\n      count: results.length\n    };\n  } catch (error) {\n    return { \n      parties: [],\n      count: 0,\n      error: String(error) \n    };\n  }\n}",
      createdAt: "2025-10-08T17:00:00.000Z",
      updatedAt: "2025-10-09T19:05:33.049Z",
    },
    {
      id: "step_1759947330226_vh11yeadj",
      title: "Generate Political Analysis for UF",
      description:
        "Uses AI to generate a comprehensive political analysis in markdown format based on the federal unit data, 2024 election results, 2026 voting intentions, and IBGE indicators",
      status: "completed",
      toolCalls: ["AI_GENERATE_OBJECT"],
      inputSchema: {
        type: "object",
        properties: {
          ufData: {
            type: "object",
            description: "Federal unit data from Match Federal Unit step",
            properties: {
              id: {
                type: "number",
                description: "Federal unit ID",
              },
              acronym: {
                type: "string",
                description: "Federal unit acronym",
              },
              name: {
                type: "string",
                description: "Federal unit name",
              },
            },
          },
          mostVotedParties: {
            type: "array",
            description: "List of most voted parties in 2024 elections",
            items: {
              type: "object",
            },
          },
          votingIntentions: {
            type: "object",
            description: "Voting intentions for 2026 elections from surveys",
            properties: {
              found: {
                type: "boolean",
              },
              details: {
                type: "object",
              },
            },
          },
          ibgeIndicators: {
            type: "array",
            description: "IBGE socioeconomic indicators",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                },
                value: {
                  type: "string",
                },
                unit: {
                  type: "string",
                },
              },
            },
          },
        },
        required: [
          "ufData",
          "mostVotedParties",
          "votingIntentions",
          "ibgeIndicators",
        ],
      },
      outputSchema: {
        type: "object",
        properties: {
          markdown: {
            type: "string",
            description: "Political analysis in markdown format",
          },
          ufAnalyzed: {
            type: "string",
            description: "Name of the federal unit analyzed",
          },
          ufAcronym: {
            type: "string",
            description: "Acronym of the federal unit analyzed",
          },
          success: {
            type: "boolean",
            description: "Whether the analysis was successfully generated",
          },
          error: {
            type: "string",
            description: "Error message if any",
          },
        },
        required: ["markdown", "ufAnalyzed", "ufAcronym", "success"],
      },
      input: {
        ufData: "@step_1759944204619_vnoy7ipmv.output.uf",
        mostVotedParties: "@step_1759942500000_newstep3.output.parties",
        votingIntentions: "@step_1759946000000_search_surveys",
        ibgeIndicators: "@step_1759945000000_ibge_indicators.output.indicators",
      },
      output: {
        markdown:
          '# Análise Política do Estado do Rio de Janeiro\n\n## 1. Panorama Político Atual: Eleições 2024\n\n### Hegemonia do PL e Fragmentação Partidária\n\nAs eleições municipais de 2024 no Rio de Janeiro revelaram um cenário de forte polarização e consolidação de forças políticas específicas:\n\n**Partido Liberal (PL)** emergiu como força dominante com **3.561.613 votos** (1.224 candidatos), representando a continuidade da influência bolsonarista no estado. Este desempenho expressivo indica a capacidade de mobilização da direita conservadora, especialmente em bases evangélicas e em regiões com maior preocupação com segurança pública.\n\n**PSD** aparece em segundo lugar com **2.884.414 votos** (890 candidatos), demonstrando eficiência eleitoral superior (média de 3.240 votos por candidato vs. 2.910 do PL). O partido se beneficia da liderança de Eduardo Paes na capital e representa uma centro-direita pragmática e menos ideológica.\n\n**Progressistas (PP)** com **1.937.213 votos** mantém presença significativa, tradicionalmente forte no interior e em bases municipalistas.\n\nA **fragmentação** é evidente: os 10 principais partidos lançaram **9.299 candidatos**, indicando alta competitividade e pulverização de recursos políticos. Partidos de esquerda como **PT (600.164 votos)** e **PSOL (522.371 votos)** mantêm presença, mas numericamente inferiores às forças de centro e direita.\n\n---\n\n## 2. Tendências para 2026: Cenário Governamental e Senatorial\n\n### Corrida ao Governo do Estado\n\n#### **Cenário 1 (sem Flávio Bolsonaro):**\n- **Eduardo Paes (PSD): 43,9%**\n- Rodrigo Bacellar (União): 12,4%\n- Washington Reis (MDB): 9,8%\n- Mônica Benício (PSOL): 6,6%\n\n#### **Cenário 2 (com Flávio Bolsonaro):**\n- **Eduardo Paes (PSD): 40%**\n- **Flávio Bolsonaro (PL): 32,8%**\n- Fabiano Horta (PT): 5,6%\n- Rodrigo Bacellar (União): 5,2%\n\n**Análise Estratégica:**\n\nEduardo Paes consolida-se como **favorito absoluto**, mantendo liderança confortável mesmo com a entrada de Flávio Bolsonaro. Sua **imagem positiva de 50%** (contra 48% negativa) e baixa rejeição relativa (26,7%) o posicionam como candidato competitivo tanto para eleitores de centro quanto para parcela significativa da esquerda.\n\nFlávio Bolsonaro, ao entrar na disputa, **polariza imediatamente** o cenário, capturando votos que estariam dispersos entre candidatos de direita. Sua **rejeição de 48%** é alta, mas sua base (32,8%) é sólida, concentrada em evangélicos (59,5% de intenção de voto neste segmento) e eleitores de Bolsonaro em 2022 (68,6%).\n\nA **esquerda fragmentada** (PT + PSOL somam apenas 9,2% no cenário 2) enfrenta dificuldade de unificação, com Fabiano Horta tendo baixo reconhecimento (65% não o conhecem).\n\n### Disputa pelo Senado\n\n**Cenário 1:**\n- Flávio Bolsonaro (PL): 22,6%\n- Benedita da Silva (PT): 17%\n- Alessandro Molon (PSB): 16,1%\n- Carlos Portinho (PL): 14,1%\n\n**Cenário 2 (com Cláudio Castro):**\n- Flávio Bolsonaro (PL): 23,1%\n- Benedita da Silva (PT): 17,2%\n- Alessandro Molon (PSB): 16,5%\n- Cláudio Castro (PL): 12,4%\n\nA **disputa senatorial é altamente competitiva** e fragmentada. Flávio Bolsonaro lidera, mas sem maioria absoluta. A presença de **dois candidatos do PL** (Flávio e Castro/Portinho) pode gerar canibalização de votos, beneficiando candidatos de oposição como Benedita da Silva e Alessandro Molon, que têm bases eleitorais distintas mas complementares na esquerda.\n\n---\n\n## 3. Contexto Socioeconômico e Comportamento Eleitoral\n\n### Perfil Demográfico\n\n- **População: 16.055.174 habitantes**\n- **Densidade demográfica: 366,97 hab/km²** (alta urbanização)\n- **Domicílios: 7.715.463**\n- **Composição racial:** 41,96% brancos, 16,76% negros (autodeclarados)\n\n### Indicadores Econômicos e Sociais\n\n- **Salário médio: 3,3 salários mínimos** (R$ 4.620,00 considerando SM de R$ 1.400)\n- **Pessoal ocupado assalariado: 4.119.501** (25,6% da população)\n- **Taxa implícita de desemprego/informalidade:** significativa, considerando população economicamente ativa\n\n### Educação\n- **Ensino infantil:** 621.508 matrículas\n- **Ensino fundamental:** 1.960.826 matrículas\n- **Ensino médio:** 596.206 matrículas\n\n### Impacto Eleitoral\n\n**Criminalidade como questão central:** **93,5% dos eleitores** identificam a criminalidade como maior problema do estado, superando amplamente outras questões. Este dado explica a força de candidatos com discurso de "lei e ordem" e a fragilidade do governador Cláudio Castro, cuja **aprovação é de apenas 29%** e avaliação de segurança pública é **péssima/ruim para 83%** dos entrevistados.\n\n**Corrupção (49,5%)** e **acesso à saúde (36,6%)** completam o trio de preocupações principais, seguidos por educação (24,5%).\n\n**Percepção econômica negativa:**\n- 78% avaliam a situação do RJ como **ruim**\n- 75% acreditam que o estado está no **mau caminho**\n- 47% esperam **piora** da situação nos próximos 6 meses\n\nEsta percepção negativa alimenta o **desejo de mudança:** **73,9% preferem candidato que faça gestão diferente** da atual, apenas 23,7% querem continuidade.\n\n---\n\n## 4. Principais Desafios Políticos\n\n### Desafio 1: Segurança Pública\nA **avaliação péssima/ruim de 83%** na segurança pública e a percepção de **piora por 67%** dos eleitores representa o **calcanhar de Aquiles** de qualquer governo estadual. A miliciarização, facções criminosas e violência urbana criam ambiente propício para candidatos com discurso punitivista.\n\n### Desafio 2: Polarização Nacional vs. Pragmatismo Local\nEnquanto **Lula tem 57% de desaprovação** no RJ (39% de aprovação), Eduardo Paes mantém competitividade. Isto sugere que eleitores fluminenses **dissociam política local da nacional**, priorizando gestão pragmática sobre alinhamento ideológico.\n\n### Desafio 3: Fragmentação da Esquerda\nPT, PSOL e PSB competem pelo mesmo eleitorado, dificultando vitórias. Benedita da Silva (39% de imagem positiva, 54% negativa) e Alessandro Molon (35% positiva, 42% negativa) têm potencial, mas precisam de **unificação estratégica**.\n\n### Desafio 4: Rejeições Elevadas\n- **Wilson Witzel: 94% de imagem negativa** (69,2% de rejeição)\n- **Romário: 77% de imagem negativa** (55,8% de rejeição)\n- **Marcelo Crivella: 77% negativa** (49,5% de rejeição)\n- **Cláudio Castro: 60% negativa** (52,7% de rejeição)\n\nPolíticos "queimados" limitam opções partidárias e favorecem renovação.\n\n### Desafio 5: Crise Fiscal e Infraestrutura\n**Responsabilidade fiscal avaliada como péssima/ruim por 65%** dos eleitores. Investimentos em infraestrutura, transporte público e saneamento (avaliado como péssimo por 49%) exigem recursos que o estado não possui, criando ciclo de insatisfação.\n\n---\n\n## 5. Conclusões e Perspectivas\n\n### Cenário Provável para 2026\n\n**Governo do Estado:**\nEduardo Paes é o **franco favorito**, com possibilidade de vitória em primeiro turno caso Flávio Bolsonaro não seja candidato. Em eventual segundo turno contra Flávio, Paes teria vantagem pela capacidade de **agregar centro e esquerda**, além de parcela de eleitores de direita não-bolsonaristas.\n\n**Senado:**\nDisputa **imprevisível e fragmentada**. Flávio Bolsonaro deve eleger-se em uma das vagas, mas a segunda vaga está em aberto entre Benedita da Silva, Alessandro Molon e eventual candidato do PL. Coligações e transferências de votos serão decisivas.\n\n**Presidência:**\nNo RJ, **Tarcísio de Freitas (33,5%)** compete tecnicamente com **Lula (35%)**, indicando que o estado será **campo de batalha** na disputa presidencial, diferentemente de 2022 quando Bolsonaro venceu confortavelmente.\n\n### Fatores Decisivos\n\n1. **Segurança Pública:** Candidato que apresentar proposta crível terá vantagem significativa\n2. **Economia Local:** Geração de empregos e controle de preços podem alterar percepções\n3. **Alianças Partidárias:** Fragmentação exige coligações estratégicas\n4. **Transferência de Votos Lula-Paes:** Capacidade de Paes manter apoio de eleitores petistas será crucial\n5. **Mobilização Evangélica:** Segmento representa aproximadamente 23,3% do eleitorado e tende ao bolsonarismo\n\n### Tendência Estrutural\n\nO Rio de Janeiro caminha para um **sistema bipartidário de fato** na disputa executiva (PL vs. PSD), com partidos menores funcionando como **satélites em coligações**. A esquerda tradicional (PT/PSOL) mantém relevância legislativa e em nichos urbanos específicos, mas enfrenta dificuldade de competir pelo executivo estadual sem renovação de lideranças e unificação estratégica.\n\nA **insatisfação generalizada** (75% veem RJ no mau caminho) cria ambiente **volátil**, onde candidatos outsiders ou com discurso anti-establishment podem surpreender, embora Eduardo Paes tenha conseguido se posicionar simultaneamente como **gestor experiente e alternativa de mudança**.\n\nO próximo ciclo eleitoral será definido pela capacidade dos candidatos em **endereçar concretamente a questão da segurança pública** e **restaurar confiança na gestão estadual**, temas que transcendem divisões ideológicas tradicionais e respondem às demandas mais urgentes da população fluminense.',
        ufAnalyzed: "Rio de Janeiro",
        ufAcronym: "RJ",
        success: true,
      },
      logs: [],
      duration: 70540,
      code: "export default async function (input, ctx) {\n  try {\n    // Build the analysis prompt\n    const ufName = input.ufData?.name || 'Estado não identificado';\n    const ufAcronym = input.ufData?.acronym || 'N/A';\n    \n    const partiesInfo = input.mostVotedParties && input.mostVotedParties.length > 0 \n      ? JSON.stringify(input.mostVotedParties, null, 2)\n      : 'Dados não disponíveis';\n    \n    const surveysInfo = input.votingIntentions?.details \n      ? JSON.stringify(input.votingIntentions.details, null, 2)\n      : 'Dados não disponíveis';\n    \n    const indicatorsInfo = input.ibgeIndicators && input.ibgeIndicators.length > 0\n      ? JSON.stringify(input.ibgeIndicators, null, 2)\n      : 'Dados não disponíveis';\n    \n    const prompt = `Você é um analista político especializado em política brasileira. Realize uma análise política completa e detalhada sobre o estado de ${ufName} (${ufAcronym}).\n\nDados disponíveis:\n\n## Partidos mais votados nas eleições de 2024:\n${partiesInfo}\n\n## Intenções de voto para as eleições de 2026:\n${surveysInfo}\n\n## Indicadores socioeconômicos do IBGE:\n${indicatorsInfo}\n\nCom base nesses dados, forneça uma análise política abrangente em formato markdown que inclua:\n\n1. **Panorama Político Atual**: Análise dos partidos mais votados em 2024 e o que isso representa\n2. **Tendências para 2026**: Interpretação das intenções de voto e possíveis mudanças no cenário político\n3. **Contexto Socioeconômico**: Como os indicadores do IBGE podem influenciar o comportamento eleitoral\n4. **Principais Desafios**: Questões políticas e sociais relevantes para o estado\n5. **Conclusões**: Síntese das perspectivas políticas para o estado\n\nA análise deve ser profissional, imparcial e bem estruturada em markdown.`;\n\n    const schema = {\n      type: 'object',\n      properties: {\n        analysis: {\n          type: 'string',\n          description: 'Political analysis in markdown format'\n        }\n      },\n      required: ['analysis']\n    };\n\n    const aiResponse = await ctx.env['i:workspace-management'].AI_GENERATE_OBJECT({\n      model: 'anthropic:claude-sonnet-4-5',\n      messages: [{ role: 'user', content: prompt }],\n      schema: schema,\n      temperature: 0.7,\n maxTokens: 40000\n    });\n\n    return {\n      markdown: aiResponse.object.analysis,\n      ufAnalyzed: ufName,\n      ufAcronym: ufAcronym,\n      success: true\n    };\n  } catch (error) {\n    return {\n      markdown: '# Erro na Análise\\n\\nNão foi possível gerar a análise política.',\n      ufAnalyzed: '',\n      ufAcronym: '',\n      success: false,\n      error: String(error)\n    };\n  }\n}",
      outputViews: {
        "Visualizador de Análise":
          "<div id=\"view-root\" style=\"padding: 24px; background: #0f1419; border-radius: 12px; color: #fff; font-family: system-ui; max-width: 1200px; margin: 0 auto;\">\n  <div id=\"header\" style=\"margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #1f2937;\">\n    <div style=\"display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;\">\n      <div>\n        <h1 id=\"title\" style=\"color: #00ff88; font-size: 28px; font-weight: bold; margin: 0 0 8px 0;\">Análise Política</h1>\n        <div style=\"display: flex; align-items: center; gap: 12px;\">\n          <span id=\"uf-badge\" style=\"display: inline-block; padding: 4px 12px; background: #a855f7; color: #fff; border-radius: 6px; font-weight: 600; font-size: 14px;\"></span>\n          <span id=\"status-badge\" style=\"display: inline-block; padding: 4px 12px; border-radius: 6px; font-weight: 600; font-size: 14px;\"></span>\n        </div>\n      </div>\n      <div style=\"display: flex; gap: 8px;\">\n        <button id=\"copy-btn\" style=\"padding: 10px 20px; background: #00ff88; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;\">\n          📋 Copiar Markdown\n        </button>\n        <button id=\"download-btn\" style=\"padding: 10px 20px; background: #22d3ee; color: #000; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; transition: all 0.2s;\">\n          💾 Baixar\n        </button>\n      </div>\n    </div>\n  </div>\n\n  <div id=\"error-container\" style=\"display: none; padding: 16px; background: #7f1d1d; border-left: 4px solid #f87171; border-radius: 8px; margin-bottom: 20px;\">\n    <p id=\"error-message\" style=\"color: #fca5a5; margin: 0; font-size: 14px;\"></p>\n  </div>\n\n  <div id=\"content-container\" style=\"background: #111827; border-radius: 12px; padding: 24px; box-shadow: 0 10px 40px rgba(0, 255, 136, 0.1);\">\n    <div id=\"markdown-content\" style=\"color: #d1d5db; font-size: 16px; line-height: 1.8;\"></div>\n  </div>\n\n  <script>\n    document.addEventListener('DOMContentLoaded', function() {\n      console.log('🎨 [PoliticalAnalysis] Starting render...');\n      \n      const data = window.viewData || {};\n      console.log('📊 [PoliticalAnalysis] Received data:', data);\n\n      // Validate data\n      if (!data || Object.keys(data).length === 0) {\n        console.error('❌ [PoliticalAnalysis] No data received!');\n        showError('Nenhum dado recebido');\n        return;\n      }\n\n      // Check for error in data\n      if (data.error) {\n        console.error('❌ [PoliticalAnalysis] Error in data:', data.error);\n        showError(data.error);\n        return;\n      }\n\n      // Check if analysis was successful\n      if (data.success === false) {\n        console.error('❌ [PoliticalAnalysis] Analysis failed');\n        showError('Falha ao gerar análise política');\n        return;\n      }\n\n      // Update header\n      const ufName = data.ufAnalyzed || 'N/A';\n      const ufAcronym = data.ufAcronym || '';\n      document.getElementById('title').textContent = `Análise Política - ${ufName}`;\n      document.getElementById('uf-badge').textContent = ufAcronym || ufName;\n\n      // Update status badge\n      const statusBadge = document.getElementById('status-badge');\n      if (data.success) {\n        statusBadge.textContent = '✓ Completa';\n        statusBadge.style.background = '#059669';\n      } else {\n        statusBadge.textContent = '⚠ Incompleta';\n        statusBadge.style.background = '#d97706';\n      }\n\n      // Render markdown content\n      const markdown = data.markdown || 'Nenhum conteúdo disponível';\n      renderMarkdown(markdown);\n\n      // Setup copy button\n      const copyBtn = document.getElementById('copy-btn');\n      copyBtn.addEventListener('click', function() {\n        navigator.clipboard.writeText(markdown).then(() => {\n          copyBtn.textContent = '✓ Copiado!';\n          copyBtn.style.background = '#059669';\n          setTimeout(() => {\n            copyBtn.textContent = '📋 Copiar Markdown';\n            copyBtn.style.background = '#00ff88';\n          }, 2000);\n        }).catch(err => {\n          console.error('❌ [PoliticalAnalysis] Copy failed:', err);\n          copyBtn.textContent = '✗ Erro';\n          copyBtn.style.background = '#dc2626';\n          setTimeout(() => {\n            copyBtn.textContent = '📋 Copiar Markdown';\n            copyBtn.style.background = '#00ff88';\n          }, 2000);\n        });\n      });\n\n      // Setup download button\n      const downloadBtn = document.getElementById('download-btn');\n      downloadBtn.addEventListener('click', function() {\n        const blob = new Blob([markdown], { type: 'text/markdown' });\n        const url = URL.createObjectURL(blob);\n        const a = document.createElement('a');\n        a.href = url;\n        a.download = `analise-politica-${ufAcronym || 'uf'}.md`;\n        a.click();\n        URL.revokeObjectURL(url);\n        \n        downloadBtn.textContent = '✓ Baixado!';\n        downloadBtn.style.background = '#059669';\n        setTimeout(() => {\n          downloadBtn.textContent = '💾 Baixar';\n          downloadBtn.style.background = '#22d3ee';\n        }, 2000);\n      });\n\n      console.log('✅ [PoliticalAnalysis] Render complete');\n    });\n\n    function showError(message) {\n      const errorContainer = document.getElementById('error-container');\n      const errorMessage = document.getElementById('error-message');\n      errorMessage.textContent = message;\n      errorContainer.style.display = 'block';\n      document.getElementById('content-container').style.display = 'none';\n    }\n\n    function renderMarkdown(markdown) {\n      const container = document.getElementById('markdown-content');\n      \n      // Simple markdown parser\n      let html = markdown\n        // Headers\n        .replace(/^### (.*$)/gim, '<h3 style=\"color: #22d3ee; font-size: 20px; font-weight: 600; margin: 24px 0 12px 0;\">$1</h3>')\n        .replace(/^## (.*$)/gim, '<h2 style=\"color: #a855f7; font-size: 24px; font-weight: 700; margin: 28px 0 16px 0;\">$1</h2>')\n        .replace(/^# (.*$)/gim, '<h1 style=\"color: #00ff88; font-size: 28px; font-weight: 800; margin: 32px 0 20px 0;\">$1</h1>')\n        // Bold\n        .replace(/\\*\\*(.*?)\\*\\*/gim, '<strong style=\"color: #00ff88; font-weight: 600;\">$1</strong>')\n        // Italic\n        .replace(/\\*(.*?)\\*/gim, '<em style=\"color: #22d3ee;\">$1</em>')\n        // Lists\n        .replace(/^\\- (.*$)/gim, '<li style=\"margin: 8px 0; padding-left: 8px; color: #d1d5db;\">$1</li>')\n        .replace(/^\\* (.*$)/gim, '<li style=\"margin: 8px 0; padding-left: 8px; color: #d1d5db;\">$1</li>')\n        // Line breaks\n        .replace(/\\n\\n/g, '</p><p style=\"margin: 16px 0; color: #d1d5db; line-height: 1.8;\">')\n        .replace(/\\n/g, '<br>');\n\n      // Wrap lists in ul\n      html = html.replace(/(<li.*?<\\/li>)/gim, '<ul style=\"list-style: disc; margin: 12px 0; padding-left: 24px;\">$1</ul>');\n      \n      // Wrap in paragraph if not already wrapped\n      if (!html.startsWith('<h') && !html.startsWith('<p') && !html.startsWith('<ul')) {\n        html = '<p style=\"margin: 16px 0; color: #d1d5db; line-height: 1.8;\">' + html + '</p>';\n      }\n\n      container.innerHTML = html;\n    }\n  </script>\n</div>",
      },
      createdAt: "2025-10-08T18:15:30.226Z",
      updatedAt: "2025-10-09T19:30:48.016Z",
    },
    {
      id: "step_1759947500000_save_prompt",
      title: "Save Political Analysis as Prompt",
      description:
        "Takes the markdown output from Generate Political Analysis for UF and saves it as a prompt using PROMPTS_CREATE with the analysis name + state",
      status: "completed",
      toolCalls: ["PROMPTS_CREATE"],
      inputSchema: {
        type: "object",
        properties: {
          markdown: {
            type: "string",
            description: "The markdown content from the political analysis",
          },
          ufName: {
            type: "string",
            description: "The full name of the federal unit",
          },
          ufAcronym: {
            type: "string",
            description: "The acronym of the federal unit (UF)",
          },
        },
        required: ["markdown", "ufName", "ufAcronym"],
      },
      outputSchema: {
        type: "object",
        properties: {
          success: {
            type: "boolean",
            description: "Whether the prompt was successfully saved",
          },
          promptName: {
            type: "string",
            description: "The name of the created prompt",
          },
          saved: {
            type: "boolean",
            description: "Whether the prompt was saved",
          },
          ufAnalyzed: {
            type: "string",
            description: "Name of the federal unit analyzed",
          },
          ufAcronym: {
            type: "string",
            description: "Acronym of the federal unit",
          },
          error: {
            type: "string",
            description: "Error message if any",
          },
        },
        required: ["success", "promptName", "saved", "ufAnalyzed", "ufAcronym"],
      },
      input: {
        markdown: "@step_1759947330226_vh11yeadj.output.markdown",
        ufName: "@step_1759947330226_vh11yeadj.output.ufAnalyzed",
        ufAcronym: "@step_1759947330226_vh11yeadj.output.ufAcronym",
      },
      output: {
        success: false,
        promptName: "",
        saved: false,
        ufAnalyzed: "",
        ufAcronym: "",
        error:
          'Promise rejection: Output validation failed: 0: instance is not allowed to have the additional property "project_id"\n\nError: Output validation failed: 0: instance is not allowed to have the additional property "project_id"\n\n    at main.js:215147:21',
      },
      logs: [],
      duration: 1463,
      code: "export default async function (input, ctx) {\n  try {\n    // Get the markdown and UF info from previous step\n    const markdown = input.markdown || '';\n    const ufName = input.ufName || 'Unknown';\n    const ufAcronym = input.ufAcronym || 'XX';\n    \n    // Create prompt name: \"Análise Política - [State Name] ([UF])\"\n    const promptName = `Análise Política - ${ufName} (${ufAcronym})`;\n    const promptDescription = `Análise política completa para o estado de ${ufName} (${ufAcronym})`;\n    \n    // Save the markdown as a prompt\n    const result = await ctx.env['i:workspace-management'].PROMPTS_CREATE({\n      name: promptName,\n      description: promptDescription,\n      content: markdown\n    });\n    \n    return {\n      success: true,\n      promptName: promptName,\n      saved: true,\n      ufAnalyzed: ufName,\n      ufAcronym: ufAcronym\n    };\n  } catch (error) {\n    return {\n      success: false,\n      promptName: '',\n      saved: false,\n      ufAnalyzed: '',\n      ufAcronym: '',\n      error: String(error)\n    };\n  }\n}",
      createdAt: "2025-10-09T18:46:31.180Z",
      updatedAt: "2025-10-09T19:40:12.101Z",
    },
  ],
  currentStepIndex: 5,
  createdAt: "2025-10-08T16:08:40.696Z",
  updatedAt: "2025-10-09T18:46:31.184Z",
};

export const WorkflowProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const searchParams = useSearch({ from: "/workflow" });
  console.log({ searchParams });
  const resourceURI = (searchParams as { resourceURI?: string })?.resourceURI;
  console.log({ resourceURI });
  // Fetch workflow from API if resourceURI is provided
  //   const {
  //     data: workflowData,
  //     isLoading: isLoadingWorkflow,
  //   } = useQuery({
  //     queryKey: ["workflow", resourceURI],
  //     queryFn: async () => {
  //       if (!resourceURI) return null;
  //       return await client.DECO_RESOURCE_WORKFLOW_READ({ uri: resourceURI });
  //     },
  //     enabled: !!resourceURI,
  //   });
  //   console.log({workflowData})

  //   if (!workflowData || isLoadingWorkflow || !resourceURI) {
  //     return (
  //       <div className="flex items-center justify-center h-screen text-muted-foreground">
  //         <div className="flex flex-col items-center gap-4">
  //           <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
  //           <p>Loading workflow...</p>
  //         </div>
  //       </div>
  //     );
  //   }
  // Transform steps to match expected schema (id -> name, code -> execute)
  // Memoize this to prevent recreating on every render
  type MockedStep = (typeof WORKFLOW.steps)[number];
  const transformedSteps = useMemo(
    () =>
      WORKFLOW.steps.map((step: MockedStep) => ({
        ...step,
        name: step.id, // Use id as name since that's the unique identifier
        execute:
          step.code ||
          "export default async function(input, ctx) { return input; }", // Use code as execute
      })),
    [],
  );

  type MockedWorkflow = typeof WORKFLOW;
  const defaultWorkflow = useMemo(
    () => ({
      ...WORKFLOW,
      steps: transformedSteps,
    }),
    [transformedSteps],
  ) as MockedWorkflow & { steps: typeof transformedSteps };

  console.log({ defaultWorkflow });

  return (
    <WorkflowStoreProvider
      workflow={
        {
          uri: resourceURI || "",
          data: defaultWorkflow,
        } as Workflow
      }
    >
      {children}
    </WorkflowStoreProvider>
  );
};

function useWorkflowStore<T>(selector: (state: Store) => T): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error("Missing WorkflowStoreProvider");
  }
  return useStore(store, selector);
}

export const useWorkflowStoreActions = () =>
  useWorkflowStore((state) => state.actions);

export const useCurrentWorkflow = () => {
  return useWorkflowStore((state) => state.workflow.data);
};

export const useCurrentStepIndex = () => {
  return useWorkflowStore((state) => state.currentStepIndex);
};
