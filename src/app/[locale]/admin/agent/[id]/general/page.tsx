'use client'
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useAgentContext } from '@/contexts/agent-context';
import { use, useContext, useEffect, useState } from 'react';
import { FormProvider, useForm, UseFormGetValues, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { Agent } from '@/data/client/models';
import { toast } from 'sonner';
import { useParams, useRouter } from 'next/navigation';
import { sha256 } from '@/lib/crypto';
import { TFunction } from 'i18next';
import { AgentStatus } from '@/components/layout/agent-status';
import { MarkdownEditor } from '@/components/markdown-editor';
import React from 'react';
import { MDXEditorMethods } from '@mdxeditor/editor';
import { LocaleSelect } from '@/components/locale-select';
import { AgentTypeSelect } from '@/components/agent-type-select';
import { SaveAgentAsTemplateButton } from '@/components/save-agent-as-template-button';
import DataLoader from '@/components/data-loader';
import { InfoIcon, TrashIcon } from 'lucide-react';
import { AgentTypeDescriptor, agentTypesRegistry } from '@/agent-types/registry';
import { AttachmentUploader } from '@/components/attachment-uploader';
import { DatabaseContext } from '@/contexts/db-context';
import { SaaSContext } from '@/contexts/saas-context';
import ZoomableImage from '@/components/zoomable-image';

export function onAgentSubmit(agent: Agent | null, watch: UseFormWatch<Record<string, any>>, setValue: UseFormSetValue<Record<string, any>>, getValues: UseFormGetValues<Record<string, any>>, updateAgent: (agent: Agent, setAsCurrent: boolean) => Promise<Agent>, t: TFunction<"translation", undefined>, router: any, editors: Record<string, React.RefObject<MDXEditorMethods>>) {
  // eslint-disable-next-line
  const [isDirty, setIsDirty] = useState(false);
  // eslint-disable-next-line
  const params = useParams();
  // eslint-disable-next-line
  const agentContext = useAgentContext();
  // keep the watch subscription to be able to unsubscribe when the record is saved
  const watchSubscription = React.useRef<{ unsubscribe: () => void } | null>(null);

  // eslint-disable-next-line
  useEffect(() => {
    if (agentContext.agents && agentContext.agents.length > 0 && !agent && params.id) { // agent does not exist, but id is provided
      router.push(`/admin/agent/new/general`);
    }
  }, [agentContext.agents]);

  // eslint-disable-next-line
  useEffect(() => {
    if (agent && agent.id === params.id) { // bind the tracking changes only for the currently selected agent
      //agent.toForm(setValue); // load the database values
      const dirtyCheck = (async (originalRecord: Record<string, any>, value: Record<string, any>) => {
        const compareForms = async (editableForm: Record<string, any>, savedForm: Record<string, any>) => {
          const sortedSavedState: Record<string, any> = {}
          const sortedEditableState = Object.keys(editableForm).sort().reduce((acc: Record<string, any>, key: string) => {
            acc[key] = editableForm[key];
            sortedSavedState[key] = savedForm[key];
            return acc;
          }, {});

          const editableEntriesString = Object.entries(sortedEditableState).map(([key, value]) => `${key}:${JSON.stringify(value)}`).join(',');
          const savedEntriesString = Object.entries(sortedSavedState).map(([key, value]) => `${key}:${JSON.stringify(value)}`).join(',');
          const [editableEntriesHash, savedEntriesHash] = await Promise.all([
            sha256(editableEntriesString, ''),
            sha256(savedEntriesString, '')
          ]);

          return editableEntriesHash === savedEntriesHash;
        };

        const formChanged = !await compareForms(getValues(), originalRecord);
        if (formChanged) {
          sessionStorage.setItem(`agent-${value['id']}`, JSON.stringify(getValues())); // save form values
        } else {
          sessionStorage.removeItem(`agent-${value['id']}`);
        }
        setIsDirty(formChanged);
      })

      const subscribeChanges = (originalRecord: Record<string, any>) => {
        // if there is already an active watcher – remove it before creating a new one
        if (watchSubscription.current) {
          watchSubscription.current.unsubscribe();
        }

        agentContext.setDirtyAgent(Agent.fromForm(getValues(), agentContext.current));
        dirtyCheck(originalRecord, getValues());

        const subscription = watch((value) => {
          agentContext.setDirtyAgent(Agent.fromForm(getValues(), agentContext.current));
          dirtyCheck(originalRecord, value);
        });

        // store the subscription so we can clean it up later (eg. on save)
        watchSubscription.current = subscription;

        return subscription;
      };

      const savedState = sessionStorage.getItem(`agent-${agent.id}`);
      if (savedState) { // the form is dirty - load state from session storage
        const parsedState = JSON.parse(savedState);
        Object.keys(parsedState).forEach((key) => {
          setValue(key, parsedState[key]);
          if (editors && editors.hasOwnProperty(key) && editors[key].current) {
            editors[key].current?.setMarkdown(parsedState[key]);
          }
        });
      } else {
        agent.toForm((field, value) => {
          if (editors && editors.hasOwnProperty(field) && editors[field].current) {
            editors[field].current?.setMarkdown(value);
          }
          setValue(field, value);
        })
      }
      subscribeChanges(agent.toForm(null));

    }
  }, [agent]);

  const onSubmit = async (data: Record<string, any>) => {

    const newAgent = agent?.id === 'new';
    const updatedAgent = Agent.fromForm(data, agent);

    const agentTypeDescriptor = agentTypesRegistry.find(at => at.type === updatedAgent.agentType);
    if (agentTypeDescriptor) {
      for (const requiredField of agentTypeDescriptor.requiredTabs) {
        const valToCheck = updatedAgent.toForm()[requiredField];
        if (!valToCheck || (Array.isArray(valToCheck) && valToCheck.length === 0)) {
          router.push(`/admin/agent/${updatedAgent.id}/${requiredField.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}`);
          toast.error(t('Field ') + t(requiredField) + t(' is required'));
          agentContext.setStatus({
            id: requiredField + '-required',
            message: t('Field ') + t(requiredField) + t(' is required'),
            type: 'error'
          });
          return;

        }
      }
    }

    try {
      // stop watching for form changes while we persist the data to avoid race conditions
      if (watchSubscription.current) watchSubscription.current.unsubscribe();

      const response = await updateAgent(updatedAgent, true);
      toast.success(t('Agent updated successfully'));
      agentContext.setStatus({
        id: 'agent-updated',
        message: t('Agent updated successfully'),
        type: 'success'
      });
      if (newAgent)
        sessionStorage.removeItem(`agent-new`);
      else
        sessionStorage.removeItem(`agent-${updatedAgent.id}`);

      if (newAgent) router.push(`/admin/agent/${response.id}/general`);
    } catch (e) {
      console.error(e);
      toast.error(t('Failed to update agent'));
    }
  };
  return { onSubmit, isDirty, setIsDirty }
}


export default function GeneralPage() {


  const { t } = useTranslation();
  const router = useRouter();
  const { setStatus, status, removeStatus, current: agent, updateAgent, loaderStatus } = useAgentContext();
  const [agentDescriptor, setAgentDescriptor] = useState<AgentTypeDescriptor>({});
  const dbContext = useContext(DatabaseContext);
  const saasContext = useContext(SaaSContext);

  const methods = useForm({
    defaultValues: agent ? agent.toForm(null) : {},
  });
  const { register, handleSubmit, setValue, getValues, formState: { errors }, watch } = methods;

  const editors = {
    welcomeInfo: React.useRef<MDXEditorMethods>(null),
    termsConditions: React.useRef<MDXEditorMethods>(null)
  }
  register('icon');
  register('welcomeInfo');
  register('termsConditions', {
    validate: {
      termsConditions: (v) => (getValues('confirmTerms') === true && !v) ? false : true
    }
  });

  const { onSubmit, isDirty } = onAgentSubmit(agent, watch, setValue, getValues, updateAgent, t, router, editors);

  const agentTypeValue = watch('agentType');
  useEffect(() => {
    if (agentTypeValue) {
      const agentTypeDescriptor = agentTypesRegistry.find(at => at.type === agentTypeValue);
      if (agentDescriptor) setAgentDescriptor(agentTypeDescriptor as AgentTypeDescriptor);
    }
  }, [agentTypeValue]);


  useEffect(() => {
    if (isDirty) {
      setStatus({ id: 'dirty', message: t('You have unsaved changes'), type: 'warning' });
    } else {
      removeStatus('dirty');
    }
  }, [isDirty]);

  return (
    <div className="space-y-6">
      {loaderStatus === 'loading' ? (

        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center">
          <DataLoader />
        </div>

      ) : (null)}

      {isDirty ? (
        <AgentStatus status={{ id: 'dirty', message: t('You have unsaved changes'), type: 'warning' }} />
      ) : (
        <AgentStatus status={status} />
      )}
      <FormProvider {...methods}>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium">
              {t('Agent Name')}
            </label>
            <Input type='hidden' id="id" {...register('id')} />
            <Input
              type="text"
              id="displayName"
              {...register('displayName', { required: t('This field is required') })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.displayName && <p className="mt-2 text-sm text-red-600">{errors.displayName.message}</p>}
          </div>
          <div>
            <label htmlFor="agentType" className="block text-sm font-medium">
              {t('Agent type')}
            </label>
            <AgentTypeSelect fieldName='agentType' register={register} />
          </div>
          <div>
            <label htmlFor="welcomeInfo" className="block text-sm font-medium">
              {t(agentDescriptor?.supportsUserFacingUI ? 'Welcome Message' : 'Description')}
            </label>
            <MarkdownEditor markdown={getValues('welcomeInfo') ?? agent?.options?.welcomeMessage ?? ''} ref={editors.welcomeInfo} onChange={(e) => setValue('welcomeInfo', e)} diffMarkdown={agent?.options?.welcomeMessage ?? ''} />
            {errors.welcomeInfo && <p className="mt-2 text-sm text-red-600">{errors.welcomeInfo.message}</p>}
          </div>
          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="termsConditions" className="block text-sm font-medium">
                {t('Terms and Conditions')}
              </label>
              <MarkdownEditor markdown={getValues('termsConditions') ?? agent?.options?.termsAndConditions} ref={editors.termsConditions ?? ''} onChange={(e) => setValue('termsConditions', e)} diffMarkdown={agent?.options?.termsAndConditions ?? ''} />
              {errors.termsConditions && <p className="mt-2 text-sm text-red-600">{t('If you require terms to be accepted by the user, you should provide them.')}</p>}
            </div>
          )}
          {agentDescriptor?.supportsUserFacingUI && (
            <div className="text-xs p-2 flex">
              <div><InfoIcon className="w-4 h-4 mr-2" /></div>
              <div><strong>{t('Important note on GDPR and Terms: ')}</strong> {t('if your agent is about to process the personal data of the users, you SHOULD provide the terms and conditions and ask for the user consent. If you offer a commerce service you SHOULD also apply the Consumer Laws and provide the user with the right to return the product.')}
              </div>
            </div>
          )}
          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="confirmTerms" className="flex items-center text-sm font-medium">
                <Input
                  type="checkbox"
                  id="confirmTerms"
                  {...register('confirmTerms')}
                  className="mr-2 w-4"
                />
                {t('Must confirm terms and conditions')}
              </label>
              {errors.confirmTerms && <p className="mt-2 text-sm text-red-600">{errors.confirmTerms.message}</p>}
            </div>
          )}
          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="resultEmail" className="block text-sm font-medium">
                {t('Result Email')}
              </label>
              <Input
                type="email"
                id="resultEmail"
                {...register('resultEmail', { pattern: { value: /^\S+@\S+$/i, message: t('Invalid email address') } })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.resultEmail && <p className="mt-2 text-sm text-red-600">{errors.resultEmail.message}</p>}
            </div>
          )}
          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="collectUserInfo" className="flex items-center text-sm font-medium">
                <Input
                  type="checkbox"
                  id="collectUserInfo"
                  {...register('collectUserInfo')}
                  className="mr-2 w-4"
                />
                {t('Collect user e-mail addresses and names')}
              </label>
              {errors.collectUserInfo && <p className="mt-2 text-sm text-red-600">{errors.collectUserInfo.message}</p>}
            </div>
          )}
          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="locale" className="block text-sm font-medium">
                {t('Default language')}
              </label>
              <LocaleSelect fieldName='locale' register={register} />
            </div>
          )}


          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="ogTitle" className="block text-sm font-medium">
                {t('Open Graph Title')}
              </label>
              <Input
                type="text"
                id="ogTitle"
                {...register('ogTitle')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          )}

          {agentDescriptor?.supportsUserFacingUI && (
            <div>
              <label htmlFor="ogDescription" className="block text-sm font-medium">
                {t('Open Graph Description')}
              </label>
              <Textarea
                rows={4}
                {...register('ogDescription')}
                id="ogDescription"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          )}

          {agentDescriptor?.supportsUserFacingUI && (

            <div>

              <label htmlFor="published" className="flex items-center text-sm font-medium">
                {t('Open Graph Image')}
              </label>

              {getValues('icon') && (
                <div>
                  <ZoomableImage src={getValues('icon')} alt={''} className="cursor-pointer w-full h-full object-cover" />
                  <Button variant={"outline"} size="icon" className="relative top-[-38px] left-[2px]" onClick={(e) => {
                    e.preventDefault();
                    setValue('icon', '');
                  }
                  }>
                    <TrashIcon className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <AttachmentUploader
                accept="image/*"
                dbContext={dbContext}
                saasContext={saasContext}
                onUploaded={(uploaded) => {
                  if (uploaded) {
                    setValue('icon', `${process.env.NEXT_PUBLIC_APP_URL}/storage/attachment/${dbContext?.databaseIdHash}/${uploaded.storageKey}`)
                  }
                }}
              />
            </div>
          )}


          <div>
            <label htmlFor="published" className="flex items-center text-sm font-medium">
              <Input
                type="checkbox"
                id="published"
                {...register('published')}
                className="mr-2 w-4"
              />
              {t('Agent is published')}
            </label>
            {errors.collectUserInfo && <p className="mt-2 text-sm text-red-600">{errors.collectUserInfo.message}</p>}
          </div>
          <div className="flex justify-between">
            <Button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {t('Save')}
            </Button>

            <SaveAgentAsTemplateButton getFormValues={getValues} agent={agent} onSaved={function (): void {
            }} />
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

