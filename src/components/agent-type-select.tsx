import * as React from "react";
import { useFormContext, useController } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { agentTypesRegistry } from "@/agent-types/registry";
import Markdown from "react-markdown";
import { InfoIcon } from "lucide-react";

export function AgentTypeSelect() {
  const { t, i18n } = useTranslation();

  // Access form methods from context (requires <FormProvider> in the parent).
  const { control } = useFormContext();
  const [agentDescription, setAgentDescription] = React.useState("");

  // Tie the `Select` to the "locale" field using React Hook Form's useController
  const {
    field: { onChange, onBlur, value, ref },
    fieldState: { error },
  } = useController({
    name: "agentType", 
    control,
    rules: { required: t("This field is required") },
    // Set default agent type to the first entry in the registry (if none was provided by the parent form).
    defaultValue: agentTypesRegistry[0]?.type ?? "",
  });

  // Keep the local description in sync with the selected type and language
  React.useEffect(() => {
    if (!value) return;
    const descriptor = agentTypesRegistry.find((at) => at.type === value);
    setAgentDescription(descriptor ? descriptor.description[i18n.language] ?? "" : "");
  }, [value, i18n.language]);

  return (
    <div>
      <select
        value={value}
        onChange={(e) => {
          onChange(e);
        }}
        onBlur={onBlur}
        ref={ref}
        id="locale"
        className="border border-input mt-1 block w-full rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
      >
        <option value="" disabled>
          {t("Select agent type")}
        </option>
        {agentTypesRegistry.map((at) => (
          <option key={at.type} value={at.type}>
        {at.displayName[i18n.language] ?? at.type}
          </option>
        ))}
      </select>
      <div className="text-xs p-2 flex">
        <div><InfoIcon className="w-4 h-4 mr-2" /></div>
        <Markdown>{agentDescription}</Markdown>
      </div>

      {error && (
        <p className="text-red-500 text-sm mt-1">{error.message}</p>
      )}
    </div>
  );
}
