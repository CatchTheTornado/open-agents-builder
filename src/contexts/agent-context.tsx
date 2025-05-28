import { AdminApiClient, ApiEncryptionConfig } from '@/data/client/admin-api-client';
import { Agent, DataLoadingStatus, Session, Result, AgentStatus } from '@/data/client/models';
import { AgentDTO, PaginatedQuery, PaginatedResult } from '@/data/dto';
import React, { createContext, useState, useContext, ReactNode } from 'react';
import { DatabaseContext } from './db-context';
import { AgentApiClient, DeleteAgentResponse } from '@/data/client/agent-api-client';
import { SaaSContext } from './saas-context';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { nanoid } from 'nanoid';
import { AuditContext } from './audit-context';
import { DeleteResultResponse, ResultApiClient } from '@/data/client/result-api-client';
import { DeleteSessionResponse, SessionApiClient } from '@/data/client/session-api-client';
import { useProductContext } from './product-context';
import { useAttachmentContext } from './attachment-context';
import { agent } from 'flows-ai';
import { agentTypesRegistry } from '@/agent-types/registry';

export type AgentStatusType = {
    id: string;
    message: string;
    type: string;
}

interface AgentContextType {
    current: Agent | null;
    dirtyAgent?: Agent | null;
    setDirtyAgent: (agent: Agent | null) => void;
    agents: Agent[];
    results: PaginatedResult<Result[]>;
    agentResults: (agentId: string, { limit, offset, orderBy,  query} :  PaginatedQuery) => Promise<PaginatedResult<Result[]>>;
    singleResult: (resultId: string) => Promise<Result>
    deleteResult: (result: Result) => Promise<DeleteResultResponse>
    singleSession: (sessionid: string) => Promise<Session>
    deleteSession: (session: Session) => Promise<DeleteSessionResponse>
    sessions: PaginatedResult<Session[]>;
    agentSessions: (agentId: string, { limit, offset, orderBy,  query} :  PaginatedQuery) => Promise<PaginatedResult<Session[]>>;
    updateAgent: (agent: Agent, setAsCurrent: boolean) => Promise<Agent>;
    newAgent: () => Agent;
    newFromTemplate: (template: Agent) => Promise<Agent>;
    listAgents: (currentAgentId?:string) => Promise<Agent[]>;
    setCurrent: (agent: Agent | null) => void;
    setAgents: (agents: Agent[]) => void;
    loaderStatus: DataLoadingStatus;
    status: AgentStatusType | null
    setStatus: (status: AgentStatusType | null) => void;
    removeStatus (id: string): void;
    deleteAgent: (agent: Agent) => Promise<DeleteAgentResponse>;
    agentDeleteDialogOpen: boolean;
    setAgentDeleteDialogOpen: (value: boolean) => void;
    exportAgent: (agent: Agent) => void;
    importAgent: (fileContent: string) => Promise<Agent>;
    exportSingleResult: (result: Result) => void;
    exportResults: (agent: Agent) => void;
    agentSidebarOpen: boolean;
    setAgentSidebarOpen: (value: boolean) => void;

}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export const AgentProvider = ({ children }: { children: ReactNode }) => {
    const [current, setCurrent] = useState<Agent | null>(null);
    const [dirtyAgent, setDirtyAgent] = useState<Agent | null>(null)
    const [agents, setAgents] = useState<Agent[]>([]);
    const [results, setResults] = useState<PaginatedResult<Result[]>>({ rows: [], total: 0, limit: 0, offset: 0, orderBy: '', query: '' });
    const [sessions, setSessions] = useState<PaginatedResult<Session[]>>({ rows: [], total: 0, limit: 0, offset: 0, orderBy: '', query: '' });
    const [loaderStatus, setLoaderStatus] = useState<DataLoadingStatus>(DataLoadingStatus.Idle);
    const [agentDeleteDialogOpen, setAgentDeleteDialogOpen] = useState<boolean>(false);
    const [agentSidebarOpen, setAgentSidebarOpen] = useState<boolean>(true);

    const auditContext = useContext(AuditContext);
    const productContext = useProductContext();
    const attContext = useAttachmentContext();

    const { t, i18n } = useTranslation();

    const dbContext = useContext(DatabaseContext);
    const saasContext = useContext(SaaSContext);


    const [status, setStatus] = useState<AgentStatusType | null>(null);

    const setupApiClient = async () => {
        const encryptionConfig: ApiEncryptionConfig = {
            secretKey: dbContext?.masterKey,
            useEncryption: false // TODO: add a env variable config for this
        };
        const client = new AgentApiClient('', dbContext, saasContext, encryptionConfig);
        return client;
    }        

    const updateAgent = async (agent:Agent, setAsCurrent: boolean = true): Promise<Agent> => {

        const client = await setupApiClient();
        const agentDTO = agent.toDTO(); // DTOs are common ground between client and server
        const newRecord = typeof agent?.id  === 'undefined' || agent.id === 'new';
        
        if (newRecord) agentDTO.id = nanoid();
        const response = await client.put(agentDTO);

        if (response.status !== 200) {
            console.error('Error adding agent:', response.message);
            toast.error(t('Error adding agent') + ':' + t(response.message));

            return agent;
        } else {
          
            
            const updatedAgent = Object.assign(agent, { id: response.data.id });
            setAgents(
                newRecord ? [...agents, updatedAgent] :
                agents.map(pr => pr.id === agent.id ?  agent : pr)
            )
            if (setAsCurrent) setCurrent(updatedAgent);
            return updatedAgent;
        }

    };

    const newFromTemplate = async (template: Agent): Promise<Agent> => {
        const newAgent = new Agent(
            {
                id: 'new',
                displayName: t('New from template: ') + template.displayName,
                prompt: template.prompt,
                agentType: template.agentType,
                tools: template.tools,
                events: template.events,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                options: template.options,
                agents: template.agents,
                flows: template.flows,
                status: AgentStatus.Active,
                locale: i18n.language,
                expectedResult: template.expectedResult,
                safetyRules: template.safetyRules,
                evals: template.evals
            } as Agent
        )

        try {
            const updatedAgent = await updateAgent(newAgent, true);

            if (template.extra) {
                const templateMeta = template.extra as Record<string, string>;

                if(templateMeta['importProductsFromUrl']) {
                    try {
                        const apiClient = new AdminApiClient('', dbContext, saasContext)
                        toast.info('Downloading examples ...');
                  
                        const examplesArrayBuffer = await apiClient.getArrayBuffer(templateMeta['importProductsFromUrl']);
                        await productContext.importProducts(examplesArrayBuffer as ArrayBuffer);
                        toast.success(t('Example products imported successfully'));
                      } catch (error) {
                        toast.error(t('Error while downloading examples'));
                      }
                  
                }
                if(templateMeta['importAttachmentsFromUrl']) {
                    try {
                        const apiClient = new AdminApiClient('', dbContext, saasContext)
                        toast.info('Downloading examples ...');
                  
                        const examplesArrayBuffer = await apiClient.getArrayBuffer(templateMeta['importAttachmentsFromUrl']);
                        await attContext.importAttachments(examplesArrayBuffer as ArrayBuffer);
                        toast.success(t('Example attachments imported successfully'));
                      } catch (error) {
                        toast.error(t('Error while downloading examples'));
                      }
                  
                }                
            }
            return updatedAgent;
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    const newAgent = (): Agent => {
        return new Agent(
            {
                id: 'new',
                displayName: t('Add new agent ...'),
                agentType: agentTypesRegistry[0]?.type ?? "smart-assistant",
                prompt: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                options: null,
                expectedResult: '',
                safetyRules: null
            }
        )
    }

    const deleteAgent = async (agent: Agent): Promise<DeleteAgentResponse> => {
        const client = await setupApiClient();
        const response = await client.delete(agent.toDTO());
        if (response.status !== 200) {
            console.error('Error deleting agent:', response.message);
            toast.error(t('Error deleting agent'));
        } else {
            setAgents(agents.filter(pr => pr.id !== agent.id));
            toast.success(t('Agent deleted'));
        }

        return response;
    }

    const deleteSession = async (session: Session): Promise<DeleteSessionResponse> => {
        const client = new SessionApiClient('', dbContext, saasContext);
        
        const resp = await client.delete(session.toDTO());

        if (resp.status === 200)  {
            setSessions({ ...sessions, rows: sessions.rows.filter(pr => pr.id !== session.id)});
        }

        return resp;

    }
    const deleteResult = async (result: Result): Promise<DeleteResultResponse> => {
        const client = new ResultApiClient('', dbContext, saasContext);
        const resp = await client.delete(result.toDTO());

        if (resp.status === 200)  {
            setResults({ ...results, rows: results.rows.filter(pr => pr.sessionId !== result.sessionId)});
        }

        return resp;
    }

    const singleResult = async (sessionId: string): Promise<Result> => {
        const client = new ResultApiClient('', dbContext, saasContext);
        const results = await client.get(sessionId)
        if (results.length > 0) {
            return Result.fromDTO(results[0]);
        } else {
            throw new Error(t('No results found for specified session'));
        }

    }

    const singleSession = async (sessionId: string): Promise<Session> => {
        const client = new SessionApiClient('', dbContext, saasContext);
        const results = await client.get(sessionId)
        if (results.length > 0) {
            return Session.fromDTO(results[0]);
        } else {
            throw new Error(t('No sessions found for specified session'));
        }
    }

    const agentResults = async (agentId: string, { limit, offset, orderBy,  query} :  PaginatedQuery): Promise<PaginatedResult<Result[]>> => {
        const client = await setupApiClient();
        const response = await client.results(agentId, { limit, offset, orderBy, query });
        setResults({
            ...response,
            rows: response.rows.map((r: any) => Result.fromDTO(r))
        });

        return results;
    }
    const agentSessions = async (agentId: string, { limit, offset, orderBy,  query} :  PaginatedQuery): Promise<PaginatedResult<Session[]>> => {
        const client = await setupApiClient();
        const response = await client.sessions(agentId, { limit, offset, orderBy,  query});
        setSessions({
            ...response,
            rows: response.rows.map((r: any) => Session.fromDTO(r))
        });
        
        return sessions
    }    

    const listAgents = async (currentAgentId?:string): Promise<Agent[]> => {
        setStatus(null);
        const client = await setupApiClient();
        setLoaderStatus(DataLoadingStatus.Loading);
        try {
            const apiResponse = await client.get();
            const fetchedAgents = apiResponse.map((folderDTO: AgentDTO) => Agent.fromDTO(folderDTO));
            setAgents(fetchedAgents);
            setLoaderStatus(DataLoadingStatus.Success);
            fetchedAgents.push(newAgent());

            let defaultAgent:Agent|null = fetchedAgents.length > 0 ? fetchedAgents[fetchedAgents.length-1] : null;
            if (!current) {
                if (typeof localStorage !== 'undefined') {
                    const agentId = localStorage.getItem('currentAgentId');
                    if (agentId) {
                        defaultAgent = fetchedAgents.find((f) => f.id === agentId) || null;
                    }
                }
            }
            if (currentAgentId) { // force to switch to this agent
                defaultAgent = fetchedAgents.find((f) => f.id === currentAgentId) || null;
            }
            setCurrent(defaultAgent) // we should store the current folder id and set to the current one
            return fetchedAgents;
        } catch(error) {
            setLoaderStatus(DataLoadingStatus.Error);
            throw (error)
        }; 


    }

    const removeStatus = (id: string) => {  
        if (status?.id === id) {
            setStatus(null);
        }
    }

    const exportAgent = (agent: Agent) => {
        const a = document.createElement('a');
        const file = new Blob([JSON.stringify(agent)], {type: 'application/json'});
        a.href= URL.createObjectURL(file);
        a.download = agent.displayName + '.json';
        a.click();
    }

    const exportSingleResult = (result: Result) => {
        const resultFormat = result.format?.toLowerCase();
        
        const mimeType = resultFormat === 'markdown' ? 'text/markdown' : 'application/json';
        const extension = resultFormat === 'json' ? '.json' : '.md'; 
        
        const a = document.createElement('a');
        const file = new Blob([result.content ?? ''], {type: mimeType});
        a.href= URL.createObjectURL(file);
        a.download = `result-${result.sessionId}${extension}`;
        a.click();
    }

    const exportResults = async (agent: Agent) => {        
        if (agent.id && agent.id !== 'new') {
            const apiClient = new ResultApiClient('', dbContext, saasContext);
            const a = document.createElement('a');
            const file = new Blob([await apiClient.export(agent.id) ?? ''], {type: 'application/zip'});
            a.href= URL.createObjectURL(file);
            a.download = `${agent.id}-results.zip`;
            a.click();
        }
    }    


    const importAgent = async (fileContent: string): Promise<Agent> => {
        try {
            const agentDTO = JSON.parse(fileContent) as AgentDTO;
            const agent = Agent.fromDTO(agentDTO);
            delete agent.id;
            return updateAgent(agent, true);
        } catch (e) {
            throw new Error('Invalid file format');
        }
    }


    return (
        <AgentContext.Provider value={{ 
                current,
                dirtyAgent,
                setDirtyAgent, 
                agents, 
                setCurrent, 
                setAgents,
                updateAgent,
                listAgents,
                newAgent,
                loaderStatus,
                status,
                setStatus,
                removeStatus,
                results,
                agentResults,
                singleResult,
                sessions,
                agentSessions,
                singleSession,
                deleteAgent,
                agentDeleteDialogOpen,
                setAgentDeleteDialogOpen,
                newFromTemplate,
                exportAgent,
                importAgent,
                exportSingleResult,
                exportResults,
                deleteResult,
                deleteSession,
                agentSidebarOpen,
                setAgentSidebarOpen
            }}>
            {children}
        </AgentContext.Provider>
    );
};

export const useAgentContext = (): AgentContextType => {
    const context = useContext(AgentContext);
    if (context === undefined) {
        throw new Error('useAgentContext must be used within an AgentProvider');
    }
    return context;
};