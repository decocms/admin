import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState, useEffect } from "react";
import { useAgentSettingsForm } from "../agent/edit.tsx";

// Framework definitions with their fields and reference URLs
const FRAMEWORKS = {
  Freestyle: {
    name: "Freestyle",
    description: "No structured framework, just a freeform prompt.",
    fields: {},
    referenceUrl: null,
  },
  RTF: {
    name: "RTF Framework",
    description: "Role / Task / Format framework.",
    fields: {
      role: {
        label: "Role",
        description: "Who should the AI act as? (e.g., 'a helpful tutor')",
      },
      task: {
        label: "Task", 
        description: "What should the AI do? (the objective or task, e.g., 'explain quantum physics')",
      },
      format: {
        label: "Format",
        description: "How should the AI respond? (e.g., 'in bullet points' or 'as a story')",
      },
    },
    referenceUrl: "https://thepromptwarrior.com/rtf-framework/",
  },
  CLEAR: {
    name: "CLEAR Framework",
    description: "Context / Length / Explicitness / Audience / Role.",
    fields: {
      context: {
        label: "Context",
        description: "What's the background or scenario? (Provide any necessary context or situation)",
      },
      length: {
        label: "Length",
        description: "How long should the response be? (e.g., 'one paragraph' or '500 words')",
      },
      explicitness: {
        label: "Explicitness", 
        description: "What specific details must be covered? (Any specific content or requirements)",
      },
      audience: {
        label: "Audience",
        description: "Who is the output for? (Describe the target reader or audience)",
      },
      role: {
        label: "Role",
        description: "What persona should the AI assume? (Specify a perspective or character)",
      },
    },
    referenceUrl: "https://guides.library.georgetown.edu/c.php?g=1306346&p=9616780",
  },
  CREATE: {
    name: "CREATE Framework", 
    description: "Context / Role / Expectation / Audience / Tone / Examples.",
    fields: {
      context: {
        label: "Context",
        description: "Provide any necessary background. (The situation or content context)",
      },
      role: {
        label: "Role",
        description: "Who is the AI? (Define the assistant's persona or role)",
      },
      expectation: {
        label: "Expectation",
        description: "What should the AI accomplish? (Clarify the goal or expected output)",
      },
      audience: {
        label: "Audience", 
        description: "Who is this written for? (Define the target audience)",
      },
      tone: {
        label: "Tone",
        description: "What voice or mood should the response have? (e.g., formal, casual, humorous)",
      },
      examples: {
        label: "Examples",
        description: "Include a sample or template if needed. (Example input-output or template)",
      },
    },
    referenceUrl: "https://medium.com/@promptengineering/chatgpt-power-prompts-c-r-e-a-t-e-framework-95f8cf6e8a8c",
  },
  SMART: {
    name: "SMART Framework",
    description: "Specific / Measurable / Achievable / Relevant / Time-bound.",
    fields: {
      specific: {
        label: "Specific",
        description: "What is the exact task? (Clearly define what you want, leaving no ambiguity)",
      },
      measurable: {
        label: "Measurable", 
        description: "What defines success? (How will you know it did a good job?)",
      },
      achievable: {
        label: "Achievable",
        description: "Is the task realistic for the AI? (Specify constraints or clarify scope)",
      },
      relevant: {
        label: "Relevant",
        description: "Why is it important? (Tie the request to the context or goal)",
      },
      timeBound: {
        label: "Time-bound",
        description: "Is there a deadline or timeframe? (If relevant, mention time constraints)",
      },
    },
    referenceUrl: "https://www.smartsheet.com/content/smart-goals",
  },
  CoT: {
    name: "Chain of Thought",
    description: "Prompt Instruction / Reasoning Steps.",
    fields: {
      promptInstruction: {
        label: "Prompt Instruction", 
        description: "The task or question – essentially the main user query or instruction",
      },
      reasoningSteps: {
        label: "Reasoning Steps",
        description: "Ask the model to reason step-by-step. (e.g., 'Let's solve this step by step')",
      },
    },
    referenceUrl: "https://www.promptingguide.ai/techniques/cot",
  },
  Google: {
    name: "Google Gemini Prompt Guide",
    description: "Role / Instruction / Context / Output Constraints.",
    fields: {
      role: {
        label: "Role",
        description: "Define the AI's role. (e.g., 'You are a travel agent AI...')",
      },
      instruction: {
        label: "Instruction",
        description: "Give specific task instructions. (The actual command or question)",
      },
      context: {
        label: "Context", 
        description: "Include relevant background. (Any extra info the AI should know)",
      },
      outputConstraints: {
        label: "Output Constraints",
        description: "Specify format/length/tone if any. (e.g., 'Answer in JSON' or 'Use a professional tone')",
      },
    },
    referenceUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/prompt-design-strategies",
  },
} as const;

