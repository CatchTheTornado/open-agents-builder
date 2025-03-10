import { ApiEncryptionConfig } from '@/data/client/admin-api-client';
import { Agent, AgentStatus } from '@/data/client/models';
import { AgentDTO } from '@/data/dto';
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { DatabaseContext } from './db-context';
import { DeleteAgentResponse } from '@/data/client/agent-api-client';
import { SaaSContext } from './saas-context';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import { AuditContext } from './audit-context';
import { detailedDiff } from 'deep-object-diff';
import { TemplateApiClient } from '@/data/client/template-api-client';

interface TemplateContextType {
    templates: Agent[];
    updateTemplate: (agent: Agent) => Promise<Agent>;
    listTemplates: () => Promise<Agent[]>;
    setTemplates: (templates: Agent[]) => void;
    deleteTemplate: (agent: Agent) => Promise<DeleteAgentResponse>;
    templatePopupOpen: boolean;
    setTemplatePopupOpen: (value: boolean) => void;
    lastTemplateAdded: Agent|null;
    setLastTemplateAdded: (agent: Agent|null) => void;
    onboardingOpen: boolean;
    setOnboardingOpen: (value: boolean) => void;
    onboardingWellcomeHeader: boolean;
    setOnboardingWellcomeHeader: (value: boolean) => void;
}

export const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export const TemplateProvider = ({ children }: { children: ReactNode }) => {
    const [templates, setTemplates] = useState<Agent[]>([]);
    const [templatePopupOpen, setTemplatePopupOpen] = useState<boolean>(false);
    const [lastTemplateAdded, setLastTemplateAdded] = useState<Agent|null>(null);
    const [onboardingOpen, setOnboardingOpen] = useState<boolean>(false);
    const [onboardingWellcomeHeader, setOnboardingWellcomeHeader] = useState<boolean>(true);
    const auditContext = useContext(AuditContext);

    const { t, i18n } = useTranslation();

    const dbContext = useContext(DatabaseContext);
    const saasContext = useContext(SaaSContext);


    const setupApiClient = async () => {
        const encryptionConfig: ApiEncryptionConfig = {
            secretKey: dbContext?.masterKey,
            useEncryption: false // TODO: add a env variable config for this
        };
        const client = new TemplateApiClient('', dbContext, saasContext, encryptionConfig);
        return client;
    }        

    const updateTemplate = async (agent:Agent): Promise<Agent> => {

        const client = await setupApiClient();
        const agentDTO = agent.toDTO(); // DTOs are common ground between client and server
        const newRecord = typeof agent?.id  === 'undefined' || agent.id === 'new';

        const prevRecord = templates.find(r => r.id === agent.id);
        const changes = prevRecord ?  detailedDiff(prevRecord, agent) : {};
        
        if (newRecord) agentDTO.id = nanoid();
        const response = await client.put(agentDTO);

        if (response.status !== 200) {
            console.error('Error adding template:', response.message);
            toast.error(t('Error adding template') + ': ' + t(response.message));

            return agent;
        } else {
            const updatedAgent = Object.assign(agent, { id: response.data.id });
            setTemplates(
                newRecord ? [...templates, updatedAgent] :
                templates.map(pr => pr.id === agent.id ?  agent : pr)
            )
            setLastTemplateAdded(updatedAgent);
            return updatedAgent;
        }

    };

    const deleteTemplate = async (agent: Agent): Promise<DeleteAgentResponse> => {
        const client = await setupApiClient();
        const response = await client.delete(agent.toDTO());
        if (response.status !== 200) {
            console.error('Error deleting agent:', response.message);
            toast.error(t('Error deleting agent'));
        } else {
            setTemplates(templates.filter(pr => pr.id !== agent.id));
            toast.success(t('Template deleted'));
        }

        return response;
    }

    const listTemplates = async (): Promise<Agent[]> => {
        const client = await setupApiClient();
        try {
            const apiResponse = await client.get();
            const fetchedAgents = apiResponse.filter(tpl => tpl.status !== AgentStatus.Deleted && tpl.locale === i18n.language).map((folderDTO: AgentDTO) => Agent.fromDTO(folderDTO));
            setTemplates(fetchedAgents);
            return fetchedAgents;
        } catch(error) {
            throw (error)
        }; 


    }
    return (
        <TemplateContext.Provider value={{ 
            templates,
            listTemplates,
            deleteTemplate,
            updateTemplate,
            setTemplates,
            templatePopupOpen,
            setTemplatePopupOpen,
            lastTemplateAdded,
            setLastTemplateAdded,
            onboardingOpen,
            setOnboardingOpen,
            onboardingWellcomeHeader,
            setOnboardingWellcomeHeader
            }}>
            {children}
        </TemplateContext.Provider>
    );
};

export const useTemplateContext = (): TemplateContextType => {
    const context = useContext(TemplateContext);
    if (context === undefined) {
        throw new Error('useAgentContext must be used within an AgentProvider');
    }
    return context;
};