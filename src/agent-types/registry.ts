export type AgentTypeDescriptor = {
    type: string;
    description: Record<string, string>;
    requiredTabs: string[];
    supportsUserFacingUI: boolean;
    displayName: Record<string, string>;
}
export const agentTypesRegistry : AgentTypeDescriptor[] = [
    {
        type: 'smart-assistant',
        description: {
            pl: "Inteligentni asystenci to **agenci ogólnego przeznaczenia**. Mogą korzystać z narzędzi, na przykład sprawdzając Twój kalendarz lub rezerwując nowe wydarzenia. Mogą być również używane do ankiet (mieszane z innymi zadaniami), ale muszą być dostosowane do tego na poziomie promptu.",
            en: "Smart assistants are **general-purpose agents**. They can use tools, for example, checking your calendar or booking new events. They can also be used for surveys (mixed with other tasks) but need to be fine-tuned for doing so at the prompt level."    
        },
        supportsUserFacingUI: true,
        requiredTabs: ['prompt', 'expectedResult'],
        displayName: {
            'pl': 'Inteligentny asystent [Chat]',
            'en': 'Smart assistant [Chat]'
        }
    },    
    {
        type: 'survey-agent',
        description: {
            pl: "Agenci ankietowi służą do zbierania informacji lub opinii od użytkowników. Na podstawie poprzednich odpowiedzi mogą **dynamicznie dostosowywać** kolejne pytania. Ci agenci zapisują odpowiedzi do dalszego przetwarzania w pożądanym formacie. Mogą zastąpić narzędzia takie jak **Formularze, Ankiety, Formularze zgłoszeniowe** itp.",
            en: "Survey agents are used to collect information or opinions from users. Based on previous answers, they can **dynamically adjust** the next questions. These agents save the answers for further processing in the desired format. They can replace tools like **Forms, Polls, Intake forms** etc."    
        },
        supportsUserFacingUI: true,
        requiredTabs: ['prompt', 'expectedResult'],
        displayName: {
            'pl': 'Agent przeprowadzający ankiety [Chat]',
            'en': 'Survey agent [Chat]'
        }
    },
    {
        type: 'commerce-agent',
        description: {
            pl: "Agenci handlowi służą do **sprzedaży produktów lub usług**. Mogą być używane w **e-commerce**, **rezerwacji usług**, **b2b/cpq**. Operują na **katalogu produktów** i mogą być używane do **sprzedaży dodatkowej** lub **sprzedaży krzyżowej** produktów.",
            en: "Commerce agents are used to **sell products or services**. They can be used in **e-commerce**, **service booking**, **b2b/cpq** scenarios. They operate on the **product catalog** and can be used to **upsell** or **cross-sell** products."            
        },
        supportsUserFacingUI: true,
        requiredTabs: ['prompt', 'expectedResult'],
        displayName: {
            'pl': 'Asystent sprzedaży [Chat]',
            'en': 'Sales assistant [Chat]'
        }
    },
    {
        type: 'flow',
        description: {
            pl: "Agenci oparte na przepływach pozwalają na tworzenie **złożonych scenariuszy**. Mogą być używane do **automatyzacji procesów** i rozwijania aplikacji, które są wywoływane przez API lub inne agenty, za pomocą **języka naturalnego**. Mogą być używane do **tworzenia drzew decyzyjnych** lub **integracji**.",
            en: "Flow-based agents let you create **complex scenarios**. They can be used to **automate processes** and develop apps that are called by API or other agents, using **natural language**. They can be used to **create decision trees** or **integrations**."    
        },
        supportsUserFacingUI: true,
        requiredTabs: [],
        displayName: {
            'pl': 'Aplikacja / Workflow [API]',
            'en': 'App / Workflow [API]'
        }
    }
];