type FrameworkKey = keyof typeof FRAMEWORKS;

interface FrameworkData {
  [key: string]: {
    [field: string]: string;
  };
}

function PromptTab() {
  const { form, handleSubmit } = useAgentSettingsForm();
  
  // State for framework selection and field data
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey>("Freestyle");
  const [promptData, setPromptData] = useState<FrameworkData>({
    Freestyle: { content: "" },
    RTF: { role: "", task: "", format: "" },
    CLEAR: { context: "", length: "", explicitness: "", audience: "", role: "" },
    CREATE: { context: "", role: "", expectation: "", audience: "", tone: "", examples: "" },
    SMART: { specific: "", measurable: "", achievable: "", relevant: "", timeBound: "" },
    CoT: { promptInstruction: "", reasoningSteps: "" },
    Google: { role: "", instruction: "", context: "", outputConstraints: "" },
  });

  // Initialize freestyle content from form value
  useEffect(() => {
    const currentInstructions = form.getValues("instructions") || "";
    setPromptData(prev => ({
      ...prev,
      Freestyle: { content: currentInstructions }
    }));
  }, [form.getValues("instructions")]);

  // Update form when framework data changes
  useEffect(() => {
    let finalPrompt = "";
    
    if (selectedFramework === "Freestyle") {
      finalPrompt = promptData.Freestyle?.content || "";
    } else {
      const frameworkFields = FRAMEWORKS[selectedFramework].fields;
      const fieldValues = Object.keys(frameworkFields)
        .map(key => promptData[selectedFramework]?.[key] || "")
        .filter(value => value.trim() !== "")
        .join("\n");
      finalPrompt = fieldValues;
    }
    
    form.setValue("instructions", finalPrompt, { shouldDirty: true });
  }, [promptData, selectedFramework, form]);

  const handleFrameworkChange = (newFramework: FrameworkKey) => {
    setSelectedFramework(newFramework);
  };

  const handleFieldChange = (field: string, value: string) => {
    setPromptData(prev => ({
      ...prev,
      [selectedFramework]: {
        ...prev[selectedFramework],
        [field]: value,
      },
    }));
  };

  const handleFreestyleChange = (value: string) => {
    setPromptData(prev => ({
      ...prev,
      Freestyle: { content: value },
    }));
  };

  const renderFrameworkHeader = (framework: FrameworkKey) => {
    const config = FRAMEWORKS[framework];
    if (framework === "Freestyle" || !config.referenceUrl) return null;
    
    return (
      <div className="flex items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
        <a 
          href={config.referenceUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="ml-2 text-blue-600 hover:text-blue-800 transition-colors"
          aria-label="Open framework reference"
        >
          <Icon name="open_in_new" size={16} />
        </a>
      </div>
    );
  };

  const renderFrameworkFields = (framework: FrameworkKey) => {
    if (framework === "Freestyle") {
      return (
        <FormField
          name="instructions"
          render={() => (
            <FormItem>
              <FormControl>
                <Textarea
                  placeholder="Add context or behavior to shape responses (e.g., 'Be concise and reply in English.')"
                  className="min-h-[170px] h-full border-border"
                  value={promptData.Freestyle?.content || ""}
                  onChange={(e) => handleFreestyleChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }

    const config = FRAMEWORKS[framework];
    const fields = Object.entries(config.fields);
    
    return (
      <div className="space-y-4">
        {renderFrameworkHeader(framework)}
        <div className="grid grid-cols-1 gap-4">
          {fields.map(([fieldKey, fieldConfig]) => (
            <div key={fieldKey} className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {fieldConfig.label}
              </Label>
              <p className="text-sm text-gray-500">
                {fieldConfig.description}
              </p>
              <Textarea
                value={promptData[framework]?.[fieldKey] || ""}
                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                className="min-h-[80px] w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                rows={3}
                placeholder={`Enter ${fieldConfig.label.toLowerCase()}...`}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 pt-2 mx-auto max-w-4xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Framework Selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                Prompt Framework
              </Label>
              <Select value={selectedFramework} onValueChange={handleFrameworkChange}>
                <SelectTrigger className="w-full max-w-xs px-6 py-4 h-auto min-h-[60px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FRAMEWORKS).map(([key, framework]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex flex-col items-start py-2">
                        <span className="font-medium">{framework.name}</span>
                        <span className="text-xs text-gray-500">{framework.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Framework Content */}
            <div className="border rounded-lg p-4 bg-gray-50/50">
              {renderFrameworkFields(selectedFramework)}
            </div>
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default PromptTab;
